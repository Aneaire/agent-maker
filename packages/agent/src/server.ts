import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { ProcessManager } from "./process-manager.js";
import { runCreator } from "./run-creator.js";
import { runApiEndpoint } from "./run-api-endpoint.js";
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

// ── Start server ─────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3001", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[server] Agent server listening on http://localhost:${info.port}`);
});
