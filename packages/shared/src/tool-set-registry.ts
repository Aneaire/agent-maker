export type ToolSetCategory = "core" | "automation" | "integration";

export interface ToolSetDef {
  key: string;
  label: string;
  description: string;
  category: ToolSetCategory;
  subcategory?: string;
  enabledByDefault: boolean;
  canDisable: boolean;
  requiresPlan?: "pro" | "enterprise";
  requiresCredential: boolean;
  creatorDescription: string;
  order: number;
}

export const TOOL_SET_REGISTRY: Record<string, ToolSetDef> = {
  // ── Core ──────────────────────────────────────────────────────────────
  memory: {
    key: "memory",
    label: "Memory",
    description: "Store and recall information across conversations",
    category: "core",
    enabledByDefault: true,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Store and recall information across conversations. Enabled by default.",
    order: 1,
  },
  web_search: {
    key: "web_search",
    label: "Web Search",
    description: "Search the internet and fetch web pages",
    category: "core",
    enabledByDefault: true,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Search the web and fetch web pages for current information. Enabled by default.",
    order: 2,
  },
  pages: {
    key: "pages",
    label: "Pages",
    description:
      "Create and manage task boards, notes, spreadsheets, and markdown pages",
    category: "core",
    enabledByDefault: true,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Create and manage pages: Tasks (kanban boards), Notes (markdown), Spreadsheets (data tables), Markdown pages, Data Tables. The agent can autonomously create pages and manage data. Enabled by default.",
    order: 3,
  },
  rag: {
    key: "rag",
    label: "Knowledge Base",
    description: "Upload documents and let your agent search them",
    category: "core",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Search uploaded documents (PDF, DOCX, etc.) using vector search. Agents can find relevant information from a knowledge base.",
    order: 4,
  },
  image_generation: {
    key: "image_generation",
    label: "Image Generation",
    description: "Generate images from text prompts using Gemini Imagen or Nano Banana",
    category: "core",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Generate images from text prompts using Gemini Imagen or Nano Banana. Images are returned as URLs or saved to pages.",
    order: 5,
  },
  custom_http_tools: {
    key: "custom_http_tools",
    label: "Custom HTTP Tools",
    description: "Call external APIs configured below",
    category: "core",
    enabledByDefault: true,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "User-defined HTTP API tools. Users can add custom endpoints in Settings that the agent can call. Enabled by default.",
    order: 6,
  },
  rest_api: {
    key: "rest_api",
    label: "REST API",
    description: "Expose the agent as a REST API",
    category: "core",
    enabledByDefault: false,
    canDisable: true,
    requiresPlan: "pro",
    requiresCredential: false,
    creatorDescription:
      "Expose the agent as a REST API. Users can create API endpoints that external systems call, with the agent processing requests.",
    order: 7,
  },
  postgres: {
    key: "postgres",
    label: "PostgreSQL",
    description: "Connect to external PostgreSQL databases for read-only queries",
    category: "core",
    enabledByDefault: false,
    canDisable: true,
    requiresPlan: "pro",
    requiresCredential: false,
    creatorDescription:
      "Connect to external PostgreSQL databases. The agent can run read-only queries.",
    order: 8,
  },

  // ── Automation ────────────────────────────────────────────────────────
  schedules: {
    key: "schedules",
    label: "Scheduled Actions",
    description:
      "Create recurring or one-time scheduled tasks (cron jobs, intervals)",
    category: "automation",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Create recurring or one-time scheduled actions (cron jobs, intervals). Agents can autonomously check APIs, send reports, create tasks on a schedule.",
    order: 1,
  },
  automations: {
    key: "automations",
    label: "Automations",
    description: "Event-driven rules: when X happens \u2192 do Y automatically",
    category: "automation",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Create event-driven automation rules. When X happens \u2192 do Y automatically. E.g., 'when task completed \u2192 send email summary'.",
    order: 2,
  },
  timers: {
    key: "timers",
    label: "Timers & Delays",
    description:
      "Set delayed actions for follow-ups, reminders, and drip sequences",
    category: "automation",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Set delayed actions: 'follow up in 30 minutes', 'remind me tomorrow'. Useful for drip sequences and follow-ups.",
    order: 3,
  },
  webhooks: {
    key: "webhooks",
    label: "Webhooks",
    description:
      "Fire outgoing webhooks to external services and view event history",
    category: "automation",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Fire outgoing webhooks to external services (Slack, Discord, Zapier, n8n). View event history.",
    order: 4,
  },
  agent_messages: {
    key: "agent_messages",
    label: "Inter-Agent Messaging",
    description:
      "Communicate with other agents for delegation and coordination",
    category: "automation",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: false,
    creatorDescription:
      "Communicate with other agents owned by the same user. Enables multi-agent workflows, delegation, and coordination.",
    order: 5,
  },

  // ── Integrations ─────────────────────────────────────────────────────
  email: {
    key: "email",
    label: "Resend Email",
    description: "Send transactional emails via Resend",
    category: "integration",
    subcategory: "Communication",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Send emails via Resend. Requires the user to configure a Resend API key and from address in Settings.",
    order: 1,
  },
  gmail: {
    key: "gmail",
    label: "Gmail",
    description: "Send and read emails via Gmail",
    category: "integration",
    subcategory: "Communication",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Read, search, send, and reply to emails in Gmail. Supports label filtering, threading, attachments, CC/BCC. Requires Gmail OAuth credentials configured in Settings.",
    order: 2,
  },
  slack: {
    key: "slack",
    label: "Slack",
    description: "Send messages, read channels, search, and react in Slack",
    category: "integration",
    subcategory: "Third-Party Services",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Send messages, read channels, DM users, search, pin messages, manage channels, schedule messages, and authorize users in Slack. Requires a Slack bot token configured in Settings.",
    order: 3,
  },
  discord: {
    key: "discord",
    label: "Discord",
    description:
      "Send messages, read channels, manage threads, and react in Discord",
    category: "integration",
    subcategory: "Third-Party Services",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Send messages, read channels, manage threads, and add reactions in Discord servers. Requires a Discord bot token configured in Settings.",
    order: 4,
  },
  notion: {
    key: "notion",
    label: "Notion",
    description:
      "Search, read, create, and update pages and databases in Notion",
    category: "integration",
    subcategory: "Third-Party Services",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Search, read, create, and update pages and databases in Notion. Requires a Notion integration token configured in Settings.",
    order: 5,
  },
  google_calendar: {
    key: "google_calendar",
    label: "Google Calendar",
    description:
      "List events, schedule meetings, check availability, and manage calendar",
    category: "integration",
    subcategory: "Third-Party Services",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "List events, schedule meetings, check availability, and manage Google Calendar. Requires Google OAuth credentials configured in Settings.",
    order: 6,
  },
  google_drive: {
    key: "google_drive",
    label: "Google Drive",
    description:
      "Search, read, create, and manage files and folders in Google Drive",
    category: "integration",
    subcategory: "Third-Party Services",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Search, read, create, and manage files and folders in Google Drive. Requires Google OAuth credentials configured in Settings.",
    order: 7,
  },
  google_sheets: {
    key: "google_sheets",
    label: "Google Sheets",
    description: "Read, write, and manage spreadsheet data in Google Sheets",
    category: "integration",
    subcategory: "Third-Party Services",
    enabledByDefault: false,
    canDisable: true,
    requiresCredential: true,
    creatorDescription:
      "Read, write, append rows, and manage spreadsheet data in Google Sheets. Requires Google OAuth credentials configured in Settings.",
    order: 8,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────

export const ALL_TOOL_SET_KEYS = Object.keys(TOOL_SET_REGISTRY);

export function getToolSetLabel(key: string): string {
  return TOOL_SET_REGISTRY[key]?.label ?? key;
}

export function getToolSetLabelsMap(): Record<string, string> {
  return Object.fromEntries(
    Object.values(TOOL_SET_REGISTRY).map((d) => [d.key, d.label])
  );
}

export function getToolSetsByCategory(
  category: ToolSetCategory
): { title: string; description: string; items: { key: string; label: string; description: string }[] }[] {
  const defs = Object.values(TOOL_SET_REGISTRY)
    .filter((d) => d.category === category)
    .sort((a, b) => a.order - b.order);

  const defaultTitle: Record<ToolSetCategory, string> = {
    core: "Core",
    automation: "Automation",
    integration: "Services",
  };
  const defaultDesc: Record<ToolSetCategory, string> = {
    core: "Built-in agent capabilities",
    automation: "Scheduling and event-driven workflows",
    integration: "Connect to external services",
  };

  const grouped = new Map<string, ToolSetDef[]>();
  for (const def of defs) {
    const sub = def.subcategory ?? defaultTitle[category];
    if (!grouped.has(sub)) grouped.set(sub, []);
    grouped.get(sub)!.push(def);
  }

  return Array.from(grouped.entries()).map(([title, items]) => ({
    title,
    description: defaultDesc[category],
    items: items.map((d) => ({ key: d.key, label: d.label, description: d.description })),
  }));
}

export function getToolSetsRequiringCredentials(): Record<string, boolean> {
  return Object.fromEntries(
    Object.values(TOOL_SET_REGISTRY)
      .filter((d) => d.requiresCredential)
      .map((d) => [d.key, true])
  );
}

export function getCredentialToolSetKeys(): string[] {
  return Object.values(TOOL_SET_REGISTRY)
    .filter((d) => d.requiresCredential)
    .map((d) => d.key);
}

export function getAllIntegrationsMap(): Record<string, { label: string; description: string }> {
  return Object.fromEntries(
    Object.values(TOOL_SET_REGISTRY).map((d) => [
      d.key,
      { label: d.label, description: d.description },
    ])
  );
}

export function getCreatorToolSetList(isPro: boolean): Array<{
  name: string;
  description: string;
  enabledByDefault: boolean;
  canDisable: boolean;
  requiresPlan?: string;
  available?: boolean;
}> {
  const catOrder: Record<ToolSetCategory, number> = { core: 0, automation: 1, integration: 2 };
  return Object.values(TOOL_SET_REGISTRY)
    .sort((a, b) => (catOrder[a.category] - catOrder[b.category]) || (a.order - b.order))
    .map((d) => ({
      name: d.key,
      description: d.creatorDescription,
      enabledByDefault: d.enabledByDefault,
      canDisable: d.canDisable,
      ...(d.requiresPlan ? { requiresPlan: d.requiresPlan, available: isPro } : {}),
    }));
}

export function getEnabledToolSetsDescription(): string {
  const byCategory: Record<ToolSetCategory, string[]> = { core: [], automation: [], integration: [] };
  for (const d of Object.values(TOOL_SET_REGISTRY)) {
    byCategory[d.category].push(`"${d.key}"`);
  }
  return `Tool sets to enable/disable. Core: ${byCategory.core.join(", ")}. Automation: ${byCategory.automation.join(", ")}. Integrations: ${byCategory.integration.join(", ")}. Pass the full desired array — omitted sets will be disabled.`;
}
