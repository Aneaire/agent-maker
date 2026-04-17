import { tool } from "../ai-sdk-shim.js";
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
  const apiTabs = tabs.filter((t) => t.type === "api");

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
  if (apiTabs.length > 0) {
    tools.push(...createApiPageTools(convexClient, agentId, apiTabs));
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
      "mcp__agent-tools__list_notes",
      "mcp__agent-tools__get_note"
    );
  }
  if (hasType("spreadsheet")) {
    allowed.push(
      "mcp__agent-tools__add_spreadsheet_column",
      "mcp__agent-tools__add_spreadsheet_columns",
      "mcp__agent-tools__add_spreadsheet_row",
      "mcp__agent-tools__add_spreadsheet_rows",
      "mcp__agent-tools__update_spreadsheet_row",
      "mcp__agent-tools__list_spreadsheet_data"
    );
  }
  if (hasType("markdown") || hasType("data_table")) {
    allowed.push(
      "mcp__agent-tools__write_page_content",
      "mcp__agent-tools__read_page_content"
    );
  }
  if (hasType("api")) {
    allowed.push(
      "mcp__agent-tools__list_api_endpoints",
      "mcp__agent-tools__create_api_endpoint",
      "mcp__agent-tools__update_api_endpoint",
      "mcp__agent-tools__toggle_api_endpoint",
      "mcp__agent-tools__list_api_keys"
    );
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
    `List tasks on a Tasks page. Supports pagination for large boards. ${desc}`,
    {
      tabId: z.string().describe("The tab ID to list tasks from"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max number of tasks to return (default: all, capped at tab limit of 500)"),
      offset: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Number of tasks to skip before returning results (for pagination)"),
    },
    async (input) => {
      const result = await convexClient.listTasks(input.tabId, {
        limit: input.limit,
        offset: input.offset,
      });
      const tasks = result?.tasks ?? [];
      const totalCount = result?.totalCount ?? 0;
      if (tasks.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No tasks found${totalCount > 0 ? ` in this range (total: ${totalCount})` : ""}.` }],
        };
      }
      const offset = input.offset ?? 0;
      const header = `Showing ${tasks.length} of ${totalCount} task${totalCount === 1 ? "" : "s"}${offset > 0 ? ` (offset ${offset})` : ""}:`;
      const text = tasks
        .map(
          (t: any) =>
            `- [${t._id}] ${t.title} (${t.status})${t.priority ? ` [${t.priority}]` : ""}${t.description ? `: ${t.description}` : ""}`
        )
        .join("\n");
      return { content: [{ type: "text" as const, text: `${header}\n${text}` }] };
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
    `List notes on a Notes page. Returns titles + content length only — use get_note to fetch the full content of a specific note. ${desc}`,
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

  const getNoteTool = tool(
    "get_note",
    `Read the full content of a note by its ID. Use list_notes first to discover note IDs and titles.`,
    {
      noteId: z.string().describe("The note ID to read"),
    },
    async (input) => {
      const note = await convexClient.getNote(input.noteId);
      if (!note) {
        return {
          content: [{ type: "text" as const, text: `Note ${input.noteId} not found.` }],
        };
      }
      const updatedAt = note.updatedAt
        ? new Date(note.updatedAt).toISOString()
        : "unknown";
      return {
        content: [
          {
            type: "text" as const,
            text: `# ${note.title}\n_Updated: ${updatedAt}_\n\n${note.content}`,
          },
        ],
      };
    }
  );

  return [saveNote, updateNoteTool, listNotesTool, getNoteTool];
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

  const addColumnsBatch = tool(
    "add_spreadsheet_columns",
    `Add MULTIPLE columns to a Spreadsheet page in one call. Prefer this over add_spreadsheet_column when adding 2+ columns at once — it's one tool call instead of N. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
      columns: z
        .array(
          z.object({
            name: z.string().describe("Column name"),
            type: z
              .enum(["text", "number", "date", "checkbox"])
              .describe("Column data type"),
          })
        )
        .min(1)
        .describe("Array of columns to create, in the order they should appear"),
    },
    async (input) => {
      const result = await convexClient.addSpreadsheetColumns(
        input.tabId,
        agentId,
        input.columns
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.insertedIds.length} column${result.insertedIds.length === 1 ? "" : "s"}: ${input.columns.map((c: { name: string; type: string }) => `"${c.name}" (${c.type})`).join(", ")}`,
          },
        ],
      };
    }
  );

  const addRowsBatch = tool(
    "add_spreadsheet_rows",
    `Add MULTIPLE rows to a Spreadsheet page in one call. Prefer this over add_spreadsheet_row when inserting 2+ rows — it's one tool call instead of N. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
      rows: z
        .array(z.record(z.any()))
        .min(1)
        .describe(
          'Array of rows, each row is a { columnName: value } object. Example: [{"Name":"Alice","Age":30},{"Name":"Bob","Age":25}]'
        ),
    },
    async (input) => {
      const result = await convexClient.addSpreadsheetRows(
        input.tabId,
        agentId,
        input.rows
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${result.insertedIds.length} row${result.insertedIds.length === 1 ? "" : "s"} to spreadsheet.`,
          },
        ],
      };
    }
  );

  const listData = tool(
    "list_spreadsheet_data",
    `Get columns and rows from a Spreadsheet page. Supports row pagination via rowLimit/rowOffset — use these for sheets with many rows to avoid loading everything. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
      rowLimit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max rows to return (default: all)"),
      rowOffset: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Number of rows to skip before returning results (for pagination)"),
    },
    async (input) => {
      const data = await convexClient.listSpreadsheetData(input.tabId, {
        rowLimit: input.rowLimit,
        rowOffset: input.rowOffset,
      });
      if (!data) {
        return {
          content: [{ type: "text" as const, text: "No data found." }],
        };
      }
      const colNames = data.columns.map((c: any) => c.name);
      const header = `Columns: ${colNames.join(", ")}`;
      const offset = input.rowOffset ?? 0;
      const summary = `Showing ${data.rows.length} of ${data.totalRows} row${data.totalRows === 1 ? "" : "s"}${offset > 0 ? ` (offset ${offset})` : ""}`;
      const rows = data.rows
        .map(
          (r: any, i: number) =>
            `Row ${offset + i + 1} [${r._id}]: ${JSON.stringify(r.data)}`
        )
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n${summary}:\n${rows}`,
          },
        ],
      };
    }
  );

  return [addColumn, addColumnsBatch, addRow, addRowsBatch, updateRow, listData];
}

