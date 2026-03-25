import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";

/**
 * Convex-native automation processor.
 *
 * Replaces the HTTP-based dispatch.notifyEvent approach. Instead of calling
 * the agent server (which fails from Convex cloud → localhost), this runs
 * automation matching and simple DB actions directly inside Convex.
 *
 * Actions that need HTTP (send_email, fire_webhook) are delegated to an
 * internalAction. run_prompt creates a job the agent server picks up via polling.
 */

// ── Main entry point: called from mutations (tabTasks, etc.) ────────

export const processEvent = internalMutation({
  args: {
    agentId: v.id("agents"),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // 1. Find matching active automations for this agent + event
    const automations = await ctx.db
      .query("automations")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const matching = automations.filter(
      (a) => a.isActive && a.trigger.event === args.event
    );

    if (matching.length === 0) return;

    for (const automation of matching) {
      // 2. Check filter conditions
      if (automation.trigger.filter) {
        const filter = automation.trigger.filter as Record<string, any>;
        let passes = true;
        for (const [key, value] of Object.entries(filter)) {
          if ((args.payload as any)?.[key] !== value) {
            passes = false;
            break;
          }
        }
        if (!passes) continue;
      }

      // 3. Create a run record
      const runId = await ctx.db.insert("automationRuns", {
        automationId: automation._id,
        agentId: args.agentId,
        status: "running",
        triggerEvent: args.event,
        triggerPayload: args.payload,
        startedAt: Date.now(),
      });

      // 4. Process each action
      const actionsExecuted: Array<{
        type: string;
        status: "completed" | "failed" | "skipped";
        result?: string;
        error?: string;
      }> = [];

      for (const action of automation.actions) {
        try {
          // Template variable replacement
          const configStr = JSON.stringify(action.config ?? {}).replace(
            /\{\{event\.(\w+)\}\}/g,
            (_: string, key: string) =>
              (args.payload as any)?.[key]?.toString() ?? ""
          );
          const config = JSON.parse(configStr);

          switch (action.type) {
            // ── DB-only actions (run directly in this mutation) ──────

            case "create_note": {
              let noteTabId = config.tabId;
              if (!noteTabId) {
                // Auto-resolve: find first notes tab for this agent
                const tabs = await ctx.db
                  .query("sidebarTabs")
                  .withIndex("by_agent", (q) =>
                    q.eq("agentId", args.agentId)
                  )
                  .collect();
                const notesTab = tabs.find((t) => t.type === "notes");
                noteTabId = notesTab?._id;
              }
              if (noteTabId) {
                const noteId = await ctx.db.insert("tabNotes", {
                  tabId: noteTabId,
                  agentId: args.agentId,
                  title: (config.title ?? "Automation Note").substring(0, 500),
                  content: (config.content ?? "").substring(0, 100000),
                  updatedAt: Date.now(),
                });
                actionsExecuted.push({
                  type: "create_note",
                  status: "completed",
                  result: `Note created: ${noteId}`,
                });
              } else {
                actionsExecuted.push({
                  type: "create_note",
                  status: "failed",
                  error: "No notes tab found for agent",
                });
              }
              break;
            }

            case "create_task": {
              let taskTabId = config.tabId;
              if (!taskTabId) {
                const tabs = await ctx.db
                  .query("sidebarTabs")
                  .withIndex("by_agent", (q) =>
                    q.eq("agentId", args.agentId)
                  )
                  .collect();
                const tasksTab = tabs.find((t) => t.type === "tasks");
                taskTabId = tasksTab?._id;
              }
              if (taskTabId) {
                const existing = await ctx.db
                  .query("tabTasks")
                  .withIndex("by_tab", (q) => q.eq("tabId", taskTabId))
                  .collect();
                const maxOrder = existing.reduce(
                  (max, t) => Math.max(max, t.sortOrder),
                  -1
                );
                const taskId = await ctx.db.insert("tabTasks", {
                  tabId: taskTabId,
                  agentId: args.agentId,
                  title: (config.title ?? "Automation Task").substring(0, 500),
                  description: config.description?.substring(0, 5000),
                  status: config.status ?? "todo",
                  priority: config.priority,
                  sortOrder: maxOrder + 1,
                });
                actionsExecuted.push({
                  type: "create_task",
                  status: "completed",
                  result: `Task created: ${taskId}`,
                });
              } else {
                actionsExecuted.push({
                  type: "create_task",
                  status: "failed",
                  error: "No tasks tab found for agent",
                });
              }
              break;
            }

            case "update_task": {
              if (config.taskId) {
                const task = await ctx.db.get(config.taskId);
                if (task) {
                  const patch: Record<string, any> = {};
                  if (config.title) patch.title = config.title.substring(0, 500);
                  if (config.description)
                    patch.description = config.description.substring(0, 5000);
                  if (config.status) patch.status = config.status;
                  if (config.priority) patch.priority = config.priority;
                  await ctx.db.patch(config.taskId, patch);
                  actionsExecuted.push({
                    type: "update_task",
                    status: "completed",
                    result: `Task updated: ${config.taskId}`,
                  });
                } else {
                  actionsExecuted.push({
                    type: "update_task",
                    status: "failed",
                    error: "Task not found",
                  });
                }
              }
              break;
            }

            case "store_memory": {
              const memId = await ctx.db.insert("memories", {
                agentId: args.agentId,
                content: (config.content ?? "").substring(0, 10000),
                category: config.category,
              });
              actionsExecuted.push({
                type: "store_memory",
                status: "completed",
                result: `Memory stored: ${memId}`,
              });
              break;
            }

            case "run_prompt": {
              // Create conversation + job — agent server picks it up via polling
              const agent = await ctx.db.get(args.agentId);
              if (!agent) {
                actionsExecuted.push({
                  type: "run_prompt",
                  status: "failed",
                  error: "Agent not found",
                });
                break;
              }

              const conversationId = await ctx.db.insert("conversations", {
                agentId: args.agentId,
                userId: agent.userId,
                title: `Automation: ${automation.name}`,
              });

              await ctx.db.insert("messages", {
                conversationId,
                role: "user",
                content: config.prompt ?? "No prompt provided",
                status: "done",
              });

              const assistantMessageId = await ctx.db.insert("messages", {
                conversationId,
                role: "assistant",
                content: "",
                status: "pending",
              });

              const jobId = await ctx.db.insert("agentJobs", {
                agentId: args.agentId,
                conversationId,
                messageId: assistantMessageId,
                userId: agent.userId,
                status: "pending",
              });

              // Push-notify agent server about the new job
              await ctx.scheduler.runAfter(
                0,
                internal.dispatch.notifyJobCreated,
                { jobId }
              );

              actionsExecuted.push({
                type: "run_prompt",
                status: "completed",
                result: `Job created: ${jobId}`,
              });
              break;
            }

            // ── HTTP-requiring actions → delegate to internalAction ──

            case "send_email":
            case "fire_webhook":
            case "trigger_agent": {
              // Schedule an internalAction for HTTP-based actions
              await ctx.scheduler.runAfter(
                0,
                internal.processAutomation.executeHttpAction,
                {
                  agentId: args.agentId,
                  automationName: automation.name,
                  actionType: action.type,
                  config,
                  event: args.event,
                  payload: args.payload,
                }
              );
              actionsExecuted.push({
                type: action.type,
                status: "completed",
                result: "Delegated to HTTP executor",
              });
              break;
            }

            case "delay": {
              // Delays don't make sense in a mutation context — skip
              actionsExecuted.push({
                type: "delay",
                status: "skipped",
                result: "Delays not supported in Convex-native processing",
              });
              break;
            }

            default: {
              actionsExecuted.push({
                type: action.type,
                status: "skipped",
                error: `Unknown action type: ${action.type}`,
              });
            }
          }
        } catch (err: any) {
          actionsExecuted.push({
            type: action.type,
            status: "failed",
            error: err.message,
          });
        }
      }

      // 5. Complete the run record
      const now = Date.now();
      const allSucceeded = actionsExecuted.every(
        (a) => a.status === "completed" || a.status === "skipped"
      );
      await ctx.db.patch(runId, {
        status: allSucceeded ? "completed" : "failed",
        actionsExecuted,
        completedAt: now,
        duration: now - (await ctx.db.get(runId))!.startedAt,
      });

      // 6. Update automation run count
      await ctx.db.patch(automation._id, {
        runCount: automation.runCount + 1,
        lastRunAt: now,
      });

      console.log(
        `[automation] "${automation.name}" triggered by ${args.event} — ${actionsExecuted.length} actions`
      );
    }
  },
});

