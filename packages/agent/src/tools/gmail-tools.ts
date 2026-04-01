import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// ── OAuth token helper ───────────────────────────────────────────────

async function getAccessToken(config: GmailConfig): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google OAuth error: ${data.error_description || data.error || res.status}`
    );
  }
  return data.access_token;
}

async function gmailFetch(
  config: GmailConfig,
  path: string,
  method: string = "GET",
  body?: any
) {
  const accessToken = await getAccessToken(config);
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (method === "DELETE" && res.status === 204) return {};

  const data = await res.json();
  if (!res.ok) {
    const msg =
      data.error?.message || `Gmail API error: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── MIME helpers ─────────────────────────────────────────────────────

function buildMimeMessage(params: {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const to = Array.isArray(params.to) ? params.to.join(", ") : params.to;
  const lines: string[] = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`,
    `Content-Type: text/html; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ];
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(", ")}`);
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(", ")}`);
  if (params.replyTo) lines.push(`Reply-To: ${params.replyTo}`);
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) lines.push(`References: ${params.references}`);

  lines.push("", params.body);

  const raw = lines.join("\r\n");
  // base64url encoding (RFC 4648 §5)
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Message decoding helpers ─────────────────────────────────────────

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find(
    (hdr: any) => hdr.name.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? "";
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") html = decoded;
    else text = decoded;
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data && !text) {
        text = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data && !html) {
        html = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        const nested = extractBody(part);
        if (!text && nested.text) text = nested.text;
        if (!html && nested.html) html = nested.html;
      }
    }
  }

  return { text, html };
}

function summariseMessage(msg: any) {
  const headers = msg.payload?.headers ?? [];
  const { text, html } = extractBody(msg.payload ?? {});
  const bodyPreview = text || html?.replace(/<[^>]*>/g, "") || msg.snippet || "";

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc") || null,
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    snippet: msg.snippet,
    body: bodyPreview.substring(0, 2000),
    labels: msg.labelIds ?? [],
    messageId: getHeader(headers, "Message-ID"),
  };
}

// ── Tool factory ─────────────────────────────────────────────────────