// ── Markdown/Data Table Tools ────────────────────────────────────────

function createMarkdownTools(convexClient: AgentConvexClient, tabs: Tab[]) {
  const desc = tabDescription(tabs);

  const writePage = tool(
    "write_page_content",
    `Write or update the content of a Markdown or Data Table page. Overwrites the entire page content. ${desc}`,
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

  const readPage = tool(
    "read_page_content",
    `Read the current content of a Markdown or Data Table page. Use this before editing to see what's there, or to answer questions about what's on the page. ${desc}`,
    {
      tabId: z.string().describe("The tab ID"),
    },
    async (input) => {
      const result = await convexClient.getTabContent(input.tabId);
      if (!result) {
        return {
          content: [
            { type: "text" as const, text: `Page ${input.tabId} not found.` },
          ],
        };
      }
      const body = result.content.length > 0 ? result.content : "_(empty)_";
      return {
        content: [
          {
            type: "text" as const,
            text: `# ${result.label}\n\n${body}`,
          },
        ],
      };
    }
  );

  return [writePage, readPage];
}

// ── API Page Tools ───────────────────────────────────────────────────
// Let the agent manage its own REST surface: list/create/update/toggle
// endpoints on api-type pages, and list API keys (masked).

function createApiPageTools(
  convexClient: AgentConvexClient,
  agentId: string,
  tabs: Tab[]
) {
  const desc = tabDescription(tabs);

  const methodEnum = z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]);
  const responseFormatEnum = z.enum(["json", "text"]);
  const fieldSpec = z.object({
    type: z.enum(["string", "number", "boolean", "object", "array"]),
    enum: z.array(z.any()).optional(),
    description: z.string().optional(),
  });
  const fieldMap = z
    .object({
      properties: z.record(fieldSpec).optional(),
      required: z.array(z.string()).optional(),
    })
    .optional();
  const inputSchemaShape = z
    .object({
      body: fieldMap,
      query: fieldMap,
    })
    .optional();

  const listEndpoints = tool(
    "list_api_endpoints",
    `List all REST API endpoints configured on an API page. Returns each endpoint's method, slug, prompt template, active state, allowed tool sets, and input schema. ${desc}`,
    {
      tabId: z.string().describe("The API tab ID"),
    },
    async (input) => {
      const endpoints = await convexClient.listApiEndpoints(input.tabId);
      if (!endpoints || endpoints.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No endpoints configured on this API page yet. Use create_api_endpoint to add one.",
            },
          ],
        };
      }
      const lines = endpoints.map((e: any) => {
        const toolsLine = e.allowedToolSets
          ? `\n  allowedToolSets: [${(e.allowedToolSets as string[]).join(", ") || "none"}]`
          : "\n  allowedToolSets: (inherits agent)";
        const schemaLine = e.inputSchema
          ? `\n  inputSchema: ${JSON.stringify(e.inputSchema)}`
          : "";
        return `- [${e._id}] ${e.method} /${e.slug} — ${e.name} ${e.isActive ? "(active)" : "(inactive)"}\n  responseFormat: ${e.responseFormat}${toolsLine}${schemaLine}\n  prompt: ${e.promptTemplate.slice(0, 200)}${e.promptTemplate.length > 200 ? "…" : ""}`;
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `${endpoints.length} endpoint${endpoints.length === 1 ? "" : "s"}:\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );

  const createEndpoint = tool(
    "create_api_endpoint",
    `Create a new REST API endpoint on an API page. Endpoints are exposed at /api/<agentId>/<slug> (the slug is derived from the name). The agent server runs the promptTemplate against the incoming request and returns the response. ${desc}`,
    {
      tabId: z.string().describe("The API tab ID"),
      name: z
        .string()
        .describe("Human-readable name; slug is derived from this (lowercased, non-alphanumeric → dashes)"),
      method: methodEnum.describe("HTTP method this endpoint responds to"),
      promptTemplate: z
        .string()
        .describe(
          "Instructions the agent will follow when this endpoint is hit. Supports template variables: {{body.<field>}}, {{query.<field>}}, {{headers.<header-name>}}. Example: 'Look up the user {{query.email}} and return their last 5 events.'"
        ),
      description: z.string().optional().describe("Short description shown in the API page UI"),
      responseFormat: responseFormatEnum
        .optional()
        .describe("'json' (default) requires the agent to return valid JSON; 'text' returns raw text"),
      isActive: z
        .boolean()
        .optional()
        .describe("Whether the endpoint is live (default: true)"),
      allowedToolSets: z
        .array(z.string())
        .optional()
        .describe(
          "Security allowlist: if set, the agent ONLY gets these tool sets during this endpoint's run (must be a subset of the agent's enabled tool sets). Omit to inherit all enabled tool sets."
        ),
      inputSchema: inputSchemaShape.describe(
        "Optional validation shape. Example: { body: { properties: { feedback: { type: 'string' } }, required: ['feedback'] } }"
      ),
    },
    async (input) => {
      const endpointId = await convexClient.createApiEndpoint(
        input.tabId,
        agentId,
        {
          name: input.name,
          method: input.method,
          description: input.description,
          promptTemplate: input.promptTemplate,
          responseFormat: input.responseFormat,
          isActive: input.isActive,
          allowedToolSets: input.allowedToolSets,
          inputSchema: input.inputSchema,
        }
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Created endpoint "${input.name}" (${input.method}, ID: ${endpointId}). It is ${input.isActive === false ? "inactive" : "live"} at /api/<agentId>/<slug>.`,
          },
        ],
      };
    }
  );

  const updateEndpoint = tool(
    "update_api_endpoint",
    `Update an existing REST API endpoint's configuration. Use list_api_endpoints to get endpoint IDs. Only the fields you pass are changed.`,
    {
      endpointId: z.string().describe("The endpoint ID to update"),
      name: z.string().optional(),
      method: methodEnum.optional(),
      description: z.string().optional(),
      promptTemplate: z.string().optional(),
      responseFormat: responseFormatEnum.optional(),
      isActive: z.boolean().optional(),
      allowedToolSets: z.array(z.string()).optional(),
      inputSchema: inputSchemaShape,
    },
    async (input) => {
      const { endpointId, ...rest } = input;
      await convexClient.updateApiEndpoint(endpointId, rest);
      const changed = Object.keys(rest).filter(
        (k) => (rest as any)[k] !== undefined
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated endpoint ${endpointId}${changed.length ? ` (changed: ${changed.join(", ")})` : ""}.`,
          },
        ],
      };
    }
  );

  const toggleEndpoint = tool(
    "toggle_api_endpoint",
    `Activate or deactivate a REST API endpoint without deleting it. Inactive endpoints return 404.`,
    {
      endpointId: z.string().describe("The endpoint ID"),
      isActive: z.boolean().describe("true = live, false = returns 404"),
    },
    async (input) => {
      await convexClient.toggleApiEndpoint(input.endpointId, input.isActive);
      return {
        content: [
          {
            type: "text" as const,
            text: `Endpoint ${input.endpointId} is now ${input.isActive ? "active" : "inactive"}.`,
          },
        ],
      };
    }
  );

  const listKeys = tool(
    "list_api_keys",
    `List API keys for this agent (masked — only last 8 chars shown). Use this to tell the user which keys exist; never show full keys from memory.`,
    {},
    async () => {
      const keys = await convexClient.listApiKeysForAgent(agentId);
      if (!keys || keys.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No API keys configured for this agent. The user can create one from the API page in the UI.",
            },
          ],
        };
      }
      const text = keys
        .map(
          (k: any) =>
            `- "${k.label}" (${k.maskedKey}) — created ${new Date(k.createdAt).toISOString().slice(0, 10)}`
        )
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  return [listEndpoints, createEndpoint, updateEndpoint, toggleEndpoint, listKeys];
}