// ── Schedule executor (Convex-native, replaces dispatch.fireSchedule) ────

function parseIntervalMs(interval: string): number {
  const match = interval.match(/^every\s+(\d+)\s*(s|m|h|d)$/i);
  if (!match) throw new Error(`Invalid interval: "${interval}"`);
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] ?? 60000);
}

function computeNextRun(schedule: string, scheduleType: string, now: number): number {
  if (scheduleType === "interval") return now + parseIntervalMs(schedule);
  if (scheduleType === "once") return now;
  return now + 60000; // basic cron fallback
}

export const fireSchedule = internalMutation({
  args: { actionId: v.id("scheduledActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action || action.status !== "active") return;

    const now = Date.now();

    // Create run record
    const runId = await ctx.db.insert("scheduledActionRuns", {
      actionId: args.actionId,
      agentId: action.agentId,
      status: "running",
      startedAt: now,
    });

    let success = true;
    let actionResult = "";
    let actionError: string | undefined;

    try {
      const config = (action.action.config ?? {}) as Record<string, any>;

      switch (action.action.type) {
        case "run_prompt": {
          const agent = await ctx.db.get(action.agentId);
          if (!agent) throw new Error("Agent not found");

          const conversationId = await ctx.db.insert("conversations", {
            agentId: action.agentId,
            userId: agent.userId,
            title: `Schedule: ${action.name}`,
          });

          await ctx.db.insert("messages", {
            conversationId,
            role: "user",
            content: config.prompt ?? "No prompt provided",
            status: "done",
          });

          const assistantMessageId = await ctx.db.insert("messages", {
            conversationId,
            role: "assistant",
            content: "",
            status: "pending",
          });

          const jobId = await ctx.db.insert("agentJobs", {
            agentId: action.agentId,
            conversationId,
            messageId: assistantMessageId,
            userId: agent.userId,
            status: "pending",
          });

          await ctx.scheduler.runAfter(0, internal.dispatch.notifyJobCreated, { jobId });
          actionResult = `Prompt dispatched: ${config.prompt?.substring(0, 100) ?? "N/A"}`;
          break;
        }

        case "create_task": {
          let taskTabId = config.tabId;
          if (!taskTabId) {
            const tabs = await ctx.db
              .query("sidebarTabs")
              .withIndex("by_agent", (q) => q.eq("agentId", action.agentId))
              .collect();
            const tasksTab = tabs.find((t) => t.type === "tasks");
            taskTabId = tasksTab?._id;
          }
          if (taskTabId) {
            const existing = await ctx.db
              .query("tabTasks")
              .withIndex("by_tab", (q) => q.eq("tabId", taskTabId))
              .collect();
            const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1);
            await ctx.db.insert("tabTasks", {
              tabId: taskTabId,
              agentId: action.agentId,
              title: (config.title ?? "Scheduled Task").substring(0, 500),
              description: config.description?.substring(0, 5000),
              status: config.status ?? "todo",
              priority: config.priority,
              sortOrder: maxOrder + 1,
            });
            actionResult = `Task "${config.title}" created`;
          } else {
            throw new Error("No tasks tab found");
          }
          break;
        }

        case "send_email":
        case "fire_webhook": {
          // Delegate HTTP actions to internalAction
          await ctx.scheduler.runAfter(0, internal.processAutomation.executeHttpAction, {
            agentId: action.agentId,
            automationName: action.name,
            actionType: action.action.type,
            config,
            event: "schedule.fired",
            payload: { scheduleName: action.name, scheduleId: args.actionId },
          });
          actionResult = `${action.action.type} delegated to HTTP executor`;
          break;
        }

        default:
          actionResult = `Unknown action type: ${action.action.type}`;
      }
    } catch (err: any) {
      success = false;
      actionError = err.message;
      console.error(`[schedule] Action "${action.name}" failed:`, err.message);
    }

    // Complete the run
    await ctx.db.patch(runId, {
      status: success ? "completed" : "failed",
      result: actionResult,
      error: actionError,
      completedAt: Date.now(),
      duration: Date.now() - now,
    });

    // Update schedule run count and compute next run
    const newRunCount = action.runCount + 1;
    const isComplete =
      action.scheduleType === "once" ||
      (action.maxRuns !== undefined && newRunCount >= action.maxRuns);

    const nextRunAt = isComplete
      ? undefined
      : computeNextRun(action.schedule, action.scheduleType, Date.now());

    await ctx.db.patch(args.actionId, {
      lastRunAt: Date.now(),
      runCount: newRunCount,
      status: isComplete ? "completed" : action.status,
      nextRunAt,
    });

    // Emit schedule.fired event
    await ctx.db.insert("agentEvents", {
      agentId: action.agentId,
      event: "schedule.fired",
      source: "scheduler",
      payload: {
        actionId: args.actionId,
        actionName: action.name,
        actionType: action.action.type,
        success,
        result: actionResult,
        error: actionError,
      },
      createdAt: Date.now(),
    });

    // Schedule next run if not complete
    if (!isComplete && nextRunAt) {
      const delayMs = Math.max(0, nextRunAt - Date.now());
      await ctx.scheduler.runAfter(delayMs, internal.processAutomation.fireSchedule, {
        actionId: args.actionId,
      });
    }

    console.log(
      `[schedule] "${action.name}" ${success ? "completed" : "failed"}${
        isComplete ? " (final run)" : ` (next in ${nextRunAt ? Math.round((nextRunAt - Date.now()) / 1000) : "?"}s)`
      }`
    );
  },
});

