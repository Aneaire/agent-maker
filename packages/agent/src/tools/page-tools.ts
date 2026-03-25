import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface Tab {
  _id: string;
  type: string;
  label: string;
}

/**
 * Creates MCP tools for page interactions.
 * Always includes create_page. Other tools are registered based on existing tabs.
 */
export function createPageTools(
  convexClient: AgentConvexClient,
  agentId: string,
  tabs: Tab[]
) {
  const tools: any[] = [];

  // Always available — agent can create new pages autonomously
  tools.push(createPageTool(convexClient, agentId));

  const taskTabs = tabs.filter((t) => t.type === "tasks");
  const noteTabs = tabs.filter((t) => t.type === "notes");
  const spreadsheetTabs = tabs.filter((t) => t.type === "spreadsheet");
  const markdownTabs = tabs.filter(
    (t) => t.type === "markdown" || t.type === "data_table"
  );

  if (taskTabs.length > 0) {
    tools.push(...createTaskTools(convexClient, agentId, taskTabs));
  }
  if (noteTabs.length > 0) {
    tools.push(...createNoteTools(convexClient, agentId, noteTabs));
  }
  if (spreadsheetTabs.length > 0) {
    tools.push(
      ...createSpreadsheetTools(convexClient, agentId, spreadsheetTabs)
    );
  }
  if (markdownTabs.length > 0) {
    tools.push(...createMarkdownTools(convexClient, markdownTabs));
  }

  return tools;
}

/**
 * Returns the allowed tool names for page tools.
 * Always includes create_page.
 */
export function getPageToolNames(tabs: Tab[]): string[] {
  const allowed = ["mcp__agent-tools__create_page"];

  const hasType = (type: string) => tabs.some((t) => t.type === type);

  if (hasType("tasks")) {
    allowed.push(
      "mcp__agent-tools__create_task",
      "mcp__agent-tools__update_task",
      "mcp__agent-tools__list_tasks"
    );
  }
  if (hasType("notes")) {
    allowed.push(
      "mcp__agent-tools__save_note",
      "mcp__agent-tools__update_note",
      "mcp__agent-tools__list_notes"
    );
  }
  if (hasType("spreadsheet")) {
    allowed.push(
      "mcp__agent-tools__add_spreadsheet_column",
      "mcp__agent-tools__add_spreadsheet_row",
      "mcp__agent-tools__update_spreadsheet_row",
      "mcp__agent-tools__list_spreadsheet_data"
    );
  }
  if (hasType("markdown") || hasType("data_table")) {
    allowed.push("mcp__agent-tools__write_page_content");
  }

  return allowed;
}

function tabDescription(tabs: Tab[]): string {
  if (tabs.length === 1)
    return `Tab: "${tabs[0].label}" (ID: ${tabs[0]._id})`;
  return `Available tabs: ${tabs.map((t) => `"${t.label}" (ID: ${t._id})`).join(", ")}`;
}

// ── Create Page Tool (always available) ──────────────────────────────

