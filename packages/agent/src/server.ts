import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { ProcessManager } from "./process-manager.js";
import { runCreator } from "./run-creator.js";
import { runApiEndpoint } from "./run-api-endpoint.js";
import { processDocument } from "./document-processor.js";
import { AgentConvexClient } from "./convex-client.js";
import { DiscordGatewayManager } from "./discord-gateway-manager.js";
import { SlackGatewayManager } from "./slack-gateway-manager.js";
import { generateOnce } from "./run-with-ai-sdk.js";

// ── Automation types ──────────────────────────────────────────────────

type AutomationActionType =
  | "send_email"
  | "create_task"
  | "update_task"
  | "create_note"
  | "fire_webhook"
  | "store_memory"
  | "run_prompt"
  | "trigger_agent"
  | "delay";

interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, any>;
}

interface Automation {
  _id: string;
  name: string;
  trigger: { event: string; filter?: Record<string, unknown> };
  actions: AutomationAction[];
  isActive: boolean;
}

const CONVEX_URL = process.env.CONVEX_URL!;
const SERVER_TOKEN = process.env.AGENT_SERVER_TOKEN!;
// Fallback poll interval — primary dispatch is push-based via Convex scheduler
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "30000", 10);

if (!CONVEX_URL) throw new Error("CONVEX_URL environment variable is required");
if (!SERVER_TOKEN) throw new Error("AGENT_SERVER_TOKEN environment variable is required");

const convex = new ConvexHttpClient(CONVEX_URL);

const processManager = new ProcessManager({
  onComplete: async (jobId, result, error) => {
    try {
      if (result === "done") {
        await convex.mutation(api.agentJobs.complete, { jobId: jobId as any });
      } else {
        await convex.mutation(api.agentJobs.fail, {
          jobId: jobId as any,
          error: error ?? "Agent run failed",
        });
      }
      console.log(`[server] Job ${jobId} marked as ${result}`);
    } catch (err: any) {
      console.error(`[server] Failed to update job ${jobId} status:`, err.message);
    }
  },
});

const app = new Hono();
app.use("/*", cors());

// ── Health check ─────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({
    status: "ok",
    active: processManager.activeCount,
    queued: processManager.queueLength,
  })
);

// ── Manual trigger (for testing) ─────────────────────────────────────

app.post("/trigger", async (c) => {
  const body = await c.req.json<{
    jobId: string;
    agentId: string;
    conversationId: string;
    assistantMessageId: string;
  }>();

  const { queued } = processManager.submit(body.jobId, {
    agentId: body.agentId,
    conversationId: body.conversationId,
    assistantMessageId: body.assistantMessageId,
    convexUrl: CONVEX_URL,
    serverToken: SERVER_TOKEN,
  });

  return c.json({ ok: true, queued });
});

// ── Push-based dispatch endpoints ────────────────────────────────────
// Called by Convex scheduled actions for instant dispatch (replaces polling)

function verifyDispatchAuth(c: any): boolean {
  const auth = c.req.header("Authorization");
  return auth === `Bearer ${SERVER_TOKEN}`;
}