// ── Timer executor (Convex-native, replaces dispatch.fireTimer) ─────

export const fireTimer = internalMutation({
  args: { timerId: v.id("agentTimers") },
  handler: async (ctx, args) => {
    const timer = await ctx.db.get(args.timerId);
    if (!timer || timer.status !== "waiting") return;

    // Mark as fired
    await ctx.db.patch(args.timerId, {
      status: "fired",
      firedAt: Date.now(),
    });

    const agent = await ctx.db.get(timer.agentId);
    if (!agent) return;

    // Execute the timer action based on type
    const config = (timer.action.config ?? {}) as Record<string, any>;
    const actionType = timer.action.type;
    let result = "";

    try {
      switch (actionType) {
        case "run_prompt": {
          const prompt = config.prompt ?? "Timer fired";
          const conversationId = await ctx.db.insert("conversations", {
            agentId: timer.agentId,
            userId: agent.userId,
            title: `Timer: ${timer.label ?? "Unnamed"}`,
          });

          await ctx.db.insert("messages", {
            conversationId,
            role: "user",
            content: prompt,
            status: "done",
          });

          const assistantMessageId = await ctx.db.insert("messages", {
            conversationId,
            role: "assistant",
            content: "",
            status: "pending",
          });

          const jobId = await ctx.db.insert("agentJobs", {
            agentId: timer.agentId,
            conversationId,
            messageId: assistantMessageId,
            userId: agent.userId,
            status: "pending",
          });

          await ctx.scheduler.runAfter(0, internal.dispatch.notifyJobCreated, { jobId });
          result = `Prompt dispatched: ${prompt.substring(0, 100)}`;
          break;
        }

        case "create_task": {
          const tabs = await ctx.db
            .query("sidebarTabs")
            .withIndex("by_agent", (q) => q.eq("agentId", timer.agentId))
            .collect();
          const tasksTab = tabs.find((t) => t.type === "tasks");
          if (tasksTab) {
            const existing = await ctx.db
              .query("tabTasks")
              .withIndex("by_tab", (q) => q.eq("tabId", tasksTab._id))
              .collect();
            const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1);
            await ctx.db.insert("tabTasks", {
              tabId: tasksTab._id,
              agentId: timer.agentId,
              title: (config.title ?? `Timer: ${timer.label}`).substring(0, 500),
              description: config.description,
              status: "todo",
              sortOrder: maxOrder + 1,
            });
            result = `Task created: ${config.title}`;
          }
          break;
        }

        default:
          result = `Timer action ${actionType} not handled natively`;
      }
    } catch (err: any) {
      console.error(`[timer] "${timer.label}" failed:`, err.message);
    }

    // Emit timer.fired event
    await ctx.db.insert("agentEvents", {
      agentId: timer.agentId,
      event: "timer.fired",
      source: "timer",
      payload: {
        timerId: args.timerId,
        label: timer.label,
        actionType,
        result,
      },
      createdAt: Date.now(),
    });

    console.log(`[timer] "${timer.label}" fired — ${result}`);
  },
});