export function createGmailTools(
  convexClient: AgentConvexClient,
  agentId: string,
  config: GmailConfig
) {
  // ── List messages ──────────────────────────────────────────────────

  const gmailListMessages = tool(
    "gmail_list_messages",
    "List recent emails from the user's Gmail inbox. Returns message summaries with subject, from, date, and snippet.",
    {
      max_results: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of messages to return (default 10, max 50)"),
      label: z
        .string()
        .optional()
        .describe(
          "Filter by Gmail label (e.g. INBOX, SENT, DRAFT, STARRED, UNREAD, IMPORTANT, or custom label name)"
        ),
      page_token: z
        .string()
        .optional()
        .describe("Token for fetching the next page of results"),
    },
    async (input) => {
      const maxResults = Math.min(input.max_results ?? 10, 50);
      const params = new URLSearchParams({
        maxResults: String(maxResults),
      });
      if (input.label) params.set("labelIds", input.label);
      if (input.page_token) params.set("pageToken", input.page_token);

      const listResult = await gmailFetch(config, `/messages?${params}`);
      const messageIds: string[] = (listResult.messages ?? []).map(
        (m: any) => m.id
      );

      if (messageIds.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No messages found." },
          ],
        };
      }

      // Fetch full metadata for each message (batch, max 10 concurrent)
      const messages = await Promise.all(
        messageIds.slice(0, 10).map((id) =>
          gmailFetch(config, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Cc`)
        )
      );

      const summaries = messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        from: getHeader(msg.payload?.headers ?? [], "From"),
        to: getHeader(msg.payload?.headers ?? [], "To"),
        subject: getHeader(msg.payload?.headers ?? [], "Subject"),
        date: getHeader(msg.payload?.headers ?? [], "Date"),
        snippet: msg.snippet,
        labels: msg.labelIds ?? [],
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                messages: summaries,
                resultCount: summaries.length,
                nextPageToken: listResult.nextPageToken ?? null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Search messages ────────────────────────────────────────────────

  const gmailSearch = tool(
    "gmail_search",
    "Search Gmail using Gmail's search syntax (same as the search bar). Returns matching message summaries.",
    {
      query: z
        .string()
        .describe(
          'Gmail search query (e.g. "from:alice subject:meeting", "is:unread", "newer_than:2d", "has:attachment")'
        ),
      max_results: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of results (default 10, max 50)"),
    },
    async (input) => {
      const maxResults = Math.min(input.max_results ?? 10, 50);
      const params = new URLSearchParams({
        q: input.query,
        maxResults: String(maxResults),
      });

      const listResult = await gmailFetch(config, `/messages?${params}`);
      const messageIds: string[] = (listResult.messages ?? []).map(
        (m: any) => m.id
      );

      if (messageIds.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No messages found matching "${input.query}".`,
            },
          ],
        };
      }

      const messages = await Promise.all(
        messageIds.slice(0, 10).map((id) =>
          gmailFetch(config, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
        )
      );

      const summaries = messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        from: getHeader(msg.payload?.headers ?? [], "From"),
        to: getHeader(msg.payload?.headers ?? [], "To"),
        subject: getHeader(msg.payload?.headers ?? [], "Subject"),
        date: getHeader(msg.payload?.headers ?? [], "Date"),
        snippet: msg.snippet,
        labels: msg.labelIds ?? [],
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { query: input.query, messages: summaries, resultCount: summaries.length },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Get message ────────────────────────────────────────────────────

  const gmailGetMessage = tool(
    "gmail_get_message",
    "Get the full content of a specific Gmail message by its ID. Returns full body, headers, and attachments list.",
    {
      message_id: z.string().describe("The Gmail message ID"),
    },
    async (input) => {
      const msg = await gmailFetch(config, `/messages/${input.message_id}?format=full`);
      const summary = summariseMessage(msg);

      // Check for attachments
      const attachments: any[] = [];
      if (msg.payload?.parts) {
        for (const part of msg.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId,
            });
          }
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ...summary, attachments }, null, 2),
          },
        ],
      };
    }
  );

  // ── Send email ─────────────────────────────────────────────────────

  const gmailSend = tool(
    "gmail_send",
    "Send an email via Gmail. Supports HTML content, CC, BCC, and reply-to.",
    {
      to: z
        .union([z.string(), z.array(z.string())])
        .describe("Recipient email address(es)"),
      subject: z.string().describe("Email subject line"),
      body: z
        .string()
        .describe(
          "Email body content. Supports HTML for formatting (e.g. <b>bold</b>, <br>, <ul><li>items</li></ul>)"
        ),
      cc: z.array(z.string()).optional().describe("CC recipients"),
      bcc: z.array(z.string()).optional().describe("BCC recipients"),
      reply_to: z.string().optional().describe("Reply-to email address"),
    },
    async (input) => {
      try {
        const raw = buildMimeMessage({
          to: input.to,
          subject: input.subject,
          body: input.body,
          cc: input.cc,
          bcc: input.bcc,
          replyTo: input.reply_to,
        });

        const result = await gmailFetch(config, "/messages/send", "POST", {
          raw,
        });

        const recipients = Array.isArray(input.to) ? input.to : [input.to];
        await convexClient.logEmail(agentId, {
          to: recipients,
          subject: input.subject,
          status: "sent",
          resendId: result.id, // Gmail message ID stored in resendId field
        });
        await convexClient.emitEvent(agentId, "gmail.sent", "gmail_tools", {
          to: recipients,
          subject: input.subject,
          body: input.body,
          cc: input.cc,
          bcc: input.bcc,
          replyTo: input.reply_to,
          gmailMessageId: result.id,
          threadId: result.threadId,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Email sent successfully via Gmail to ${recipients.join(", ")}. Subject: "${input.subject}" (Message ID: ${result.id})`,
            },
          ],
        };
      } catch (err: any) {
        const recipients = Array.isArray(input.to) ? input.to : [input.to];
        await convexClient.logEmail(agentId, {
          to: recipients,
          subject: input.subject,
          status: "failed",
          error: err.message,
        });
        await convexClient.emitEvent(agentId, "gmail.failed", "gmail_tools", {
          to: recipients,
          subject: input.subject,
          error: err.message,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to send email via Gmail: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Reply to email ─────────────────────────────────────────────────

  const gmailReply = tool(
    "gmail_reply",
    "Reply to an existing Gmail message. The reply is added to the same thread.",
    {
      message_id: z
        .string()
        .describe("The Gmail message ID to reply to"),
      body: z
        .string()
        .describe("Reply body content (supports HTML)"),
      reply_all: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, reply to all recipients (CC included)"),
    },
    async (input) => {
      try {
        // Get original message to extract headers
        const original = await gmailFetch(
          config,
          `/messages/${input.message_id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`
        );
        const headers = original.payload?.headers ?? [];
        const origFrom = getHeader(headers, "From");
        const origTo = getHeader(headers, "To");
        const origCc = getHeader(headers, "Cc");
        const origSubject = getHeader(headers, "Subject");
        const origMessageId = getHeader(headers, "Message-ID");
        const origReferences = getHeader(headers, "References");

        // Build reply recipients
        const replyTo = origFrom;
        const cc = input.reply_all
          ? [origTo, origCc].filter(Boolean).join(", ")
          : undefined;

        // Build references chain
        const references = origReferences
          ? `${origReferences} ${origMessageId}`
          : origMessageId;

        const subject = origSubject.startsWith("Re:")
          ? origSubject
          : `Re: ${origSubject}`;

        const raw = buildMimeMessage({
          to: replyTo,
          subject,
          body: input.body,
          cc: cc ? [cc] : undefined,
          inReplyTo: origMessageId,
          references,
        });

        const result = await gmailFetch(config, "/messages/send", "POST", {
          raw,
          threadId: original.threadId,
        });

        await convexClient.emitEvent(agentId, "gmail.replied", "gmail_tools", {
          to: replyTo,
          subject,
          originalMessageId: input.message_id,
          gmailMessageId: result.id,
          threadId: result.threadId,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Reply sent to ${replyTo}. Subject: "${subject}" (Thread: ${result.threadId})`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to reply: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── List labels ────────────────────────────────────────────────────

  const gmailListLabels = tool(
    "gmail_list_labels",
    "List all Gmail labels (folders/categories) in the user's account.",
    {},
    async () => {
      const data = await gmailFetch(config, "/labels");
      const labels = (data.labels ?? []).map((l: any) => ({
        id: l.id,
        name: l.name,
        type: l.type, // system or user
        messagesTotal: l.messagesTotal,
        messagesUnread: l.messagesUnread,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ labels, count: labels.length }, null, 2),
          },
        ],
      };
    }
  );

  // ── Modify labels ──────────────────────────────────────────────────

  const gmailModifyLabels = tool(
    "gmail_modify_labels",
    "Add or remove labels from a Gmail message. Use this to archive (remove INBOX), star, mark as read/unread, or categorize.",
    {
      message_id: z.string().describe("The Gmail message ID"),
      add_labels: z
        .array(z.string())
        .optional()
        .describe(
          'Label IDs to add (e.g. "STARRED", "IMPORTANT", or custom label ID)'
        ),
      remove_labels: z
        .array(z.string())
        .optional()
        .describe(
          'Label IDs to remove (e.g. "UNREAD" to mark as read, "INBOX" to archive)'
        ),
    },
    async (input) => {
      const body: any = {};
      if (input.add_labels?.length) body.addLabelIds = input.add_labels;
      if (input.remove_labels?.length) body.removeLabelIds = input.remove_labels;

      await gmailFetch(
        config,
        `/messages/${input.message_id}/modify`,
        "POST",
        body
      );

      await convexClient.emitEvent(
        agentId,
        "gmail.labels_modified",
        "gmail_tools",
        {
          messageId: input.message_id,
          addedLabels: input.add_labels ?? [],
          removedLabels: input.remove_labels ?? [],
        }
      );

      const actions: string[] = [];
      if (input.add_labels?.length)
        actions.push(`added: ${input.add_labels.join(", ")}`);
      if (input.remove_labels?.length)
        actions.push(`removed: ${input.remove_labels.join(", ")}`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Labels updated on message ${input.message_id}: ${actions.join("; ")}`,
          },
        ],
      };
    }
  );

  // ── Get thread ─────────────────────────────────────────────────────

  const gmailGetThread = tool(
    "gmail_get_thread",
    "Get all messages in a Gmail thread/conversation. Useful for reading an entire email chain.",
    {
      thread_id: z.string().describe("The Gmail thread ID"),
    },
    async (input) => {
      const thread = await gmailFetch(
        config,
        `/threads/${input.thread_id}?format=full`
      );
      const messages = (thread.messages ?? []).map(summariseMessage);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                threadId: thread.id,
                messageCount: messages.length,
                messages,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return [
    gmailListMessages,
    gmailSearch,
    gmailGetMessage,
    gmailSend,
    gmailReply,
    gmailListLabels,
    gmailModifyLabels,
    gmailGetThread,
  ];
}
