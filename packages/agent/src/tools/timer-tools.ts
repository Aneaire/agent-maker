import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

export function createTimerTools(
  convexClient: AgentConvexClient,
  agentId: string,
  conversationId?: string
) {
  const setTimer = tool(
    "set_timer",
    `Set a delayed action — "do X after Y time". Useful for follow-ups, reminders, and drip sequences.

Examples:
- "Remind me in 30 minutes" → delay 1800000ms, action: send_message
- "Follow up via email in 2 hours" → delay 7200000ms, action: send_email
- "Create a review task tomorrow" → delay 86400000ms, action: create_task

Action types:
- send_message: Send a message in the current conversation (config: {content})
- send_email: Send an email (config: {to, subject, body})
- create_task: Create a task (config: {tabId, title, description})
- fire_webhook: Fire a webhook (config: {url, payload})
- run_prompt: Agent processes a prompt (config: {prompt})`,
    {
      label: z.string().describe("Label for this timer (e.g. 'Follow up with John')"),
      delay_minutes: z.number().describe("Delay in minutes from now (e.g. 30 for 30 minutes, 1440 for 1 day)"),
      action_type: z.enum(["send_message", "send_email", "create_task", "fire_webhook", "run_prompt"]).describe("What to do when the timer fires"),
      action_config: z.record(z.any()).describe("Configuration for the action"),
    },
    async (input) => {
      try {
        const delayMs = Math.min(input.delay_minutes * 60000, 30 * 24 * 60 * 60 * 1000); // Max 30 days

        const timerId = await convexClient.createTimer(agentId, {
          conversationId,
          label: input.label,
          delayMs,
          action: {
            type: input.action_type,
            config: input.action_config,
          },
        });

        const fireTime = new Date(Date.now() + delayMs);
        return {
          content: [{
            type: "text" as const,
            text: `Timer "${input.label}" set. Will fire at ${fireTime.toISOString()} (in ${input.delay_minutes} minutes). Action: ${input.action_type}. ID: ${timerId}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to set timer: ${err.message}`,
          }],
        };
      }
    }
  );

  const listTimers = tool(
    "list_timers",
    "List all active (waiting) timers for this agent.",
    {},
    async () => {
      try {
        const timers = await convexClient.listTimers(agentId);
        if (timers.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No active timers.",
            }],
          };
        }

        const list = timers.map((t: any) => {
          const fireAt = new Date(t.fireAt).toISOString();
          const minutesLeft = Math.round((t.fireAt - Date.now()) / 60000);
          return `- "${t.label}" — fires at ${fireAt} (${minutesLeft}min from now) — ${t.action.type} — ID: ${t._id}`;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Active timers:\n${list.join("\n")}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to list timers: ${err.message}`,
          }],
        };
      }
    }
  );

  const cancelTimer = tool(
    "cancel_timer",
    "Cancel a waiting timer before it fires.",
    {
      timer_id: z.string().describe("ID of the timer to cancel"),
    },
    async (input) => {
      try {
        await convexClient.cancelTimer(input.timer_id);
        return {
          content: [{
            type: "text" as const,
            text: `Timer cancelled successfully.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to cancel timer: ${err.message}`,
          }],
        };
      }
    }
  );

  return [setTimer, listTimers, cancelTimer];
}
