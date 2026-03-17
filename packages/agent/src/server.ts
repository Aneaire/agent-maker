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
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync } from "fs";

const CONVEX_URL = process.env.CONVEX_URL!;
const SERVER_TOKEN = process.env.AGENT_SERVER_TOKEN!;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10);

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

    const cwd = "/tmp/assist-prompt-workspace";
    if (!existsSync(cwd)) mkdirSync(cwd, { recursive: true });

    let result = "";
    const stream = query({
      prompt: userMessage,
      options: {
        systemPrompt,
        cwd,
        maxTurns: 1,
        model: "claude-sonnet-4-6",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
      },
    });

    for await (const message of stream) {
      if (message.type === "stream_event") {
        const ev = (message as any).event;
        if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
          result += ev.delta.text;
        }
      } else if (message.type === "assistant" && message.message?.content) {
        // Final assistant message — extract full text
        let fullText = "";
        for (const block of message.message.content) {
          if ("text" in block && block.text) {
            fullText += block.text;
          }
        }
        if (fullText) {
          result = fullText;
        }
      }
    }

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
        title: body.title,
        description: body.description,
        status: body.status ?? "todo",
        priority: body.priority,
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
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
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

// ── Scheduled Actions executor ──────────────────────────────────────

async function executeScheduledActions() {
  try {
    const now = Date.now();
    const dueActions = await convex.query(api.scheduledActions.listDue, {
      serverToken: SERVER_TOKEN,
      now,
    });

    for (const action of dueActions) {
      try {
        // Mark as running and get run ID
        const result = await convex.mutation(api.scheduledActions.markRunning, {
          serverToken: SERVER_TOKEN,
          actionId: action._id,
        });
        if (!result) continue;

        const { runId } = result;
        const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);

        console.log(`[cron] Executing scheduled action "${action.name}" (${action._id})`);

        // Execute the action based on type
        let success = true;
        let actionResult = "";
        let actionError: string | undefined;

        try {
          switch (action.action.type) {
            case "run_prompt": {
              // Create a conversation and job for the agent
              const config = action.action.config;
              actionResult = `Prompt scheduled: ${config.prompt?.substring(0, 100) ?? "N/A"}`;
              break;
            }
            case "send_email": {
              const { to, subject, body } = action.action.config;
              // Get email config for the agent
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
          console.error(`[cron] Action failed:`, err.message);
        }

        // Emit event
        await convexClient.emitEvent(action.agentId, "schedule.fired", "scheduler", {
          actionId: action._id,
          actionName: action.name,
          success,
          result: actionResult,
          error: actionError,
        });

        // Complete the run
        await convex.mutation(api.scheduledActions.completeRun, {
          serverToken: SERVER_TOKEN,
          runId,
          actionId: action._id,
          success,
          result: actionResult,
          error: actionError,
        });

        console.log(`[cron] Action "${action.name}" ${success ? "completed" : "failed"}`);
      } catch (err: any) {
        console.error(`[cron] Failed to execute action ${action._id}:`, err.message);
      }
    }
  } catch (err: any) {
    if (!err.message?.includes("Could not find")) {
      console.error("[cron] Schedule poll error:", err.message);
    }
  }
}

// ── Timer executor ──────────────────────────────────────────────────

async function executeTimers() {
  try {
    const now = Date.now();
    const dueTimers = await convex.query(api.agentTimers.listDue, {
      serverToken: SERVER_TOKEN,
      now,
    });

    for (const timer of dueTimers) {
      try {
        // Mark as fired atomically
        const firedTimer = await convex.mutation(api.agentTimers.markFired, {
          serverToken: SERVER_TOKEN,
          timerId: timer._id,
        });
        if (!firedTimer) continue;

        const convexClient = new AgentConvexClient(CONVEX_URL, SERVER_TOKEN);
        console.log(`[timer] Firing timer "${timer.label}" (${timer._id})`);

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
          case "run_prompt":
            // These would create a conversation/job — mark as done for now
            break;
        }

        // Emit event
        await convexClient.emitEvent(timer.agentId, "timer.fired", "timer", {
          timerId: timer._id,
          label: timer.label,
          actionType: timer.action.type,
        });

        console.log(`[timer] Timer "${timer.label}" fired successfully`);
      } catch (err: any) {
        console.error(`[timer] Failed to fire timer ${timer._id}:`, err.message);
      }
    }
  } catch (err: any) {
    if (!err.message?.includes("Could not find")) {
      console.error("[timer] Timer poll error:", err.message);
    }
  }
}

// ── Automation executor (event-driven) ──────────────────────────────

async function processAutomations(
  convexClient: AgentConvexClient,
  agentId: string,
  event: string,
  payload: any
) {
  try {
    const automations = await convexClient.listAutomations(agentId);
    const matching = (automations as any[]).filter(
      (a: any) => a.isActive && a.trigger.event === event
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
            case "create_note": {
              await convexClient.createNote(config.tabId, agentId, {
                title: config.title,
                content: config.content,
              });
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

setInterval(pollForJobs, POLL_INTERVAL_MS);
console.log(`[server] Polling for jobs every ${POLL_INTERVAL_MS}ms`);

// Poll for scheduled actions every 10 seconds
const SCHEDULE_POLL_MS = parseInt(process.env.SCHEDULE_POLL_MS ?? "10000", 10);
setInterval(executeScheduledActions, SCHEDULE_POLL_MS);
console.log(`[server] Polling for scheduled actions every ${SCHEDULE_POLL_MS}ms`);

// Poll for timers every 5 seconds
const TIMER_POLL_MS = parseInt(process.env.TIMER_POLL_MS ?? "5000", 10);
setInterval(executeTimers, TIMER_POLL_MS);
console.log(`[server] Polling for timers every ${TIMER_POLL_MS}ms`);

// ── Start server ─────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3001", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[server] Agent server listening on http://localhost:${info.port}`);
});
