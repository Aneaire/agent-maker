import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
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

// ── HTTP action executor (for send_email, fire_webhook, trigger_agent) ──

export const executeHttpAction = internalAction({
  args: {
    agentId: v.string(),
    automationName: v.string(),
    actionType: v.string(),
    config: v.any(),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (_ctx, args) => {
    const config = args.config as Record<string, any>;
    const AGENT_SERVER_TOKEN = process.env.AGENT_SERVER_TOKEN ?? "";
    const AGENT_SERVER_URL =
      process.env.AGENT_SERVER_URL ?? "http://localhost:3001";

    try {
      switch (args.actionType) {
        case "send_email": {
          // For email, we need to call the agent server which has the Resend config
          const res = await fetch(`${AGENT_SERVER_URL}/dispatch/event`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${AGENT_SERVER_TOKEN}`,
            },
            body: JSON.stringify({
              agentId: args.agentId,
              event: args.event,
              payload: args.payload,
              singleAction: {
                type: "send_email",
                config,
              },
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            console.error(
              `[automation] send_email HTTP failed: ${res.status}`
            );
          }
          break;
        }

        case "fire_webhook": {
          await fetch(config.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: `automation.${args.event}`,
              timestamp: new Date().toISOString(),
              data: config.payload ?? args.payload,
            }),
            signal: AbortSignal.timeout(15000),
          });
          break;
        }

        case "trigger_agent": {
          // Send agent message via agent server
          const res = await fetch(`${AGENT_SERVER_URL}/dispatch/event`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${AGENT_SERVER_TOKEN}`,
            },
            body: JSON.stringify({
              agentId: args.agentId,
              event: args.event,
              payload: args.payload,
              singleAction: {
                type: "trigger_agent",
                config,
              },
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            console.error(
              `[automation] trigger_agent HTTP failed: ${res.status}`
            );
          }
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
