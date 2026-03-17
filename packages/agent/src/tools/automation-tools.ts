import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

export function createAutomationTools(
  convexClient: AgentConvexClient,
  agentId: string
) {
  const createAutomation = tool(
    "create_automation",
    `Create an automation rule: when an event happens, automatically perform actions.

Available trigger events:
- task.created, task.updated, task.deleted
- note.created, note.updated
- email.sent, email.failed
- webhook.received
- schedule.fired
- memory.stored
- document.ready
- agent_message.received

Available actions (can chain multiple):
- send_email: {to, subject, body} — template variables like {{event.title}} supported
- create_task: {tabId, title, description, status, priority}
- update_task: {taskId, status, priority}
- create_note: {tabId, title, content}
- fire_webhook: {url, payload}
- store_memory: {content, category}
- run_prompt: {prompt} — agent processes this prompt
- trigger_agent: {agentId, message} — send message to another agent
- delay: {ms} — wait before next action (max 3600000ms = 1hr)

Example: When a task is marked "done" → send email summary + create note`,
    {
      name: z.string().describe("Name for this automation (e.g. 'Task completion notifier')"),
      description: z.string().optional().describe("What this automation does"),
      trigger_event: z.string().describe("Event that triggers this automation (e.g. 'task.updated')"),
      trigger_filter: z.record(z.any()).optional().describe("Optional filter conditions (e.g. {status: 'done'} to only trigger when task is marked done)"),
      actions: z.array(z.object({
        type: z.enum([
          "send_email", "create_task", "update_task", "create_note",
          "fire_webhook", "store_memory", "run_prompt", "trigger_agent", "delay"
        ]),
        config: z.record(z.any()),
      })).describe("Actions to perform in order"),
    },
    async (input) => {
      try {
        const automationId = await convexClient.createAutomation(agentId, {
          name: input.name,
          description: input.description,
          trigger: {
            event: input.trigger_event,
            filter: input.trigger_filter,
          },
          actions: input.actions,
        });

        return {
          content: [{
            type: "text" as const,
            text: `Automation "${input.name}" created (ID: ${automationId}). Trigger: ${input.trigger_event} → ${input.actions.length} action(s).`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to create automation: ${err.message}`,
          }],
        };
      }
    }
  );

  const listAutomations = tool(
    "list_automations",
    "List all automation rules for this agent.",
    {},
    async () => {
      try {
        const automations = await convexClient.listAutomations(agentId);
        if (automations.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No automations found.",
            }],
          };
        }

        const list = automations.map((a: any) => {
          const status = a.isActive ? "active" : "paused";
          return `- "${a.name}" [${status}] — On: ${a.trigger.event} → ${a.actions.length} action(s) — ${a.runCount} runs — ID: ${a._id}`;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Automations:\n${list.join("\n")}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to list automations: ${err.message}`,
          }],
        };
      }
    }
  );

  const deleteAutomation = tool(
    "delete_automation",
    "Delete an automation rule.",
    {
      automation_id: z.string().describe("ID of the automation to delete"),
    },
    async (input) => {
      try {
        await convexClient.deleteAutomation(input.automation_id);
        return {
          content: [{
            type: "text" as const,
            text: `Automation deleted successfully.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to delete automation: ${err.message}`,
          }],
        };
      }
    }
  );

  return [createAutomation, listAutomations, deleteAutomation];
}
