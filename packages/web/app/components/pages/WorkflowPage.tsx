import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  GitBranch,
  Plus,
  Trash2,
  Zap,
  Mail,
  CheckSquare,
  Pencil,
  FileText,
  Brain,
  Sparkles,
  Bot,
  Clock,
  Power,
  PowerOff,
  Calendar,
  Activity,
  ChevronDown,
  ChevronRight,
  Webhook,
  X,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  Filter,
  ArrowRight,
  Timer,
} from "lucide-react";
import { useState } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

// ── Action type metadata ────────────────────────────────────────────

type ActionType =
  | "send_email"
  | "create_task"
  | "update_task"
  | "create_note"
  | "fire_webhook"
  | "store_memory"
  | "run_prompt"
  | "trigger_agent"
  | "delay";

const ACTION_META: Record<ActionType, { icon: React.FC<any>; label: string; colorClass: string }> = {
  send_email:    { icon: Mail,        label: "Send Email",    colorClass: "text-amber-400" },
  create_task:   { icon: CheckSquare, label: "Create Task",   colorClass: "text-blue-400" },
  update_task:   { icon: Pencil,      label: "Update Task",   colorClass: "text-blue-400" },
  create_note:   { icon: FileText,    label: "Create Note",   colorClass: "text-green-400" },
  fire_webhook:  { icon: Webhook,     label: "Fire Webhook",  colorClass: "text-purple-400" },
  store_memory:  { icon: Brain,       label: "Store Memory",  colorClass: "text-pink-400" },
  run_prompt:    { icon: Sparkles,    label: "Run Prompt",    colorClass: "text-neon-400" },
  trigger_agent: { icon: Bot,         label: "Trigger Agent", colorClass: "text-cyan-400" },
  delay:         { icon: Clock,       label: "Delay",         colorClass: "text-zinc-400" },
};

type ScheduleActionType =
  | "send_message"
  | "run_prompt"
  | "fire_webhook"
  | "send_email"
  | "create_task"
  | "run_automation";

// ── Helpers ─────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatNextRun(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = ts - Date.now();
  if (diff <= 0) return "now";
  if (diff < 60000) return "in <1m";
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
  return `in ${Math.floor(diff / 86400000)}d`;
}

function getEventStyle(eventName: string): string {
  if (eventName.startsWith("task."))          return "text-blue-400 bg-blue-950/40 ring-blue-800/40";
  if (eventName.startsWith("note."))          return "text-green-400 bg-green-950/40 ring-green-800/40";
  if (eventName.startsWith("email."))         return "text-amber-400 bg-amber-950/40 ring-amber-800/40";
  if (eventName.startsWith("webhook."))       return "text-purple-400 bg-purple-950/40 ring-purple-800/40";
  if (eventName.startsWith("schedule."))      return "text-neon-400 bg-neon-950/40 ring-neon-800/40";
  if (eventName.startsWith("timer."))         return "text-neon-400 bg-neon-950/40 ring-neon-800/40";
  if (eventName.startsWith("memory."))        return "text-pink-400 bg-pink-950/40 ring-pink-800/40";
  if (eventName.startsWith("document."))      return "text-cyan-400 bg-cyan-950/40 ring-cyan-800/40";
  if (eventName.startsWith("agent_message.")) return "text-cyan-400 bg-cyan-950/40 ring-cyan-800/40";
  if (eventName.startsWith("automation."))    return "text-neon-400 bg-neon-950/40 ring-neon-800/40";
  return "text-zinc-400 bg-zinc-800/60 ring-zinc-700/40";
}

function getSourceStyle(source: string): string {
  const map: Record<string, string> = {
    page_tools:          "text-zinc-400 bg-zinc-800/40",
    email_tools:         "text-amber-400/70 bg-amber-950/20",
    webhook:             "text-purple-400/70 bg-purple-950/20",
    webhook_tools:       "text-purple-400/70 bg-purple-950/20",
    scheduler:           "text-neon-400/70 bg-neon-950/20",
    schedule:            "text-neon-400/70 bg-neon-950/20",
    timer:               "text-neon-400/70 bg-neon-950/20",
    automation:          "text-neon-400/70 bg-neon-950/20",
    memory_tools:        "text-pink-400/70 bg-pink-950/20",
    document_processor:  "text-cyan-400/70 bg-cyan-950/20",
    agent_message_tools: "text-cyan-400/70 bg-cyan-950/20",
  };
  return map[source] ?? "text-zinc-500 bg-zinc-800/30";
}

// ── Section wrapper ──────────────────────────────────────────────────

function Section({
  icon,
  iconBg,
  title,
  count,
  actionLabel,
  onAction,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-800/40">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {count !== undefined && (
              <p className="text-[10px] text-zinc-600">
                {count} {count === 1 ? "item" : "items"}
              </p>
            )}
          </div>
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3 w-3" />
            {actionLabel}
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ── Automation pipeline chip ─────────────────────────────────────────

function TriggerChip({ event }: { event: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 px-3 py-1.5 text-xs font-mono text-zinc-200 shrink-0">
      <Zap className="h-3 w-3 text-neon-400 shrink-0" />
      {event}
    </span>
  );
}

function ActionChip({ type }: { type: ActionType }) {
  const meta = ACTION_META[type] ?? ACTION_META.run_prompt;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/40 px-3 py-1.5 text-xs text-zinc-300 shrink-0">
      <Icon className={`h-3 w-3 ${meta.colorClass} shrink-0`} />
      {meta.label}
    </span>
  );
}

// ── Automation card ───────────────────────────────────────────────────

