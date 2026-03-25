import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface EmailConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
}

interface ResendSuccessResponse {
  id: string;
}

interface ResendErrorResponse {
  message: string;
  name?: string;
  statusCode?: number;
}

async function sendViaResend(
  config: EmailConfig,
  params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
  }
): Promise<ResendSuccessResponse> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.fromName
        ? `${config.fromName} <${config.fromEmail}>`
        : config.fromEmail,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.body,
      ...(params.cc && params.cc.length > 0 && { cc: params.cc }),
      ...(params.bcc && params.bcc.length > 0 && { bcc: params.bcc }),
      ...(params.replyTo && { reply_to: params.replyTo }),
    }),
  });

  const data = (await res.json()) as ResendSuccessResponse | ResendErrorResponse;

  if (!res.ok) {
    throw new Error((data as ResendErrorResponse).message || `Resend API error: ${res.status}`);
  }

  return data as ResendSuccessResponse;
}

export function createEmailTools(
  convexClient: AgentConvexClient,
  agentId: string,
  emailConfig: EmailConfig
) {
  const sendEmail = tool(
    "send_email",
    "Send an email to one or more recipients. Supports HTML content, CC, BCC, and reply-to.",
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
      cc: z
        .array(z.string())
        .optional()
        .describe("CC recipient email addresses"),
      bcc: z
        .array(z.string())
        .optional()
        .describe("BCC recipient email addresses"),
      reply_to: z
        .string()
        .optional()
        .describe("Reply-to email address"),
    },
    async (input) => {
      try {
        const result = await sendViaResend(emailConfig, {
          to: input.to,
          subject: input.subject,
          body: input.body,
          cc: input.cc,
          bcc: input.bcc,
          replyTo: input.reply_to,
        });

        // Log the email in Convex
        const recipients = Array.isArray(input.to) ? input.to : [input.to];
        await convexClient.logEmail(agentId, {
          to: recipients,
          subject: input.subject,
          status: "sent",
          resendId: result.id,
        });
        await convexClient.emitEvent(agentId, "email.sent", "email_tools", {
          to: recipients,
          subject: input.subject,
          body: input.body,
          cc: input.cc,
          bcc: input.bcc,
          replyTo: input.reply_to,
          resendId: result.id,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Email sent successfully to ${recipients.join(", ")}. Subject: "${input.subject}"`,
            },
          ],
        };
      } catch (err: any) {
        // Log the failure
        const recipients = Array.isArray(input.to) ? input.to : [input.to];
        await convexClient.logEmail(agentId, {
          to: recipients,
          subject: input.subject,
          status: "failed",
          error: err.message,
        });
        await convexClient.emitEvent(agentId, "email.failed", "email_tools", {
          to: recipients,
          subject: input.subject,
          error: err.message,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to send email: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  return [sendEmail];
}
