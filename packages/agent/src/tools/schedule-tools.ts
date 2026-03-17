import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

export function createScheduleTools(
  convexClient: AgentConvexClient,
  agentId: string
) {
  const createSchedule = tool(
    "create_schedule",
    `Create a scheduled/recurring action. The agent will automatically execute the specified action on the given schedule.

Supports:
- Interval: "every 5m", "every 1h", "every 1d"
- Cron expressions: "0 9 * * 1" (every Monday at 9am)
- One-time: runs once then completes

Action types:
- run_prompt: Run a prompt (agent processes it autonomously)
- send_email: Send an email on schedule
- create_task: Create a task on schedule
- fire_webhook: Fire a webhook on schedule`,
    {
      name: z.string().describe("Name for this scheduled action (e.g. 'Daily summary', 'Weekly report')"),
      description: z.string().optional().describe("What this schedule does"),
      schedule: z.string().describe("Schedule expression: 'every 5m', 'every 1h', 'every 1d', or cron like '0 9 * * 1'"),
      schedule_type: z.enum(["interval", "cron", "once"]).describe("Type of schedule"),
      action_type: z.enum(["run_prompt", "send_email", "create_task", "fire_webhook"]).describe("What action to perform"),
      action_config: z.record(z.any()).describe("Configuration for the action. For run_prompt: {prompt: '...'}. For send_email: {to, subject, body}. For create_task: {tabId, title, description}. For fire_webhook: {url, payload}."),
      max_runs: z.number().optional().describe("Stop after this many runs (omit for unlimited)"),
    },
    async (input) => {
      try {
        const actionId = await convexClient.createSchedule(agentId, {
          name: input.name,
          description: input.description,
          schedule: input.schedule,
          scheduleType: input.schedule_type,
          action: {
            type: input.action_type as any,
            config: input.action_config,
          },
          maxRuns: input.max_runs,
        });

        return {
          content: [{
            type: "text" as const,
            text: `Scheduled action "${input.name}" created (ID: ${actionId}). It will ${input.schedule_type === "once" ? "run once" : `run ${input.schedule}`}. Action: ${input.action_type}.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to create schedule: ${err.message}`,
          }],
        };
      }
    }
  );

  const listSchedules = tool(
    "list_schedules",
    "List all scheduled actions for this agent, including their status, next run time, and run count.",
    {},
    async () => {
      try {
        const schedules = await convexClient.listSchedules(agentId);
        if (schedules.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No scheduled actions found.",
            }],
          };
        }

        const list = schedules.map((s: any) => {
          const nextRun = s.nextRunAt ? new Date(s.nextRunAt).toISOString() : "N/A";
          return `- "${s.name}" [${s.status}] — ${s.schedule} (${s.scheduleType}) — ${s.runCount} runs — Next: ${nextRun} — ID: ${s._id}`;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Scheduled actions:\n${list.join("\n")}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to list schedules: ${err.message}`,
          }],
        };
      }
    }
  );

  const pauseSchedule = tool(
    "pause_schedule",
    "Pause a scheduled action. It will stop running until resumed.",
    {
      action_id: z.string().describe("ID of the scheduled action to pause"),
    },
    async (input) => {
      try {
        await convexClient.pauseSchedule(input.action_id);
        return {
          content: [{
            type: "text" as const,
            text: `Schedule paused successfully.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to pause schedule: ${err.message}`,
          }],
        };
      }
    }
  );

  const resumeSchedule = tool(
    "resume_schedule",
    "Resume a paused scheduled action.",
    {
      action_id: z.string().describe("ID of the scheduled action to resume"),
    },
    async (input) => {
      try {
        await convexClient.resumeSchedule(input.action_id);
        return {
          content: [{
            type: "text" as const,
            text: `Schedule resumed successfully.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to resume schedule: ${err.message}`,
          }],
        };
      }
    }
  );

  const deleteSchedule = tool(
    "delete_schedule",
    "Delete a scheduled action permanently.",
    {
      action_id: z.string().describe("ID of the scheduled action to delete"),
    },
    async (input) => {
      try {
        await convexClient.deleteSchedule(input.action_id);
        return {
          content: [{
            type: "text" as const,
            text: `Schedule deleted successfully.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to delete schedule: ${err.message}`,
          }],
        };
      }
    }
  );

  return [createSchedule, listSchedules, pauseSchedule, resumeSchedule, deleteSchedule];
}