function AutomationCard({
  automation,
  onToggle,
  onDelete,
  onEdit,
}: {
  automation: Doc<"automations">;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-zinc-900/40 overflow-hidden transition-all ${
        automation.isActive ? "border-zinc-800/60" : "border-zinc-800/30 opacity-60"
      }`}
    >
      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            <span className="text-sm font-semibold truncate">{automation.name}</span>
            {!automation.isActive && (
              <span className="text-[10px] text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full shrink-0">
                Paused
              </span>
            )}
            {automation.runCount > 0 && (
              <span className="text-[10px] text-zinc-600 shrink-0">
                {automation.runCount} run{automation.runCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onToggle}
              className={`p-1.5 rounded-lg transition-all ${
                automation.isActive
                  ? "text-neon-400 hover:bg-neon-950/30"
                  : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
              }`}
              title={automation.isActive ? "Pause" : "Resume"}
            >
              {automation.isActive ? (
                <Power className="h-3.5 w-3.5" />
              ) : (
                <PowerOff className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Pipeline */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <TriggerChip event={automation.trigger.event} />
          {automation.actions.map((action, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-zinc-600 text-xs">→</span>
              <ActionChip type={action.type as ActionType} />
            </span>
          ))}
        </div>

        {/* Expanded: description + last run */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-zinc-800/40 space-y-1.5">
            {automation.description && (
              <p className="text-xs text-zinc-400">{automation.description}</p>
            )}
            {automation.lastRunAt && (
              <p className="text-[11px] text-zinc-600">
                Last run {timeAgo(automation.lastRunAt)}
              </p>
            )}
            {automation.trigger.filter && (
              <p className="text-[11px] text-zinc-500 font-mono">
                Filter: {JSON.stringify(automation.trigger.filter)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Event picker ─────────────────────────────────────────────────────

const EVENT_OPTIONS: Array<{
  group: string;
  groupColor: string;
  events: Array<{ value: string; description: string }>;
}> = [
  {
    group: "Tasks",
    groupColor: "text-blue-400",
    events: [
      { value: "task.created", description: "A new task was created" },
      { value: "task.updated", description: "A task was modified (use filter {status: 'done'} to catch completions)" },
      { value: "task.deleted", description: "A task was removed" },
    ],
  },
  {
    group: "Notes",
    groupColor: "text-green-400",
    events: [
      { value: "note.created", description: "A new note was created" },
      { value: "note.updated", description: "A note was edited" },
    ],
  },
  {
    group: "Email",
    groupColor: "text-amber-400",
    events: [
      { value: "email.sent",   description: "An email was sent by the agent" },
      { value: "email.failed", description: "An email failed to send" },
    ],
  },
  {
    group: "Gmail",
    groupColor: "text-red-400",
    events: [
      { value: "gmail.sent",            description: "An email was sent via Gmail" },
      { value: "gmail.failed",          description: "A Gmail send failed" },
      { value: "gmail.replied",         description: "A reply was sent to an existing thread" },
      { value: "gmail.labels_modified", description: "Labels were added or removed from a message" },
    ],
  },
  {
    group: "Google Sheets",
    groupColor: "text-emerald-400",
    events: [
      { value: "gsheets.spreadsheet_created", description: "A new spreadsheet was created" },
      { value: "gsheets.data_written",        description: "Data was written to a range" },
      { value: "gsheets.rows_appended",       description: "Rows were appended to a sheet" },
    ],
  },
  {
    group: "Google Drive",
    groupColor: "text-blue-400",
    events: [
      { value: "gdrive.file_created", description: "A file was created in Google Drive" },
      { value: "gdrive.file_deleted", description: "A file was moved to trash" },
    ],
  },
  {
    group: "Google Calendar",
    groupColor: "text-indigo-400",
    events: [
      { value: "gcal.event_created", description: "A calendar event was created" },
      { value: "gcal.event_updated", description: "A calendar event was updated" },
      { value: "gcal.event_deleted", description: "A calendar event was deleted" },
    ],
  },
  {
    group: "Webhooks",
    groupColor: "text-purple-400",
    events: [
      { value: "webhook.received", description: "An incoming webhook was triggered" },
      { value: "webhook.fired",    description: "An outgoing webhook was sent" },
    ],
  },
  {
    group: "Schedule & Timers",
    groupColor: "text-neon-400",
    events: [
      { value: "schedule.fired", description: "A scheduled action executed" },
      { value: "timer.fired",    description: "A one-time timer fired" },
    ],
  },
  {
    group: "Memory & Documents",
    groupColor: "text-pink-400",
    events: [
      { value: "memory.stored",   description: "A memory was stored by the agent" },
      { value: "document.ready",  description: "A document finished processing and is indexed" },
    ],
  },
  {
    group: "Agent Messages",
    groupColor: "text-cyan-400",
    events: [
      { value: "agent_message.sent",     description: "This agent sent a message to another agent" },
      { value: "agent_message.received", description: "This agent received a message from another agent" },
    ],
  },
];

function EventPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  const allEvents = EVENT_OPTIONS.flatMap((g) =>
    g.events.map((e) => ({ ...e, group: g.group, groupColor: g.groupColor }))
  );

  const filtered = query.trim()
    ? allEvents.filter(
        (e) =>
          e.value.includes(query.toLowerCase()) ||
          e.description.toLowerCase().includes(query.toLowerCase())
      )
    : null; // null = show all grouped

  function select(val: string) {
    onChange(val);
    setQuery(val);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-neon-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder="task.created"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-2 text-sm font-mono placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
        />
      </div>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/50 overflow-hidden max-h-64 overflow-y-auto">
          {filtered ? (
            filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-zinc-500 text-center">
                No matching events — type a custom event name
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((e) => (
                  <button
                    key={e.value}
                    onMouseDown={() => select(e.value)}
                    className="flex items-start gap-3 w-full px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <span className="text-xs font-mono text-zinc-200 shrink-0 mt-0.5">
                      {e.value}
                    </span>
                    <span className="text-[10px] text-zinc-500 leading-relaxed">
                      {e.description}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="py-1">
              {EVENT_OPTIONS.map((group) => (
                <div key={group.group}>
                  <div className={`px-3 pt-2.5 pb-1 text-[9px] font-semibold uppercase tracking-widest ${group.groupColor}`}>
                    {group.group}
                  </div>
                  {group.events.map((e) => (
                    <button
                      key={e.value}
                      onMouseDown={() => select(e.value)}
                      className="flex items-start gap-3 w-full px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <span className="text-xs font-mono text-zinc-200 shrink-0 mt-0.5">
                        {e.value}
                      </span>
                      <span className="text-[10px] text-zinc-500 leading-relaxed">
                        {e.description}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              <div className="px-3 py-2 border-t border-zinc-800/60 mt-1">
                <p className="text-[10px] text-zinc-600">
                  Or type a custom event name above
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── New automation form ───────────────────────────────────────────────

function AutomationForm({
  agentId,
  onCreate,
  onCancel,
  initialData,
}: {
  agentId: string;
  onCreate: (data: {
    agentId: any;
    name: string;
    description?: string;
    trigger: { event: string; filter?: any };
    actions: Array<{ type: ActionType; config: any }>;
  }) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    description?: string;
    trigger: { event: string; filter?: any };
    actions: Array<{ type: ActionType; config: any }>;
  };
}) {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [triggerEvent, setTriggerEvent] = useState(initialData?.trigger.event ?? "");
  const [actions, setActions] = useState<Array<{ type: ActionType; config: any }>>(
    initialData?.actions ?? [{ type: "run_prompt", config: { prompt: "" } }]
  );

  function addAction() {
    if (actions.length < 10) {
      setActions([...actions, { type: "run_prompt", config: { prompt: "" } }]);
    }
  }

  function removeAction(i: number) {
    setActions(actions.filter((_, idx) => idx !== i));
  }

  function updateActionType(i: number, type: ActionType) {
    const updated = [...actions];
    updated[i] = { type, config: getDefaultConfig(type) };
    setActions(updated);
  }

  function updateActionConfig(i: number, config: any) {
    const updated = [...actions];
    updated[i] = { ...updated[i], config };
    setActions(updated);
  }

  const canSubmit = name.trim() && triggerEvent.trim() && actions.length > 0;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-5 space-y-4 mb-3">
      <h4 className="text-sm font-semibold">{isEdit ? "Edit Automation" : "New Automation"}</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Notify on task complete"
            autoFocus
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Trigger Event
          </label>
          <EventPicker
            value={triggerEvent}
            onChange={setTriggerEvent}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Description{" "}
          <span className="font-normal text-zinc-600">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this automation does"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-zinc-400">
            Actions
            <span className={`ml-2 font-mono text-[10px] ${actions.length >= 10 ? "text-amber-400" : "text-zinc-600"}`}>
              {actions.length} / 10
            </span>
          </label>
          {actions.length < 10 ? (
            <button
              onClick={addAction}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add action
            </button>
          ) : (
            <span className="text-[10px] text-amber-400/70">Max 10 reached</span>
          )}
        </div>
        <div className="space-y-2">
          {actions.map((action, i) => (
            <ActionConfigRow
              key={i}
              index={i}
              action={action}
              showRemove={actions.length > 1}
              triggerEvent={triggerEvent}
              onTypeChange={(t) => updateActionType(i, t)}
              onConfigChange={(c) => updateActionConfig(i, c)}
              onRemove={() => removeAction(i)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onCreate({
              agentId: agentId as any,
              name: name.trim(),
              description: description.trim() || undefined,
              trigger: { event: triggerEvent.trim() },
              actions,
            })
          }
          disabled={!canSubmit}
          className="text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
        >
          {isEdit ? "Save Changes" : "Create Automation"}
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-500 px-3 py-2 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Payload variable helpers ──────────────────────────────────────────

const PAYLOAD_VARIABLES: Record<string, Array<{ key: string; description: string }>> = {
  "task.*": [
    { key: "{{event.title}}",       description: "Task title" },
    { key: "{{event.status}}",      description: "todo / in_progress / done" },
    { key: "{{event.priority}}",    description: "low / medium / high" },
    { key: "{{event.description}}", description: "Task description" },
    { key: "{{event.tabId}}",       description: "Tab ID" },
    { key: "{{event.taskId}}",      description: "Task ID" },
  ],
  "note.*": [
    { key: "{{event.title}}",   description: "Note title" },
    { key: "{{event.content}}", description: "Note content" },
    { key: "{{event.noteId}}",  description: "Note ID" },
  ],
  "email.*": [
    { key: "{{event.to}}",      description: "Recipient(s)" },
    { key: "{{event.subject}}", description: "Email subject" },
    { key: "{{event.resendId}}", description: "Resend message ID" },
  ],
  "gmail.*": [
    { key: "{{event.to}}",             description: "Recipient(s)" },
    { key: "{{event.subject}}",        description: "Email subject" },
    { key: "{{event.gmailMessageId}}", description: "Gmail message ID" },
    { key: "{{event.threadId}}",       description: "Gmail thread ID" },
  ],
  "gsheets.*": [
    { key: "{{event.spreadsheetId}}", description: "Spreadsheet ID" },
    { key: "{{event.title}}",         description: "Spreadsheet title (on create)" },
    { key: "{{event.range}}",         description: "A1 notation range written (on write)" },
    { key: "{{event.rowCount}}",      description: "Number of rows written/appended" },
    { key: "{{event.sheet}}",         description: "Sheet/tab name (on append)" },
  ],
  "gdrive.*": [
    { key: "{{event.fileId}}",     description: "Drive file ID" },
    { key: "{{event.name}}",       description: "File name" },
    { key: "{{event.type}}",       description: "File type (doc, sheet, folder, text)" },
    { key: "{{event.mimeType}}",   description: "MIME type" },
    { key: "{{event.webViewLink}}", description: "Link to open the file" },
  ],
  "gcal.*": [
    { key: "{{event.eventId}}",    description: "Calendar event ID" },
    { key: "{{event.title}}",      description: "Event title/summary" },
    { key: "{{event.start}}",      description: "Event start time" },
    { key: "{{event.end}}",        description: "Event end time" },
    { key: "{{event.calendarId}}", description: "Calendar ID" },
  ],
  "webhook.*": [
    { key: "{{event.webhookId}}", description: "Webhook ID" },
    { key: "{{event.action}}",   description: "Webhook action" },
  ],
  "schedule.*": [
    { key: "{{event.actionId}}",   description: "Scheduled action ID" },
    { key: "{{event.actionName}}", description: "Schedule name" },
    { key: "{{event.success}}",    description: "Whether it succeeded" },
  ],
  "timer.*": [
    { key: "{{event.timerId}}",    description: "Timer ID" },
    { key: "{{event.label}}",      description: "Timer label" },
    { key: "{{event.actionType}}", description: "Action type that fired" },
  ],
  "memory.*": [
    { key: "{{event.content}}",  description: "Memory content" },
    { key: "{{event.category}}", description: "Memory category" },
  ],
  "document.*": [
    { key: "{{event.documentId}}", description: "Document ID" },
    { key: "{{event.fileName}}",   description: "File name" },
    { key: "{{event.chunkCount}}", description: "Number of chunks indexed" },
  ],
};

const ALWAYS_AVAILABLE: Array<{ key: string; description: string }> = [];

function getPayloadVars(triggerEvent: string) {
  if (!triggerEvent) return ALWAYS_AVAILABLE;
  const prefix = triggerEvent.split(".")[0] + ".*";
  const specific = PAYLOAD_VARIABLES[prefix] ?? [];
  return [...specific, ...ALWAYS_AVAILABLE];
}

function PayloadVariables({ triggerEvent }: { triggerEvent: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const vars = getPayloadVars(triggerEvent);

  return (
    <div className="pt-2 mt-1 border-t border-zinc-700/40">
      <p className="text-[9px] text-zinc-600 mb-1.5 uppercase tracking-wider font-semibold">
        Available from trigger — click to copy
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {vars.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(v.key);
              setCopied(v.key);
              setTimeout(() => setCopied(null), 1500);
            }}
            title={v.description}
            className={`text-[9px] font-mono px-2 py-1 rounded-md ring-1 transition-all ${
              copied === v.key
                ? "bg-neon-950/50 text-neon-400 ring-neon-700/40"
                : "bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 ring-zinc-700/30"
            }`}
          >
            {copied === v.key ? "✓ copied" : v.key}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Action config helpers ─────────────────────────────────────────────

function getDefaultConfig(type: ActionType): any {
  switch (type) {
    case "run_prompt":    return { prompt: "" };
    case "send_email":    return { to: "", subject: "", body: "" };
    case "create_task":   return { title: "", priority: "medium" };
    case "create_note":   return { title: "", content: "" };
    case "store_memory":  return { content: "" };
    case "fire_webhook":  return { url: "" };
    case "trigger_agent": return { agentId: "" };
    case "delay":         return { ms: 1000 };
    default:              return {};
  }
}

function ActionConfigRow({
  index,
  action,
  showRemove,
  triggerEvent,
  onTypeChange,
  onConfigChange,
  onRemove,
}: {
  index: number;
  action: { type: ActionType; config: any };
  showRemove: boolean;
  triggerEvent: string;
  onTypeChange: (t: ActionType) => void;
  onConfigChange: (c: any) => void;
  onRemove: () => void;
}) {
  const meta = ACTION_META[action.type];
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-600 font-mono w-4 text-right shrink-0">
          {index + 1}
        </span>
        <Icon className={`h-3.5 w-3.5 ${meta.colorClass} shrink-0`} />
        <select
          value={action.type}
          onChange={(e) => onTypeChange(e.target.value as ActionType)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs focus:outline-none focus:border-zinc-500 transition-colors"
        >
          {Object.entries(ACTION_META).map(([t, m]) => {
            const enabled = t === "run_prompt";
            return (
              <option key={t} value={t} disabled={!enabled}>
                {m.label}{!enabled ? " (coming soon)" : ""}
              </option>
            );
          })}
        </select>
        {showRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Type-specific config */}
      {action.type === "run_prompt" && (
        <textarea
          value={action.config.prompt ?? ""}
          onChange={(e) => onConfigChange({ ...action.config, prompt: e.target.value })}
          rows={2}
          placeholder="What should the agent do?"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none resize-none transition-colors"
        />
      )}
      {action.type === "send_email" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={action.config.to ?? ""}
            onChange={(e) => onConfigChange({ ...action.config, to: e.target.value })}
            placeholder="To (email)"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
          <input
            type="text"
            value={action.config.subject ?? ""}
            onChange={(e) => onConfigChange({ ...action.config, subject: e.target.value })}
            placeholder="Subject"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
        </div>
      )}
      {action.type === "create_task" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={action.config.title ?? ""}
            onChange={(e) => onConfigChange({ ...action.config, title: e.target.value })}
            placeholder="Task title"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
          <select
            value={action.config.priority ?? "medium"}
            onChange={(e) => onConfigChange({ ...action.config, priority: e.target.value })}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs focus:outline-none focus:border-zinc-500 transition-colors"
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
        </div>
      )}
      {action.type === "store_memory" && (
        <input
          type="text"
          value={action.config.content ?? ""}
          onChange={(e) => onConfigChange({ ...action.config, content: e.target.value })}
          placeholder="Memory content (can use {{event.payload}} variables)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
        />
      )}
      {action.type === "delay" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={Math.floor((action.config.ms ?? 1000) / 1000)}
            onChange={(e) =>
              onConfigChange({ ...action.config, ms: parseInt(e.target.value) * 1000 })
            }
            min={1}
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs focus:border-zinc-500 focus:outline-none transition-colors"
          />
          <span className="text-xs text-zinc-500">seconds</span>
        </div>
      )}

      {/* Payload variables — only shown for actions that use text/template fields */}
      {action.type !== "delay" && (
        <PayloadVariables triggerEvent={triggerEvent} />
      )}
    </div>
  );
}

// ── Schedule card ─────────────────────────────────────────────────────

const SCHEDULE_STATUS_COLORS: Record<string, string> = {
  active:    "text-neon-400 bg-neon-950/30",
  paused:    "text-amber-400 bg-amber-950/30",
  completed: "text-zinc-500 bg-zinc-800/40",
  error:     "text-red-400 bg-red-950/30",
};

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  cron:     "cron",
  interval: "interval",
  once:     "once",
};

function ScheduleCard({
  schedule,
  onToggle,
  onDelete,
  onEdit,
}: {
  schedule: Doc<"scheduledActions">;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const statusColor = SCHEDULE_STATUS_COLORS[schedule.status] ?? SCHEDULE_STATUS_COLORS.paused;
  const isToggleable = schedule.status === "active" || schedule.status === "paused";

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-semibold truncate">{schedule.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {schedule.status}
            </span>
            <span className="text-[10px] text-zinc-600 bg-zinc-800/40 px-2 py-0.5 rounded-full">
              {SCHEDULE_TYPE_LABELS[schedule.scheduleType] ?? schedule.scheduleType}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-zinc-400 font-mono">{schedule.schedule}</span>
            <span className="text-[11px] text-zinc-600">
              next: {formatNextRun(schedule.nextRunAt)}
            </span>
            {schedule.runCount > 0 && (
              <span className="text-[11px] text-zinc-600">
                {schedule.runCount} run{schedule.runCount !== 1 ? "s" : ""}
                {schedule.lastRunAt && ` · last ${timeAgo(schedule.lastRunAt)}`}
              </span>
            )}
          </div>

          {schedule.description && (
            <p className="text-xs text-zinc-500 mt-1.5">{schedule.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {isToggleable && (
            <button
              onClick={onToggle}
              className={`p-1.5 rounded-lg transition-all ${
                schedule.status === "active"
                  ? "text-neon-400 hover:bg-neon-950/30"
                  : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
              }`}
              title={schedule.status === "active" ? "Pause" : "Resume"}
            >
              {schedule.status === "active" ? (
                <Power className="h-3.5 w-3.5" />
              ) : (
                <PowerOff className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New schedule form ─────────────────────────────────────────────────

const SCHEDULE_HINTS: Record<string, string> = {
  cron:     'e.g. "0 9 * * 1" (Mon 9am)',
  interval: 'e.g. "every 5m", "every 1h", "every 1d"',
  once:     "leave blank to run immediately",
};

function ScheduleForm({
  agentId,
  onCreate,
  onCancel,
  initialData,
}: {
  agentId: string;
  onCreate: (data: {
    agentId: any;
    name: string;
    description?: string;
    schedule: string;
    scheduleType: "cron" | "interval" | "once";
    action: { type: ScheduleActionType; config: any };
    maxRuns?: number;
  }) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    description?: string;
    schedule: string;
    scheduleType: "cron" | "interval" | "once";
    action: { type: ScheduleActionType; config: any };
  };
}) {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [scheduleType, setScheduleType] = useState<"cron" | "interval" | "once">(initialData?.scheduleType ?? "interval");
  const [schedule, setSchedule] = useState(initialData?.schedule ?? "every 1h");
  const [actionType, setActionType] = useState<ScheduleActionType>(initialData?.action.type ?? "run_prompt");
  const [prompt, setPrompt] = useState(initialData?.action.config?.prompt ?? "");

  const canSubmit = name.trim() && (scheduleType === "once" || schedule.trim());

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-5 space-y-4 mb-3">
      <h4 className="text-sm font-semibold">{isEdit ? "Edit Scheduled Action" : "New Scheduled Action"}</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Daily summary"
            autoFocus
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Schedule Type
          </label>
          <select
            value={scheduleType}
            onChange={(e) => {
              const t = e.target.value as "cron" | "interval" | "once";
              setScheduleType(t);
              if (t === "interval") setSchedule("every 1h");
              else if (t === "cron") setSchedule("0 9 * * *");
              else setSchedule("");
            }}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
          >
            <option value="interval">Interval</option>
            <option value="cron">Cron</option>
            <option value="once">Once</option>
          </select>
        </div>
      </div>

      {scheduleType !== "once" && (
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Schedule{" "}
            <span className="font-normal text-zinc-600">{SCHEDULE_HINTS[scheduleType]}</span>
          </label>
          <input
            type="text"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Action</label>
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value as ScheduleActionType)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors mb-2"
        >
          <option value="run_prompt">Run Prompt</option>
          <option value="send_message">Send Message</option>
          <option value="send_email">Send Email</option>
          <option value="create_task">Create Task</option>
          <option value="fire_webhook">Fire Webhook</option>
          <option value="run_automation">Run Automation</option>
        </select>

        {actionType === "run_prompt" && (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="What should the agent do on this schedule?"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none resize-none transition-colors"
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Description{" "}
          <span className="font-normal text-zinc-600">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this schedule does"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onCreate({
              agentId: agentId as any,
              name: name.trim(),
              description: description.trim() || undefined,
              schedule: scheduleType === "once" ? "once" : schedule.trim(),
              scheduleType,
              action: {
                type: actionType,
                config: actionType === "run_prompt" ? { prompt } : {},
              },
            })
          }
          disabled={!canSubmit}
          className="text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
        >
          {isEdit ? "Save Changes" : "Create Schedule"}
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-500 px-3 py-2 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Webhook card (read-only) ──────────────────────────────────────────

function WebhookCard({ webhook }: { webhook: Doc<"webhooks"> }) {
  const isIncoming = webhook.type === "incoming";
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-md ring-1 ${
            isIncoming
              ? "bg-purple-950/40 text-purple-400 ring-purple-800/40"
              : "bg-blue-950/40 text-blue-400 ring-blue-800/40"
          }`}
        >
          {webhook.type.toUpperCase()}
        </span>
        <span className="text-sm font-medium">
          {webhook.label ?? (isIncoming ? "Incoming webhook" : "Outgoing webhook")}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ${
            webhook.isActive
              ? "text-neon-400 bg-neon-950/30"
              : "text-zinc-500 bg-zinc-800/40"
          }`}
        >
          {webhook.isActive ? "active" : "inactive"}
        </span>
      </div>

      {webhook.url && (
        <p className="text-xs text-zinc-500 font-mono mt-1.5 truncate">{webhook.url}</p>
      )}

      {webhook.events.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {webhook.events.map((ev) => (
            <span
              key={ev}
              className="text-[10px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full font-mono"
            >
              {ev}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Event log entry ───────────────────────────────────────────────────

function EventLogEntry({ event }: { event: Doc<"agentEvents"> }) {
  const [expanded, setExpanded] = useState(false);
  const eventStyle = getEventStyle(event.event);
  const sourceStyle = getSourceStyle(event.source);

  const hasPayload =
    event.payload !== null &&
    event.payload !== undefined &&
    Object.keys(event.payload ?? {}).length > 0;

  return (
    <div className="group flex items-start gap-3 py-2.5 border-b border-zinc-800/30 last:border-0">
      <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 mt-0.5 w-14 text-right">
        {timeAgo(event.createdAt)}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-md ring-1 font-medium ${eventStyle}`}
          >
            {event.event}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${sourceStyle}`}>
            {event.source}
          </span>
          {hasPayload && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {expanded ? "▲ hide" : "▼ payload"}
            </button>
          )}
        </div>

        {expanded && hasPayload && (
          <pre className="mt-1.5 text-[10px] text-zinc-500 font-mono bg-zinc-950/60 rounded-lg p-2.5 overflow-x-auto border border-zinc-800/40">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Execution status helpers ──────────────────────────────────────────

const EXEC_STATUS_META: Record<string, { icon: React.FC<any>; colorClass: string; bgClass: string; label: string }> = {
  running:   { icon: Loader2,      colorClass: "text-blue-400",  bgClass: "bg-blue-950/30 ring-blue-800/40",  label: "Running" },
  completed: { icon: CheckCircle2, colorClass: "text-neon-400",  bgClass: "bg-neon-950/30 ring-neon-800/40",  label: "Completed" },
  failed:    { icon: XCircle,      colorClass: "text-red-400",   bgClass: "bg-red-950/30 ring-red-800/40",    label: "Failed" },
};

function formatDuration(ms: number | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

// ── Execution card ──────────────────────────────────────────────────

function ExecutionCard({ execution }: { execution: any }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = EXEC_STATUS_META[execution.status] ?? EXEC_STATUS_META.completed;
  const StatusIcon = statusMeta.icon;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden transition-all hover:border-zinc-700/60">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            <StatusIcon
              className={`h-4 w-4 shrink-0 ${statusMeta.colorClass} ${
                execution.status === "running" ? "animate-spin" : ""
              }`}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold truncate">{execution.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ring-1 font-medium ${statusMeta.bgClass} ${statusMeta.colorClass}`}
                >
                  {statusMeta.label}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    execution.kind === "automation"
                      ? "text-neon-400 bg-neon-950/30"
                      : "text-blue-400 bg-blue-950/30"
                  }`}
                >
                  {execution.kind === "automation" ? "Automation" : "Schedule"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-[11px] text-zinc-500">
            {execution.duration !== undefined && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {formatDuration(execution.duration)}
              </span>
            )}
            <span className="tabular-nums">{formatTimestamp(execution.startedAt)}</span>
          </div>
        </div>

        {/* Quick info row */}
        <div className="flex items-center gap-3 mt-1.5 ml-9 flex-wrap">
          {execution.triggerEvent && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
              <Zap className="h-2.5 w-2.5 text-neon-400" />
              {execution.triggerEvent}
            </span>
          )}
          {execution.scheduleType && (
            <span className="text-[10px] text-zinc-500 font-mono">
              {execution.schedule}
            </span>
          )}
          {execution.actionType && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
              <ArrowRight className="h-2.5 w-2.5" />
              {execution.actionType}
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-800/40 px-4 py-3 space-y-3">
          {/* Actions executed (automation runs) */}
          {execution.actionsExecuted && execution.actionsExecuted.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">
                Actions Executed
              </p>
              <div className="space-y-1.5">
                {execution.actionsExecuted.map((action: any, i: number) => {
                  const actionStatus = EXEC_STATUS_META[action.status] ?? EXEC_STATUS_META.completed;
                  const ActionStatusIcon = actionStatus.icon;
                  const actionMeta = ACTION_META[action.type as ActionType];
                  const ActionIcon = actionMeta?.icon;

                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-2"
                    >
                      <span className="text-[10px] text-zinc-600 font-mono w-4 text-right mt-0.5 shrink-0">
                        {i + 1}
                      </span>
                      {ActionIcon && (
                        <ActionIcon
                          className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                            actionMeta?.colorClass ?? "text-zinc-400"
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {actionMeta?.label ?? action.type}
                          </span>
                          <ActionStatusIcon
                            className={`h-3 w-3 ${actionStatus.colorClass} ${
                              action.status === "running" ? "animate-spin" : ""
                            }`}
                          />
                          {action.duration !== undefined && (
                            <span className="text-[10px] text-zinc-600">
                              {formatDuration(action.duration)}
                            </span>
                          )}
                        </div>
                        {action.result && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                            {action.result}
                          </p>
                        )}
                        {action.error && (
                          <p className="text-[11px] text-red-400/80 mt-0.5">
                            {action.error}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Result / Error */}
          {execution.result && (
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">
                Result
              </p>
              <pre className="text-[11px] text-zinc-400 font-mono bg-zinc-950/60 rounded-lg p-2.5 overflow-x-auto border border-zinc-800/40 whitespace-pre-wrap">
                {execution.result}
              </pre>
            </div>
          )}

          {execution.error && (
            <div>
              <p className="text-[10px] text-red-400/70 uppercase tracking-wider font-semibold mb-1">
                Error
              </p>
              <pre className="text-[11px] text-red-400/80 font-mono bg-red-950/20 rounded-lg p-2.5 overflow-x-auto border border-red-900/30 whitespace-pre-wrap">
                {execution.error}
              </pre>
            </div>
          )}

          {/* Trigger payload (automation) */}
          {execution.triggerPayload &&
            Object.keys(execution.triggerPayload).length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">
                  Trigger Payload
                </p>
                <pre className="text-[10px] text-zinc-500 font-mono bg-zinc-950/60 rounded-lg p-2.5 overflow-x-auto border border-zinc-800/40">
                  {JSON.stringify(execution.triggerPayload, null, 2)}
                </pre>
              </div>
            )}

          {/* Timing */}
          <div className="flex items-center gap-4 text-[10px] text-zinc-600">
            <span>Started: {new Date(execution.startedAt).toLocaleString()}</span>
            {execution.completedAt && (
              <span>
                Completed: {new Date(execution.completedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Executions View ─────────────────────────────────────────────────

function ExecutionsView({ agentId }: { agentId: string }) {
  const [kindFilter, setKindFilter] = useState<"all" | "automation" | "schedule">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "completed" | "failed">("all");
  const [limit, setLimit] = useState(50);

  const executions = useQuery(api.executions.list, {
    agentId: agentId as any,
    limit,
    filter: kindFilter,
    status: statusFilter,
  });

  const stats = useQuery(api.executions.stats, { agentId: agentId as any });

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-zinc-300", bg: "bg-zinc-800/60" },
            { label: "Completed", value: stats.completed, color: "text-neon-400", bg: "bg-neon-950/30" },
            { label: "Failed", value: stats.failed, color: "text-red-400", bg: "bg-red-950/30" },
            { label: "Running", value: stats.running, color: "text-blue-400", bg: "bg-blue-950/30" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border border-zinc-800/60 ${stat.bg} px-4 py-3 text-center`}
            >
              <p className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3 w-3 text-zinc-600" />
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
            Filter
          </span>
        </div>

        <div className="flex items-center rounded-lg border border-zinc-800 overflow-hidden">
          {(["all", "automation", "schedule"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setKindFilter(f)}
              className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                kindFilter === f
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              {f === "all" ? "All" : f === "automation" ? "Automations" : "Schedules"}
            </button>
          ))}
        </div>

        <div className="flex items-center rounded-lg border border-zinc-800 overflow-hidden">
          {(["all", "running", "completed", "failed"] as const).map((s) => {
            const meta = s !== "all" ? EXEC_STATUS_META[s] : null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                {s === "all" ? "All" : meta?.label ?? s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Execution list */}
      {executions === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-800/20 animate-pulse" />
          ))}
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-16">
          <History className="h-10 w-10 text-zinc-800 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 font-medium">No executions yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            {kindFilter !== "all" || statusFilter !== "all"
              ? "Try changing your filters"
              : "Executions will appear here when automations or schedules run"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {executions.map((exec: any) => (
              <ExecutionCard key={exec._id} execution={exec} />
            ))}
          </div>
          {executions.length >= limit && (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="w-full text-xs text-zinc-600 hover:text-zinc-400 py-2.5 hover:bg-zinc-800/40 rounded-xl transition-colors"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Main WorkflowPage ─────────────────────────────────────────────────

type WorkflowTab = "workflow" | "executions";

export function WorkflowPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const agentId = tab.agentId;

  const automations = useQuery(api.automations.list, { agentId });
  const schedules = useQuery(api.scheduledActions.list, { agentId });
  const events = useQuery(api.agentEvents.list, { agentId, limit: 100 });
  const webhooks = useQuery(api.webhooks.listByAgent, { agentId });

  const createAutomation = useMutation(api.automations.create);
  const updateAutomation = useMutation(api.automations.update);
  const toggleAutomation = useMutation(api.automations.toggle);
  const removeAutomation = useMutation(api.automations.remove);

  const createSchedule = useMutation(api.scheduledActions.create);
  const updateSchedule = useMutation(api.scheduledActions.update);
  const toggleSchedule = useMutation(api.scheduledActions.toggle);
  const removeSchedule = useMutation(api.scheduledActions.remove);

  const [activeTab, setActiveTab] = useState<WorkflowTab>("workflow");
  const [showAutoForm, setShowAutoForm] = useState(false);
  const [showSchedForm, setShowSchedForm] = useState(false);
  const [editingAutoId, setEditingAutoId] = useState<string | null>(null);
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null);
  const [eventLimit, setEventLimit] = useState(50);

  const shownEvents = events?.slice(0, eventLimit) ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
              <GitBranch className="h-4 w-4 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{tab.label}</h2>
              <p className="text-xs text-zinc-500">
                {automations !== undefined && schedules !== undefined
                  ? `${automations.length} automation${automations.length !== 1 ? "s" : ""} · ${schedules.length} schedule${schedules.length !== 1 ? "s" : ""}`
                  : "Automations & pipelines"}
              </p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-400 status-pulse" />
            live
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-zinc-900/80 border border-zinc-800/60 p-0.5 w-fit">
          <button
            onClick={() => setActiveTab("workflow")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "workflow"
                ? "bg-zinc-800 text-zinc-200 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <GitBranch className="h-3 w-3" />
            Workflow
          </button>
          <button
            onClick={() => setActiveTab("executions")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "executions"
                ? "bg-zinc-800 text-zinc-200 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <History className="h-3 w-3" />
            Executions
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "executions" ? (
          <ExecutionsView agentId={agentId as string} />
        ) : (
        <div className="max-w-2xl mx-auto space-y-6">

          {/* ── Automations ── */}
          <Section
            icon={<Zap className="h-3.5 w-3.5 text-neon-400" />}
            iconBg="bg-neon-950/50"
            title="Automations"
            count={automations?.length}
            actionLabel="New"
            onAction={() => {
              setShowAutoForm(true);
              setShowSchedForm(false);
            }}
          >
            {showAutoForm && (
              <AutomationForm
                agentId={agentId as string}
                onCreate={async (data) => {
                  await createAutomation(data);
                  setShowAutoForm(false);
                }}
                onCancel={() => setShowAutoForm(false)}
              />
            )}

            {automations === undefined ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-zinc-800/20 animate-pulse" />
                ))}
              </div>
            ) : automations.length === 0 && !showAutoForm ? (
              <div className="text-center py-8">
                <Zap className="h-8 w-8 text-zinc-800 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-medium">No automations yet</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Create event-triggered pipelines
                </p>
                <button
                  onClick={() => setShowAutoForm(true)}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors mx-auto"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Automation
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {automations.map((auto) =>
                  editingAutoId === auto._id ? (
                    <AutomationForm
                      key={auto._id}
                      agentId={agentId as string}
                      initialData={{
                        name: auto.name,
                        description: auto.description,
                        trigger: auto.trigger,
                        actions: auto.actions as Array<{ type: ActionType; config: any }>,
                      }}
                      onCreate={async (data) => {
                        await updateAutomation({
                          automationId: auto._id,
                          name: data.name,
                          description: data.description,
                          trigger: data.trigger,
                          actions: data.actions,
                        });
                        setEditingAutoId(null);
                      }}
                      onCancel={() => setEditingAutoId(null)}
                    />
                  ) : (
                    <AutomationCard
                      key={auto._id}
                      automation={auto}
                      onToggle={() => toggleAutomation({ automationId: auto._id })}
                      onDelete={() => removeAutomation({ automationId: auto._id })}
                      onEdit={() => {
                        setEditingAutoId(auto._id);
                        setShowAutoForm(false);
                      }}
                    />
                  )
                )}
              </div>
            )}
          </Section>

          {/* ── Scheduled Actions ── */}
          <Section
            icon={<Calendar className="h-3.5 w-3.5 text-blue-400" />}
            iconBg="bg-blue-950/50"
            title="Scheduled Actions"
            count={schedules?.length}
            actionLabel="New"
            onAction={() => {
              setShowSchedForm(true);
              setShowAutoForm(false);
            }}
          >
            {showSchedForm && (
              <ScheduleForm
                agentId={agentId as string}
                onCreate={async (data) => {
                  await createSchedule(data);
                  setShowSchedForm(false);
                }}
                onCancel={() => setShowSchedForm(false)}
              />
            )}

            {schedules === undefined ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-zinc-800/20 animate-pulse" />
                ))}
              </div>
            ) : schedules.length === 0 && !showSchedForm ? (
              <div className="text-center py-8">
                <Calendar className="h-8 w-8 text-zinc-800 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-medium">No scheduled actions yet</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Run cron jobs, intervals, and one-time tasks
                </p>
                <button
                  onClick={() => setShowSchedForm(true)}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors mx-auto"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Schedule
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {schedules.map((sched) =>
                  editingSchedId === sched._id ? (
                    <ScheduleForm
                      key={sched._id}
                      agentId={agentId as string}
                      initialData={{
                        name: sched.name,
                        description: sched.description,
                        schedule: sched.schedule,
                        scheduleType: sched.scheduleType as "cron" | "interval" | "once",
                        action: sched.action as { type: ScheduleActionType; config: any },
                      }}
                      onCreate={async (data) => {
                        await updateSchedule({
                          actionId: sched._id,
                          name: data.name,
                          description: data.description,
                          schedule: data.schedule,
                          scheduleType: data.scheduleType,
                          action: data.action,
                        });
                        setEditingSchedId(null);
                      }}
                      onCancel={() => setEditingSchedId(null)}
                    />
                  ) : (
                    <ScheduleCard
                      key={sched._id}
                      schedule={sched}
                      onToggle={() => toggleSchedule({ actionId: sched._id })}
                      onDelete={() => removeSchedule({ actionId: sched._id })}
                      onEdit={() => {
                        setEditingSchedId(sched._id);
                        setShowSchedForm(false);
                      }}
                    />
                  )
                )}
              </div>
            )}
          </Section>

          {/* ── Webhooks ── */}
          {webhooks && webhooks.length > 0 && (
            <Section
              icon={<Webhook className="h-3.5 w-3.5 text-purple-400" />}
              iconBg="bg-purple-950/50"
              title="Webhooks"
              count={webhooks.length}
            >
              <div className="space-y-2">
                {webhooks.map((wh) => (
                  <WebhookCard key={wh._id} webhook={wh} />
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-3">
                Manage webhooks from individual API pages.
              </p>
            </Section>
          )}

          {/* ── Event Log ── */}
          <Section
            icon={<Activity className="h-3.5 w-3.5 text-green-400" />}
            iconBg="bg-green-950/50"
            title="Event Log"
            count={events?.length}
          >
            {events === undefined ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-zinc-800/20 animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-zinc-800 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-medium">No events yet</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Events appear here when your agent takes actions
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-zinc-800/20">
                  {shownEvents.map((ev) => (
                    <EventLogEntry key={ev._id} event={ev} />
                  ))}
                </div>
                {events.length > eventLimit && (
                  <button
                    onClick={() => setEventLimit((l) => l + 50)}
                    className="mt-3 w-full text-xs text-zinc-600 hover:text-zinc-400 py-2 hover:bg-zinc-800/40 rounded-xl transition-colors"
                  >
                    Show more ({events.length - eventLimit} remaining)
                  </button>
                )}
              </>
            )}
          </Section>

        </div>
        )}
      </div>
    </div>
  );
}
