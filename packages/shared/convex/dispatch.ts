import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Push-based dispatch system.
 *
 * Instead of the agent server polling every 2-10s, mutations that create
 * jobs/timers/schedules now schedule a Convex action that immediately
 * notifies the agent server via HTTP. This gives sub-second latency for
 * jobs and exact-time execution for timers/schedules.
 *
 * The agent server keeps a low-frequency fallback poll (30s) as a safety net.
 */

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL ?? "http://localhost:3001";
const AGENT_SERVER_TOKEN = process.env.AGENT_SERVER_TOKEN ?? "";

// ── Job Dispatch ────────────────────────────────────────────────────
// Called immediately after a job is inserted into agentJobs

export const notifyJobCreated = internalAction({
  args: { jobId: v.string() },
  handler: async (_ctx, args) => {
    try {
      const res = await fetch(`${AGENT_SERVER_URL}/dispatch/job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AGENT_SERVER_TOKEN}`,
        },
        body: JSON.stringify({ jobId: args.jobId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.error(`[dispatch] Job notify failed: ${res.status}`);
      }
    } catch (err: any) {
      // Non-fatal — fallback poll will catch it
      console.error(`[dispatch] Job notify error: ${err.message}`);
    }
  },
});

// ── Timer Dispatch ──────────────────────────────────────────────────
// Scheduled at fireAt time when a timer is created

export const fireTimer = internalAction({
  args: { timerId: v.string() },
  handler: async (_ctx, args) => {
    try {
      const res = await fetch(`${AGENT_SERVER_URL}/dispatch/timer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AGENT_SERVER_TOKEN}`,
        },
        body: JSON.stringify({ timerId: args.timerId }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error(`[dispatch] Timer fire failed: ${res.status}`);
      }
    } catch (err: any) {
      console.error(`[dispatch] Timer fire error: ${err.message}`);
    }
  },
});

// ── Event Dispatch ──────────────────────────────────────────────────
// Called when a task/note is created/updated/deleted from the UI
// so the agent server can emit events and process automations

export const notifyEvent = internalAction({
  args: {
    agentId: v.string(),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (_ctx, args) => {
    try {
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
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.error(`[dispatch] Event notify failed: ${res.status}`);
      }
    } catch (err: any) {
      // Non-fatal — event will still be in logs
      console.error(`[dispatch] Event notify error: ${err.message}`);
    }
  },
});

// ── Schedule Dispatch ───────────────────────────────────────────────
// Scheduled at nextRunAt time when a schedule is created or completed

export const fireSchedule = internalAction({
  args: { actionId: v.string() },
  handler: async (_ctx, args) => {
    try {
      const res = await fetch(`${AGENT_SERVER_URL}/dispatch/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AGENT_SERVER_TOKEN}`,
        },
        body: JSON.stringify({ actionId: args.actionId }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error(`[dispatch] Schedule fire failed: ${res.status}`);
      }
    } catch (err: any) {
      console.error(`[dispatch] Schedule fire error: ${err.message}`);
    }
  },
});