// Job dispatch: Convex calls this immediately when a job is created
app.post("/dispatch/job", async (c) => {
  if (!verifyDispatchAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  const { jobId } = await c.req.json<{ jobId: string }>();

  try {
    // Load the job
    const job = await convex.query(api.agentJobs.get, {
      jobId: jobId as any,
    });
    if (!job || job.status !== "pending") {
      return c.json({ ok: true, skipped: true });
    }

    // Claim atomically
    const claimed = await convex.mutation(api.agentJobs.claim, {
      jobId: jobId as any,
      workerId: `worker-${process.pid}`,
    });
    if (!claimed) return c.json({ ok: true, skipped: true });

    // Determine runner type
    const agent = await convex.query(api.agentApi.getAgent, {
      serverToken: SERVER_TOKEN,
      agentId: job.agentId,
    });
    const session = await convex.query(api.creatorApi.getSessionByConversation, {
      serverToken: SERVER_TOKEN,
      conversationId: job.conversationId,
    });
    const isCreatorJob = agent?.status === "draft" || session !== null;
    const runner = isCreatorJob ? runCreator : undefined;

    console.log(
      `[dispatch] Job ${jobId} dispatched for ${isCreatorJob ? "creator" : "agent"} ${job.agentId}`
    );

    processManager.submit(
      jobId,
      {
        agentId: job.agentId,
        conversationId: job.conversationId,
        assistantMessageId: job.messageId,
        convexUrl: CONVEX_URL,
        serverToken: SERVER_TOKEN,
      },
      runner
    );

    return c.json({ ok: true });
  } catch (err: any) {
    console.error(`[dispatch] Job dispatch error:`, err.message);
    return c.json({ error: err.message }, 500);
  }
});

// Timer dispatch: LEGACY — Convex now uses processAutomation.fireTimer natively.
// Kept for backwards compatibility / manual testing only.
app.post("/dispatch/timer", async (c) => {
  if (!verifyDispatchAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  const { timerId } = await c.req.json<{ timerId: string }>();

  try {
    // Mark as fired atomically
    const firedTimer = await convex.mutation(api.agentTimers.markFired, {
      serverToken: SERVER_TOKEN,
      timerId: timerId as any,
    });
    if (!firedTimer) return c.json({ ok: true, skipped: true });

    const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);
    console.log(`[dispatch] Timer "${firedTimer.label}" (${timerId}) firing`);

    // Execute — reuse the same logic as the polling executor
    await executeTimerAction(convexClient, firedTimer);

    return c.json({ ok: true });
  } catch (err: any) {
    console.error(`[dispatch] Timer dispatch error:`, err.message);
    return c.json({ error: err.message }, 500);
  }
});

// Event dispatch: LEGACY — Convex now uses processAutomation.processEvent natively.
// Kept for backwards compatibility / manual testing only.
app.post("/dispatch/event", async (c) => {
  if (!verifyDispatchAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  const { agentId, event, payload } = await c.req.json<{
    agentId: string;
    event: string;
    payload: Record<string, any>;
  }>();

  try {
    const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);

    // Event is already emitted directly in Convex via emitInternal.
    // Here we only need to process automations.
    await processAutomations(convexClient, agentId, event, payload);

    console.log(`[dispatch] Event "${event}" — automations processed for agent ${agentId}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(`[dispatch] Event dispatch error:`, err.message);
    return c.json({ error: err.message }, 500);
  }
});

// Schedule dispatch: LEGACY — Convex now uses processAutomation.fireSchedule natively.
// Kept for backwards compatibility / manual testing only.
app.post("/dispatch/schedule", async (c) => {
  if (!verifyDispatchAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  const { actionId } = await c.req.json<{ actionId: string }>();

  try {
    // Mark as running
    const result = await convex.mutation(api.scheduledActions.markRunning, {
      serverToken: SERVER_TOKEN,
      actionId: actionId as any,
    });
    if (!result) return c.json({ ok: true, skipped: true });

    console.log(`[dispatch] Schedule "${result.action.name}" (${actionId}) firing`);

    // Execute — reuse the same logic as the polling executor
    await executeScheduleAction(result.runId, actionId, result.action);

    return c.json({ ok: true });
  } catch (err: any) {
    console.error(`[dispatch] Schedule dispatch error:`, err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── OAuth2 callback ──────────────────────────────────────────────────

app.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const webUiUrl = process.env.WEB_UI_URL ?? "http://localhost:5173";

  if (error) {
    return c.redirect(`${webUiUrl}/credentials?oauth=error&message=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return c.redirect(`${webUiUrl}/credentials?oauth=error&message=missing_params`);
  }

  try {
    // Validate state nonce
    const oauthState = await convex.query(api.credentials.getOAuthState, {
      serverToken: SERVER_TOKEN,
      state,
    });
    if (!oauthState) {
      return c.redirect(`${webUiUrl}/credentials?oauth=error&message=invalid_state`);
    }
    if (Date.now() > oauthState.expiresAt) {
      await convex.mutation(api.credentials.deleteOAuthState, {
        serverToken: SERVER_TOKEN,
        id: oauthState._id,
      });
      return c.redirect(`${webUiUrl}/credentials?oauth=error&message=expired`);
    }

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const serverUrl = process.env.AGENT_SERVER_PUBLIC_URL ?? `http://localhost:${PORT}`;
    const redirectUri = `${serverUrl}/oauth/callback`;

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const errBody = await tokenResp.text();
      console.error("[oauth] Token exchange failed:", errBody);
      return c.redirect(`${webUiUrl}/credentials?oauth=error&message=token_exchange_failed`);
    }

    const tokens = await tokenResp.json();

    // Encrypt the token data
    const { encrypt } = await import("@agent-maker/shared/src/crypto");
    const tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      clientId,
      clientSecret,
    };
    const { encrypted, iv } = encrypt(JSON.stringify(tokenData));

    // Update existing credential (reconnect) or insert new one
    if (oauthState.credentialIdToUpdate) {
      await convex.mutation(api.credentials.updateCredentialFromOAuth, {
        serverToken: SERVER_TOKEN,
        credentialId: oauthState.credentialIdToUpdate,
        encryptedData: encrypted,
        iv,
      });
    } else {
      await convex.mutation(api.credentials.insertCredentialFromOAuth, {
        serverToken: SERVER_TOKEN,
        userId: oauthState.userId,
        name: oauthState.credentialName ?? `Google (${new Date().toLocaleDateString()})`,
        type: oauthState.provider,
        encryptedData: encrypted,
        iv,
      });
    }

    // Clean up state
    await convex.mutation(api.credentials.deleteOAuthState, {
      serverToken: SERVER_TOKEN,
      id: oauthState._id,
    });

    return c.redirect(`${webUiUrl}/credentials?oauth=success`);
  } catch (err: any) {
    console.error("[oauth] Callback error:", err.message);
    return c.redirect(`${webUiUrl}/credentials?oauth=error&message=${encodeURIComponent(err.message)}`);
  }
});

