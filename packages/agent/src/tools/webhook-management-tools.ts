import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

export function createWebhookManagementTools(
  convexClient: AgentConvexClient,
  agentId: string
) {
  const fireWebhook = tool(
    "fire_webhook",
    `Fire an outgoing webhook to an external URL. Sends a POST request with JSON payload.
Useful for integrating with external services (Slack, Discord, Zapier, n8n, etc.).`,
    {
      url: z.string().describe("The webhook URL to send the POST request to"),
      payload: z.record(z.any()).describe("JSON payload to send"),
      event_name: z.string().optional().describe("Optional event name to include in the payload"),
    },
    async (input) => {
      try {
        const body = {
          event: input.event_name ?? "agent.webhook",
          timestamp: new Date().toISOString(),
          agentId,
          data: input.payload,
        };

        const res = await fetch(input.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        // Emit event
        await convexClient.emitEvent(agentId, "webhook.fired", "webhook_tools", {
          url: input.url,
          event: input.event_name,
          payload: input.payload,
          status: res.status,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return {
            content: [{
              type: "text" as const,
              text: `Webhook sent but received status ${res.status}: ${text.substring(0, 200)}`,
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: `Webhook fired successfully to ${input.url} (status: ${res.status}).`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to fire webhook: ${err.message}`,
          }],
        };
      }
    }
  );

  const listEvents = tool(
    "list_events",
    "List recent events in the agent's event bus. Shows what has happened recently (tasks created, emails sent, webhooks fired, etc.).",
    {
      event_type: z.string().optional().describe("Filter by event type (e.g. 'task.created', 'email.sent'). Omit to see all."),
      limit: z.number().optional().describe("Number of events to return (default 20, max 50)"),
    },
    async (input) => {
      try {
        const events = await convexClient.listEvents(agentId, input.event_type, input.limit);
        if (events.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: input.event_type
                ? `No "${input.event_type}" events found.`
                : "No events recorded yet.",
            }],
          };
        }

        const list = events.map((e: any) => {
          const time = new Date(e.createdAt).toISOString();
          const payload = JSON.stringify(e.payload).substring(0, 100);
          return `- [${time}] ${e.event} (${e.source}): ${payload}`;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Recent events:\n${list.join("\n")}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to list events: ${err.message}`,
          }],
        };
      }
    }
  );

  return [fireWebhook, listEvents];
}