function createPageTool(convexClient: AgentConvexClient, agentId: string) {
  return tool(
    "create_page",
    `Create a new page/tab for this agent. Use this when the user needs a new organizational tool — e.g. a task board, notes section, spreadsheet for tracking data, or a markdown page. The page appears immediately in the sidebar.`,
    {
      label: z.string().describe("Display name for the page (e.g. 'Project Tasks', 'Meeting Notes')"),
      type: z
        .enum(["tasks", "notes", "spreadsheet", "markdown", "data_table"])
        .describe(
          "Page type: 'tasks' (kanban board), 'notes' (markdown notes), 'spreadsheet' (data table with columns), 'markdown' (read-only page you can write to), 'data_table' (read-only table)"
        ),
    },
    async (input) => {
      const tabId = await convexClient.createPage(
        agentId,
        input.label,
        input.type
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Created "${input.label}" page (type: ${input.type}, ID: ${tabId}). It's now visible in the sidebar.${
              input.type === "spreadsheet"
                ? " Use add_spreadsheet_column to set up columns, then add_spreadsheet_row to add data."
                : ""
            }`,
          },
        ],
      };
    }
  );
}

// ── Task Tools ───────────────────────────────────────────────────────

function createTaskTools(
  convexClient: AgentConvexClient,
  agentId: string,
  tabs: Tab[]
) {
  const desc = tabDescription(tabs);

  const createTask = tool(
    "create_task",
    `Create a new task on a Tasks page. ${desc}`,
    {
      tabId: z.string().describe("The tab ID to create the task in"),
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      status: z
        .enum(["todo", "in_progress", "done"])
        .optional()
        .describe("Task status (default: todo)"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Task priority"),
    },
    async (input) => {
      const taskId = await convexClient.createTask(input.tabId, agentId, {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
      });
      await convexClient.emitEvent(agentId, "task.created", "page_tools", {
        taskId,
        tabId: input.tabId,
        title: input.title,
        description: input.description,
        status: input.status ?? "todo",
        priority: input.priority,
      });
      return {
        content: [
          { type: "text" as const, text: `Created task: "${input.title}"` },
        ],
      };
    }
  );

  const updateTaskTool = tool(
    "update_task",
    `Update an existing task. Use list_tasks first to get task IDs.`,
    {
      taskId: z.string().describe("The task ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.enum(["todo", "in_progress", "done"]).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
    },
    async (input) => {
      // Fetch full task before update so we can include all fields in the event
      const taskBefore = await convexClient.getTask(input.taskId);
      await convexClient.updateTask(input.taskId, {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
      });
      const changed = Object.keys(input).filter((k) => k !== "taskId" && (input as any)[k] !== undefined);
      await convexClient.emitEvent(agentId, "task.updated", "page_tools", {
        taskId: input.taskId,
        title: input.title ?? taskBefore?.title,
        description: input.description ?? taskBefore?.description,
        status: input.status ?? taskBefore?.status,
        priority: input.priority ?? taskBefore?.priority,
        tags: taskBefore?.tags,
        tabId: taskBefore?.tabId,
        changed,
      });
      return {
        content: [
          { type: "text" as const, text: `Updated task ${input.taskId}` },
        ],
      };
    }
  );

  const listTasksTool = tool(
    "list_tasks",
    `List all tasks on a Tasks page. ${desc}`,
    {
      tabId: z.string().describe("The tab ID to list tasks from"),
    },
    async (input) => {
      const tasks = await convexClient.listTasks(input.tabId);
      if (!tasks || tasks.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No tasks found." }],
        };
      }
      const text = tasks
        .map(
          (t: any) =>
            `- [${t._id}] ${t.title} (${t.status})${t.priority ? ` [${t.priority}]` : ""}${t.description ? `: ${t.description}` : ""}`
        )
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  return [createTask, updateTaskTool, listTasksTool];
}

// ── Note Tools ───────────────────────────────────────────────────────

function createNoteTools(
  convexClient: AgentConvexClient,
  agentId: string,
  tabs: Tab[]
) {
  const desc = tabDescription(tabs);

  const saveNote = tool(
    "save_note",
    `Create a new note on a Notes page. ${desc}`,
    {
      tabId: z.string().describe("The tab ID to save the note in"),
      title: z.string().describe("Note title"),
      content: z.string().optional().describe("Note content (markdown)"),
    },
    async (input) => {
      const noteId = await convexClient.createNote(input.tabId, agentId, {
        title: input.title,
        content: input.content,
      });
      await convexClient.emitEvent(agentId, "note.created", "page_tools", {
        noteId,
        tabId: input.tabId,
        title: input.title,
        content: input.content,
      });
      return {
        content: [
          { type: "text" as const, text: `Saved note: "${input.title}"` },
        ],
      };
    }
  );

  const updateNoteTool = tool(
    "update_note",
    `Update an existing note. Use list_notes first to get note IDs.`,
    {
      noteId: z.string().describe("The note ID to update"),
      title: z.string().optional(),
      content: z.string().optional().describe("New content (markdown)"),
    },
    async (input) => {
      const noteBefore = await convexClient.getNote(input.noteId);
      await convexClient.updateNote(input.noteId, {
        title: input.title,
        content: input.content,
      });
      const changed = Object.keys(input).filter((k) => k !== "noteId" && (input as any)[k] !== undefined);
      await convexClient.emitEvent(agentId, "note.updated", "page_tools", {
        noteId: input.noteId,
        title: input.title ?? noteBefore?.title,
        content: input.content ?? noteBefore?.content,
        tabId: noteBefore?.tabId,
        changed,
      });
      return {
        content: [
          { type: "text" as const, text: `Updated note ${input.noteId}` },
        ],
      };
    }
  );

  const listNotesTool = tool(
    "list_notes",
    `List all notes on a Notes page. ${desc}`,
    {
      tabId: z.string().describe("The tab ID to list notes from"),
    },
    async (input) => {
      const notes = await convexClient.listNotes(input.tabId);
      if (!notes || notes.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No notes found." }],
        };
      }
      const text = notes
        .map((n: any) => `- [${n._id}] ${n.title} (${n.content.length} chars)`)
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  return [saveNote, updateNoteTool, listNotesTool];
}

// ── Spreadsheet Tools ────────────────────────────────────────────────

function createSpreadsheetTools(
  convexClient: AgentConvexClient,
  agentId: string,
  tabs: Tab[]
) {
  const desc = tabDescription(tabs);

  const addColumn = tool(
    "add_spreadsheet_column",
    `Add a new column to a Spreadsheet page. Always set up columns before adding rows. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
      name: z.string().describe("Column name (e.g. 'Name', 'Email', 'Amount')"),
      type: z
        .enum(["text", "number", "date", "checkbox"])
        .describe("Column data type"),
    },
    async (input) => {
      await convexClient.addSpreadsheetColumn(
        input.tabId,
        agentId,
        input.name,
        input.type
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Added column "${input.name}" (${input.type})`,
          },
        ],
      };
    }
  );

  const addRow = tool(
    "add_spreadsheet_row",
    `Add a row to a Spreadsheet page. Pass data as an object mapping column names to values. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
      data: z
        .record(z.any())
        .describe(
          'Row data as { columnName: value }. Example: { "Name": "Alice", "Age": 30 }'
        ),
    },
    async (input) => {
      await convexClient.addSpreadsheetRow(input.tabId, agentId, input.data);
      return {
        content: [
          { type: "text" as const, text: "Added row to spreadsheet." },
        ],
      };
    }
  );

  const updateRow = tool(
    "update_spreadsheet_row",
    `Update an existing spreadsheet row.`,
    {
      rowId: z.string().describe("The row ID to update"),
      data: z.record(z.any()).describe("Updated row data"),
    },
    async (input) => {
      await convexClient.updateSpreadsheetRow(input.rowId, input.data);
      return {
        content: [
          { type: "text" as const, text: `Updated row ${input.rowId}` },
        ],
      };
    }
  );

  const listData = tool(
    "list_spreadsheet_data",
    `Get all columns and rows from a Spreadsheet page. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
    },
    async (input) => {
      const data = await convexClient.listSpreadsheetData(input.tabId);
      if (!data) {
        return {
          content: [{ type: "text" as const, text: "No data found." }],
        };
      }
      const colNames = data.columns.map((c: any) => c.name);
      const header = `Columns: ${colNames.join(", ")}`;
      const rows = data.rows
        .map(
          (r: any, i: number) =>
            `Row ${i + 1} [${r._id}]: ${JSON.stringify(r.data)}`
        )
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n${data.rows.length} rows:\n${rows}`,
          },
        ],
      };
    }
  );

  return [addColumn, addRow, updateRow, listData];
}

// ── Markdown/Data Table Tools ────────────────────────────────────────

function createMarkdownTools(convexClient: AgentConvexClient, tabs: Tab[]) {
  const desc = tabDescription(tabs);

  const writePage = tool(
    "write_page_content",
    `Write or update the content of a Markdown or Data Table page. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
      content: z
        .string()
        .describe("The full page content (markdown or plain text)"),
    },
    async (input) => {
      await convexClient.updateTabConfig(input.tabId, {
        content: input.content,
      });
      return {
        content: [
          { type: "text" as const, text: "Page content updated." },
        ],
      };
    }
  );

  return [writePage];
}