// ── REST API endpoints (user-defined agent APIs) ─────────────────────

app.all("/api/:agentId/:endpointSlug", async (c) => {
  try {
    // Authenticate via API key
    const authHeader = c.req.header("Authorization");
    const apiKey = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : c.req.query("api_key");

    if (!apiKey) {
      return c.json({ error: "Missing API key. Pass via Authorization: Bearer <key> or ?api_key=<key>" }, 401);
    }

    // Validate key
    const keyInfo = await convex.query(api.agentApi.validateApiKey, {
      serverToken: SERVER_TOKEN,
      apiKey,
    });

    if (!keyInfo) {
      return c.json({ error: "Invalid API key" }, 401);
    }

    const { agentId } = c.req.param();
    if (keyInfo.agentId !== agentId) {
      return c.json({ error: "API key does not match this agent" }, 403);
    }

    // Look up endpoint config
    const { endpointSlug } = c.req.param();
    const endpoint = await convex.query(api.agentApi.getApiEndpoint, {
      serverToken: SERVER_TOKEN,
      agentId: agentId as any,
      slug: endpointSlug,
      method: c.req.method,
    });

    if (!endpoint) {
      return c.json({ error: `Endpoint ${c.req.method} /${endpointSlug} not found` }, 404);
    }

    // Build the prompt from request data
    let requestBody = "";
    if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
      try {
        requestBody = JSON.stringify(await c.req.json());
      } catch {
        requestBody = await c.req.text();
      }
    }

    const queryParams = Object.fromEntries(new URL(c.req.url).searchParams);

    const prompt = `${endpoint.promptTemplate}

--- Incoming Request ---
Method: ${c.req.method}
Endpoint: /${endpointSlug}
Query Parameters: ${JSON.stringify(queryParams)}
${requestBody ? `Body: ${requestBody}` : ""}
---

Respond with ${endpoint.responseFormat === "json" ? "valid JSON only, no markdown, no explanation — just the JSON object/array" : "plain text"}.`;

    // Run agent synchronously
    const result = await runApiEndpoint({
      agentId,
      prompt,
      convexUrl: CONVEX_URL,
      serverToken: SERVER_TOKEN,
      model: undefined, // uses agent default
    });

    if (endpoint.responseFormat === "json") {
      try {
        // Try to parse as JSON
        const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
          result.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : result);
        return c.json(parsed);
      } catch {
        return c.json({ response: result });
      }
    }

    return c.text(result);
  } catch (err: any) {
    console.error("[api] Endpoint error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── System prompt AI assistant ────────────────────────────────────────

app.post("/assist-prompt", async (c) => {
  try {
    const { currentPrompt, instruction, agentName, agentDescription } =
      await c.req.json<{
        currentPrompt: string;
        instruction: string;
        agentName?: string;
        agentDescription?: string;
      }>();

    const systemPrompt = `You are an expert AI prompt engineer. Your job is to help users write effective system prompts for AI agents.

Rules:
- Return ONLY the improved system prompt text, nothing else
- No markdown code fences, no explanations, no preamble
- Keep the prompt clear, specific, and well-structured
- Preserve the user's intent and any domain-specific instructions
- Use a professional tone appropriate for system prompts`;

    const userMessage = currentPrompt
      ? `Here is the current system prompt for an agent${agentName ? ` called "${agentName}"` : ""}${agentDescription ? ` (${agentDescription})` : ""}:

---
${currentPrompt}
---

User's request: ${instruction}

Return the improved system prompt.`
      : `Create a system prompt for an AI agent${agentName ? ` called "${agentName}"` : ""}${agentDescription ? ` described as: ${agentDescription}` : ""}.

User's request: ${instruction}

Return the system prompt.`;

    const result = await generateOnce("gemini-3-flash-preview", systemPrompt, userMessage);

    return c.json({ prompt: result.trim() });
  } catch (err: any) {
    console.error("[assist-prompt] Error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── Document processing endpoint ─────────────────────────────────────

app.post("/process-document", async (c) => {
  try {
    const body = await c.req.json<{
      documentId: string;
      storageUrl: string;
      fileName: string;
      fileType: string;
      agentId: string;
    }>();

    const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);

    // Fire and forget — process asynchronously
    processDocument({
      documentId: body.documentId,
      storageUrl: body.storageUrl,
      fileName: body.fileName,
      fileType: body.fileType,
      agentId: body.agentId,
      convexClient,
    }).catch((err) => {
      console.error("[server] Document processing failed:", err.message);
    });

    return c.json({ ok: true });
  } catch (err: any) {
    console.error("[server] /process-document error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── Incoming webhooks (task creation/updates) ────────────────────────

app.post("/webhook/:secret", async (c) => {
  try {
    const { secret } = c.req.param();

    // Validate webhook secret
    const webhook = await convex.query(api.agentApi.validateWebhookSecret, {
      serverToken: SERVER_TOKEN,
      secret,
    });

    if (!webhook) {
      return c.json({ error: "Invalid or inactive webhook" }, 401);
    }

    const body = await c.req.json();
    const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);

    // Determine action from body or default to "create"
    const action = body.action ?? "create";

    // Emit webhook.received event for automations
    await convexClient.emitEvent(webhook.agentId, "webhook.received", "webhook", {
      webhookId: webhook.webhookId,
      action,
      body,
    });

    // Process automations triggered by webhook.received
    processAutomations(convexClient, webhook.agentId, "webhook.received", {
      action,
      ...body,
    });

    if (action === "create" && webhook.events.includes("task.created")) {
      if (!body.title) {
        return c.json({ error: "Missing required field: title" }, 400);
      }

      const taskId = await convexClient.createTaskViaWebhook(
        webhook.tabId,
        webhook.agentId,
        {
          title: body.title,
          description: body.description,
          status: body.status,
          priority: body.priority,
        }
      );

      // Emit task.created event
      const taskPayload = {
        taskId,
        tabId: webhook.tabId,
        title: body.title,
        description: body.description,
        status: body.status ?? "todo",
        priority: body.priority,
        tags: body.tags,
      };

      await convexClient.emitEvent(webhook.agentId, "task.created", "webhook", taskPayload);

      // Fire outgoing webhooks for task.created
      fireOutgoingWebhooks(convexClient, webhook.tabId, "task.created", taskPayload);

      // Process automations triggered by task.created
      processAutomations(convexClient, webhook.agentId, "task.created", taskPayload);

      return c.json({ ok: true, taskId });
    }

    if (action === "update" && webhook.events.includes("task.updated")) {
      if (!body.taskId) {
        return c.json({ error: "Missing required field: taskId" }, 400);
      }

      await convexClient.updateTaskViaWebhook(body.taskId, {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
      });

      const updatePayload = {
        taskId: body.taskId,
        tabId: webhook.tabId,
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        tags: body.tags,
      };

      // Emit task.updated event
      await convexClient.emitEvent(webhook.agentId, "task.updated", "webhook", updatePayload);

      // Fire outgoing webhooks for task.updated
      fireOutgoingWebhooks(convexClient, webhook.tabId, "task.updated", updatePayload);

      // Process automations triggered by task.updated
      processAutomations(convexClient, webhook.agentId, "task.updated", updatePayload);

      return c.json({ ok: true });
    }

    // Generic webhook passthrough — even if no specific action matches,
    // the event was emitted and automations were processed
    return c.json({ ok: true, message: "Event received and processed" });
  } catch (err: any) {
    console.error("[webhook] Error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Fire outgoing webhooks asynchronously (fire-and-forget).
 */
async function fireOutgoingWebhooks(
  convexClient: AgentConvexClient,
  tabId: string,
  event: string,
  payload: any
) {
  try {
    const webhooks = await convexClient.listOutgoingWebhooks(tabId, event);

    for (const wh of webhooks) {
      if (!wh.url) continue;
      fetch(wh.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      }).catch((err) => {
        console.error(`[webhook] Outgoing failed for ${wh.url}:`, err.message);
      });
    }
  } catch (err: any) {
    console.error("[webhook] Failed to fetch outgoing webhooks:", err.message);
  }
}

// ── Single-action executors (used by both dispatch endpoints and fallback polls)

async function executeScheduleAction(runId: string, actionId: string, action: any) {
  const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);
  let success = true;
  let actionResult = "";
  let actionError: string | undefined;

  try {
    switch (action.action.type) {
      case "run_prompt": {
        const config = action.action.config;
        await convexClient.runPrompt(
          action.agentId,
          config.prompt ?? "No prompt provided",
          `Schedule: ${action.name}`
        );
        actionResult = `Prompt dispatched: ${config.prompt?.substring(0, 100) ?? "N/A"}`;
        break;
      }
      case "send_email": {
        const { to, subject, body } = action.action.config;
        const emailConfig = await convexClient.getToolConfig(action.agentId, "email");
        if (emailConfig && (emailConfig as any).resendApiKey) {
          const ec = emailConfig as any;
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ec.resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: ec.fromName ? `${ec.fromName} <${ec.fromEmail}>` : ec.fromEmail,
              to: Array.isArray(to) ? to : [to],
              subject,
              html: body,
            }),
          });
          if (!res.ok) throw new Error(`Resend API error: ${res.status}`);
          await convexClient.logEmail(action.agentId, {
            to: Array.isArray(to) ? to : [to],
            subject,
            status: "sent",
          });
          actionResult = `Email sent to ${to}`;
        } else {
          throw new Error("Email not configured for this agent");
        }
        break;
      }
      case "create_task": {
        const { tabId, title, description, status, priority } = action.action.config;
        await convexClient.createTask(tabId, action.agentId, {
          title, description, status, priority,
        });
        actionResult = `Task "${title}" created`;
        break;
      }
      case "fire_webhook": {
        const { url, payload } = action.action.config;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "schedule.fired",
            timestamp: new Date().toISOString(),
            agentId: action.agentId,
            scheduleName: action.name,
            data: payload,
          }),
          signal: AbortSignal.timeout(15000),
        });
        actionResult = `Webhook fired to ${url}`;
        break;
      }
      default:
        actionResult = `Unknown action type: ${action.action.type}`;
    }
  } catch (err: any) {
    success = false;
    actionError = err.message;
    console.error(`[schedule] Action failed:`, err.message);
  }

  const scheduleFiredPayload = {
    actionId,
    actionName: action.name,
    actionType: action.action?.type,
    cronExpression: action.cronExpression,
    success,
    result: actionResult,
    error: actionError,
  };

  await convexClient.emitEvent(action.agentId, "schedule.fired", "scheduler", scheduleFiredPayload);

  // Process automations triggered by schedule.fired
  processAutomations(convexClient, action.agentId, "schedule.fired", scheduleFiredPayload);

  await convex.mutation(api.scheduledActions.completeRun, {
    serverToken: SERVER_TOKEN,
    runId: runId as any,
    actionId: actionId as any,
    success,
    result: actionResult,
    error: actionError,
  });

  console.log(`[schedule] Action "${action.name}" ${success ? "completed" : "failed"}`);
}

async function executeTimerAction(convexClient: AgentConvexClient, timer: any) {
  try {
    switch (timer.action.type) {
      case "send_email": {
        const { to, subject, body } = timer.action.config;
        const emailConfig = await convexClient.getToolConfig(timer.agentId, "email");
        if (emailConfig && (emailConfig as any).resendApiKey) {
          const ec = emailConfig as any;
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ec.resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: ec.fromName ? `${ec.fromName} <${ec.fromEmail}>` : ec.fromEmail,
              to: Array.isArray(to) ? to : [to],
              subject,
              html: body,
            }),
          });
          await convexClient.logEmail(timer.agentId, {
            to: Array.isArray(to) ? to : [to],
            subject,
            status: "sent",
          });
        }
        break;
      }
      case "create_task": {
        const { tabId, title, description, status, priority } = timer.action.config;
        await convexClient.createTask(tabId, timer.agentId, {
          title, description, status, priority,
        });
        break;
      }
      case "fire_webhook": {
        const { url, payload } = timer.action.config;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "timer.fired",
            timestamp: new Date().toISOString(),
            agentId: timer.agentId,
            timerLabel: timer.label,
            data: payload,
          }),
          signal: AbortSignal.timeout(15000),
        });
        break;
      }
      case "send_message":
        break;
      case "run_prompt": {
        const rpConfig = timer.action.config;
        await convexClient.runPrompt(
          timer.agentId,
          rpConfig.prompt ?? "No prompt provided",
          `Timer: ${timer.label}`
        );
        break;
      }
    }

    const timerFiredPayload = {
      timerId: timer._id,
      label: timer.label,
      actionType: timer.action.type,
      actionConfig: timer.action.config,
    };

    await convexClient.emitEvent(timer.agentId, "timer.fired", "timer", timerFiredPayload);

    // Process automations triggered by timer.fired
    processAutomations(convexClient, timer.agentId, "timer.fired", timerFiredPayload);

    console.log(`[timer] Timer "${timer.label}" fired successfully`);
  } catch (err: any) {
    console.error(`[timer] Failed to fire timer ${timer._id}:`, err.message);
  }
}

