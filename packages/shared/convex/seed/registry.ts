import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  seedMemory,
  seedAutomations,
  seedSchedules,
  seedTimers,
  seedEvents,
  seedCustomHttpTools,
} from "./toolsetSeeders";
import {
  seedTasks,
  seedNotes,
  seedSpreadsheet,
  seedMarkdown,
  seedApiEndpoints,
} from "./pageSeeders";

// ── Types ────────────────────────────────────────────────────────────────

export type SeedContext = {
  ctx: MutationCtx;
  agentId: Id<"agents">;
  userId: Id<"users">;
};

export type PageSeedContext = SeedContext & {
  tabId: Id<"sidebarTabs">;
};

export type ToolSetSeeder = {
  /** Tool set key — must match the string used in agent.enabledToolSets */
  name: string;
  /** Creates realistic test data for this tool set. Returns created IDs. */
  seed: (sctx: SeedContext) => Promise<Record<string, any>>;
};

export type PageSeeder = {
  /** Page type — must match sidebarTabs.type union value */
  type: string;
  /** Default tab label shown in the sidebar */
  label: string;
  /** Populates the tab with realistic test data. Returns created IDs. */
  seed: (sctx: PageSeedContext) => Promise<Record<string, any>>;
};

// ── Registries ───────────────────────────────────────────────────────────
// ADD NEW ENTRIES HERE when adding features.
// The main seed.ts loops over these — no changes needed there.

/**
 * Tool set seeders — one per tool set that needs test data.
 * Tool sets that are purely runtime (web_search, custom_http_tools,
 * image_generation, agent_messages) don't need seeders.
 */
export const TOOLSET_SEEDERS: ToolSetSeeder[] = [
  { name: "memory", seed: seedMemory },
  { name: "automations", seed: seedAutomations },
  { name: "schedules", seed: seedSchedules },
  { name: "timers", seed: seedTimers },
  { name: "custom_http_tools", seed: seedCustomHttpTools },
  // When you add a new tool set that stores data, add its seeder here ↑
];

/**
 * Page seeders — one per sidebar tab type.
 * Each creates a tab and populates it with sample data.
 */
export const PAGE_SEEDERS: PageSeeder[] = [
  { type: "tasks", label: "Project Tasks", seed: seedTasks },
  { type: "notes", label: "Meeting Notes", seed: seedNotes },
  { type: "spreadsheet", label: "Contacts", seed: seedSpreadsheet },
  { type: "markdown", label: "Documentation", seed: seedMarkdown },
  { type: "api", label: "Agent API", seed: seedApiEndpoints },
  // When you add a new page type, add its seeder here ↑
];

/**
 * Core tool sets that are always enabled but don't need seed data.
 * These are added to the agent's enabledToolSets alongside the
 * TOOLSET_SEEDERS names.
 */
export const CORE_TOOL_SETS: string[] = [
  "web_search",
  "pages",
  "custom_http_tools",
  "image_generation",
  "agent_messages",
];

/**
 * Event seeder — always runs to create sample event history.
 */
export { seedEvents };
