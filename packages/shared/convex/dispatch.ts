import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Push-based dispatch system.
 *
 * Only job notifications still use HTTP dispatch to the agent server.
 * Automations, schedules, and timers now run natively in Convex via
 * processAutomation.ts (no HTTP to agent server needed).
 *
 * The agent server keeps a low-frequency fallback poll (30s) as a safety net
 * for job notifications that fail to reach it.
 */

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL ?? "http://localhost:3001";
const AGENT_SERVER_TOKEN = process.env.AGENT_SERVER_TOKEN ?? "";

// ── Job Dispatch ────────────────────────────────────────────────────
// Called immediately after a job is inserted into agentJobs.
// This is the only dispatch that still needs HTTP — jobs require the
// agent server's Claude SDK to process them.

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