// ── Fallback polling (safety net — primary dispatch is push-based) ──

async function executeScheduledActions() {
  try {
    const now = Date.now();
    const dueActions = await convex.query(api.scheduledActions.listDue, {
      serverToken: SERVER_TOKEN,
      now,
    });

    for (const action of dueActions) {
      try {
        const result = await convex.mutation(api.scheduledActions.markRunning, {
          serverToken: SERVER_TOKEN,
          actionId: action._id,
        });
        if (!result) continue;
        console.log(`[fallback] Executing missed schedule "${action.name}" (${action._id})`);
        await executeScheduleAction(result.runId, action._id, result.action);
      } catch (err: any) {
        console.error(`[fallback] Schedule ${action._id}:`, err.message);
      }
    }
  } catch (err: any) {
    if (!err.message?.includes("Could not find")) {
      console.error("[fallback] Schedule poll error:", err.message);
    }
  }
}

async function executeTimers() {
  try {
    const now = Date.now();
    const dueTimers = await convex.query(api.agentTimers.listDue, {
      serverToken: SERVER_TOKEN,
      now,
    });

    for (const timer of dueTimers) {
      try {
        const firedTimer = await convex.mutation(api.agentTimers.markFired, {
          serverToken: SERVER_TOKEN,
          timerId: timer._id,
        });
        if (!firedTimer) continue;
        console.log(`[fallback] Firing missed timer "${timer.label}" (${timer._id})`);
        const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);
        await executeTimerAction(convexClient, firedTimer);
      } catch (err: any) {
        console.error(`[fallback] Timer ${timer._id}:`, err.message);
      }
    }
  } catch (err: any) {
    if (!err.message?.includes("Could not find")) {
      console.error("[fallback] Timer poll error:", err.message);
    }
  }
}