// ── Internal query: get tool config for an agent ────────────────────

export const getToolConfig = internalQuery({
  args: { agentId: v.id("agents"), toolSetName: v.string() },
  handler: async (ctx, args) => {
    const configs = await ctx.db
      .query("agentToolConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const match = configs.find((c) => c.toolSetName === args.toolSetName);
    return match?.config ?? null;
  },
});

// ── HTTP action executor (for send_email, fire_webhook) ─────────────
// These actions require external HTTP calls (Resend API, webhook URLs).
// trigger_agent is handled as a Convex mutation instead.

export const executeHttpAction = internalAction({
  args: {
    agentId: v.string(),
    automationName: v.string(),
    actionType: v.string(),
    config: v.any(),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const config = args.config as Record<string, any>;

    try {
      switch (args.actionType) {
        case "send_email": {
          // Get email config from DB (Resend API key, from address)
          const emailConfig = await ctx.runQuery(
            internal.processAutomation.getToolConfig,
            { agentId: args.agentId as any, toolSetName: "email" }
          );

          if (!emailConfig || !(emailConfig as any).resendApiKey) {
            console.error(`[automation] send_email: No email config for agent ${args.agentId}`);
            break;
          }

          const ec = emailConfig as any;
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ec.resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: ec.fromName
                ? `${ec.fromName} <${ec.fromEmail}>`
                : ec.fromEmail,
              to: Array.isArray(config.to) ? config.to : [config.to],
              subject: config.subject,
              html: config.body,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error(`[automation] Resend API error: ${res.status} ${errText}`);
          } else {
            console.log(`[automation] Email sent to ${config.to}`);
          }
          break;
        }

        case "fire_webhook": {
          const res = await fetch(config.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: `automation.${args.event}`,
              timestamp: new Date().toISOString(),
              data: config.payload ?? args.payload,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            console.error(`[automation] Webhook to ${config.url} failed: ${res.status}`);
          }
          break;
        }

        case "trigger_agent": {
          // Use Convex mutation directly — no need for HTTP to agent server
          const SERVER_TOKEN = process.env.AGENT_SERVER_TOKEN ?? "";
          await ctx.runMutation(api.agentMessages.send, {
            serverToken: SERVER_TOKEN,
            fromAgentId: args.agentId as any,
            toAgentId: config.agentId as any,
            content: config.message ?? `Triggered by ${args.event}`,
            context: { triggeredBy: args.event, payload: args.payload },
          });
          console.log(`[automation] Agent message sent from ${args.agentId} to ${config.agentId}`);
          break;
        }
      }
    } catch (err: any) {
      console.error(
        `[automation] HTTP action ${args.actionType} failed:`,
        err.message
      );
    }
  },
});