// ── Automation executor (event-driven) ──────────────────────────────

async function processAutomations(
  convexClient: AgentConvexClient,
  agentId: string,
  event: string,
  payload: Record<string, any>
) {
  try {
    const automations = await convexClient.listAutomations(agentId);
    const matching = (automations as Automation[]).filter(
      (a) => a.isActive && a.trigger.event === event
    );

    for (const automation of matching) {
      // Check filter conditions
      if (automation.trigger.filter) {
        const filter = automation.trigger.filter;
        let matches = true;
        for (const [key, value] of Object.entries(filter)) {
          if (payload[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      console.log(`[automation] Running "${automation.name}" triggered by ${event}`);

      for (const action of automation.actions) {
        try {
          // Template variable replacement
          const configStr = JSON.stringify(action.config).replace(
            /\{\{event\.(\w+)\}\}/g,
            (_: string, key: string) => payload[key]?.toString() ?? ""
          );
          const config = JSON.parse(configStr);

          switch (action.type) {
            case "send_email": {
              const emailConfig = await convexClient.getToolConfig(agentId, "email");
              if (emailConfig && (emailConfig as any).resendApiKey) {
                const ec = emailConfig as any;
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${ec.resendApiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: ec.fromName ? `${ec.fromName} <${ec.fromEmail}>` : ec.fromEmail,
                    to: Array.isArray(config.to) ? config.to : [config.to],
                    subject: config.subject,
                    html: config.body,
                  }),
                });
              }
              break;
            }
            case "create_task": {
              await convexClient.createTask(config.tabId, agentId, {
                title: config.title,
                description: config.description,
                status: config.status,
                priority: config.priority,
              });
              break;
            }
            case "update_task": {
              await convexClient.updateTask(config.taskId, {
                title: config.title,
                description: config.description,
                status: config.status,
                priority: config.priority,
              });
              break;
            }
            case "create_note": {
              // Auto-resolve tabId: use config.tabId, or find the first notes tab
              let noteTabId = config.tabId;
              if (!noteTabId) {
                const allTabs = await convexClient.listTabs(agentId);
                const notesTab = (allTabs as any[]).find((t: any) => t.type === "notes");
                noteTabId = notesTab?._id;
              }
              if (noteTabId) {
                await convexClient.createNote(noteTabId, agentId, {
                  title: config.title,
                  content: config.content,
                });
              } else {
                console.error("[automation] create_note: No notes tab found for agent");
              }
              break;
            }
            case "fire_webhook": {
              await fetch(config.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: `automation.${event}`,
                  timestamp: new Date().toISOString(),
                  data: config.payload ?? payload,
                }),
                signal: AbortSignal.timeout(15000),
              });
              break;
            }
            case "store_memory": {
              await convexClient.storeMemory(agentId, config.content, config.category);
              break;
            }
            case "run_prompt": {
              await convexClient.runPrompt(
                agentId,
                config.prompt ?? "No prompt provided",
                `Automation: ${automation.name}`
              );
              console.log(`[automation] run_prompt dispatched for agent ${agentId}`);
              break;
            }
            case "trigger_agent": {
              await convexClient.sendAgentMessage(
                agentId,
                config.agentId,
                config.message,
                { triggeredBy: event, payload }
              );
              break;
            }
            case "delay": {
              const ms = Math.min(config.ms ?? 1000, 3600000);
              await new Promise((resolve) => setTimeout(resolve, ms));
              break;
            }
          }
        } catch (err: any) {
          console.error(`[automation] Action ${action.type} failed:`, err.message);
        }
      }

      // Record that this automation ran
      try {
        await convexClient.recordAutomationRun(automation._id);
      } catch (err: any) {
        console.error(`[automation] Failed to record run for "${automation.name}":`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[automation] Error processing automations:", err.message);
  }
}

// ── Job polling loop ─────────────────────────────────────────────────

async function pollForJobs() {
  try {
    const pendingJobs = await convex.query(api.agentJobs.listPending, {});

    for (const job of pendingJobs) {
      const jobId = job._id;

      // Atomically claim the job
      const claimed = await convex.mutation(api.agentJobs.claim, {
        jobId,
        workerId: `worker-${process.pid}`,
      });

      if (!claimed) continue;

      // Check if this is a creator/editor job
      const agent = await convex.query(api.agentApi.getAgent, {
        serverToken: SERVER_TOKEN,
        agentId: job.agentId,
      });

      // Check for active creator/editor session on this conversation
      const session = await convex.query(api.creatorApi.getSessionByConversation, {
        serverToken: SERVER_TOKEN,
        conversationId: job.conversationId,
      });

      const isCreatorJob = agent?.status === "draft" || session !== null;
      const runner = isCreatorJob ? runCreator : undefined;

      console.log(
        `[server] Claimed job ${jobId} for ${isCreatorJob ? (session?.mode === "edit" ? "editor" : "creator") : "agent"} ${job.agentId}`
      );

      processManager.submit(
        jobId,
        {
          agentId: job.agentId,
          conversationId: job.conversationId,
          assistantMessageId: job.messageId,
          convexUrl: CONVEX_URL,
          serverToken: SERVER_TOKEN,
        },
        runner
      );
    }
  } catch (err: any) {
    console.error("[server] Poll error:", err.message);
  }
}

// Fallback polls — catch anything the push-based dispatch might miss
const FALLBACK_POLL_MS = POLL_INTERVAL_MS; // default 30s
setInterval(pollForJobs, FALLBACK_POLL_MS);
setInterval(executeScheduledActions, FALLBACK_POLL_MS);
setInterval(executeTimers, FALLBACK_POLL_MS);
console.log(`[server] Push-based dispatch active. Fallback poll every ${FALLBACK_POLL_MS / 1000}s`);

// ── Discord Gateway Manager ──────────────────────────────────────────

const discordGatewayManager = new DiscordGatewayManager(CONVEX_URL, SERVER_TOKEN);

// Initialize after a short delay to let Convex connect
setTimeout(() => {
  discordGatewayManager.initialize().catch((err) => {
    console.error("[server] Discord Gateway Manager init failed:", err.message);
  });
}, 3000);

// Discord config sync endpoint — call this when an agent's Discord settings change
app.post("/dispatch/discord-sync", async (c) => {
  if (!verifyDispatchAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  const { agentId } = await c.req.json<{ agentId?: string }>();

  if (agentId) {
    discordGatewayManager.restartGateway(agentId).catch((err) => {
      console.error(`[server] discord-sync restart error for ${agentId}:`, err.message);
    });
  } else {
    discordGatewayManager.syncAll().catch((err) => {
      console.error("[server] discord-sync syncAll error:", err.message);
    });
  }

  return c.json({ ok: true });
});

// ── Slack Gateway Manager ────────────────────────────────────────────

const slackGatewayManager = new SlackGatewayManager(CONVEX_URL, SERVER_TOKEN);

setTimeout(() => {
  slackGatewayManager.initialize().catch((err) => {
    console.error("[server] Slack Gateway Manager init failed:", err.message);
  });
}, 3500);

// Slack config sync endpoint — call this when an agent's Slack settings change
app.post("/dispatch/slack-sync", async (c) => {
  if (!verifyDispatchAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  const { agentId } = await c.req.json<{ agentId?: string }>();

  if (agentId) {
    slackGatewayManager.restartGateway(agentId).catch((err) => {
      console.error(`[server] slack-sync restart error for ${agentId}:`, err.message);
    });
  } else {
    slackGatewayManager.syncAll().catch((err) => {
      console.error("[server] slack-sync syncAll error:", err.message);
    });
  }

  return c.json({ ok: true });
});

// ── Start server ─────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3001", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[server] Agent server listening on http://localhost:${info.port}`);
});
