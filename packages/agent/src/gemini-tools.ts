import { SchemaType } from "@google/generative-ai";
import type { AgentConvexClient } from "./convex-client.js";
import { embedText } from "./embeddings.js";

interface Tab {
  _id: string;
  type: string;
  label: string;
}

interface CustomToolConfig {
  _id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  inputSchema?: any;
  headers?: Record<string, string>;
}

interface ImageGenConfig {
  provider: "gemini" | "nano_banana";
  geminiApiKey?: string;
  nanoBananaApiKey?: string;
}

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface GSheetsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface GeminiToolDeps {
  convexClient: AgentConvexClient;
  agentId: string;
  messageId: string;
  enabledToolSets: string[];
  tabs: Tab[];
  customTools: CustomToolConfig[];
  imageGenConfig?: ImageGenConfig | null;
  imageGenModel?: string;
  gmailConfig?: GmailConfig | null;
  gsheetsConfig?: GSheetsConfig | null;
  onToolProgress?: (toolName: string, progress: string) => void;
}

// ── Google OAuth helper ───────────────────────────────────────────────
async function getGoogleAccessToken(config: { clientId: string; clientSecret: string; refreshToken: string }): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth error: ${data.error_description || data.error || res.status}`);
  return data.access_token;
}

async function gmailFetch(config: GmailConfig, path: string, method = "GET", body?: any) {
  const token = await getGoogleAccessToken(config);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (method === "DELETE" && res.status === 204) return {};
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gmail API error: ${res.status}`);
  return data;
}

async function sheetsFetch(config: GSheetsConfig, path: string, method = "GET", body?: any) {
  const token = await getGoogleAccessToken(config);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body && { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Sheets API error: ${res.status}`);
  return data;
}

function buildGmailMime(params: { to: string | string[]; subject: string; body: string; cc?: string[]; bcc?: string[]; replyTo?: string; inReplyTo?: string; references?: string }): string {
  const to = Array.isArray(params.to) ? params.to.join(", ") : params.to;
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`,
    `Content-Type: text/html; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ];
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(", ")}`);
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(", ")}`);
  if (params.replyTo) lines.push(`Reply-To: ${params.replyTo}`);
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) lines.push(`References: ${params.references}`);
  lines.push("", params.body);
  return Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function gmailHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: typeof SchemaType.OBJECT;
    properties: Record<string, any>;
    required?: string[];
  };
}

export type ToolHandler = (args: Record<string, any>) => Promise<string>;

function has(sets: string[], name: string): boolean {
  return sets.includes(name);
}

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio >= 1.7) return "16:9";
  if (ratio >= 1.4) return "3:2";
  if (ratio >= 1.2) return "4:3";
  if (ratio >= 0.9) return "1:1";
  if (ratio >= 0.7) return "3:4";
  if (ratio >= 0.6) return "2:3";
  return "9:16";
}

function tabDescription(tabs: Tab[]): string {
  if (tabs.length === 1)
    return `Tab: "${tabs[0].label}" (ID: ${tabs[0]._id})`;
  return `Available tabs: ${tabs.map((t) => `"${t.label}" (ID: ${t._id})`).join(", ")}`;
}

/**
 * Builds Gemini-compatible function declarations and handler map
 * from the same dependencies used for MCP tools.
 */
export function buildGeminiTools(deps: GeminiToolDeps): {
  declarations: GeminiFunctionDeclaration[];
  handlers: Record<string, ToolHandler>;
} {
  const declarations: GeminiFunctionDeclaration[] = [];
  const handlers: Record<string, ToolHandler> = {};
  const enabled = deps.enabledToolSets;

  // ── Memory tools ──────────────────────────────────────────────────
  if (has(enabled, "memory")) {
    declarations.push({
      name: "store_memory",
      description:
        "Store a piece of information for future reference. Use this when the user shares preferences, important details, or asks you to remember something.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          content: {
            type: SchemaType.STRING,
            description: "The information to remember, written as a clear statement",
          },
          category: {
            type: SchemaType.STRING,
            description:
              'Category for organization, e.g. "preference", "personal", "work", "project"',
          },
        },
        required: ["content"],
      },
    });
    handlers.store_memory = async (args) => {
      let embedding: number[] | undefined;
      try {
        embedding = await embedText(args.content);
      } catch {}
      await deps.convexClient.storeMemory(deps.agentId, args.content, args.category, embedding);
      return `Stored memory: "${args.content}"`;
    };

    declarations.push({
      name: "recall_memory",
      description:
        "Search your memories. Use this to recall stored information before answering questions about user preferences or past conversations.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "Search query to find relevant memories",
          },
        },
        required: ["query"],
      },
    });
    handlers.recall_memory = async (args) => {
      let memories: any[] | null = null;

      try {
        const embedding = await embedText(args.query);
        const results = await deps.convexClient.searchMemoriesVector(deps.agentId, embedding);
        if (results && results.length > 0) {
          memories = results;
        }
      } catch {}

      if (!memories || memories.length === 0) {
        memories = await deps.convexClient.searchMemories(deps.agentId, args.query);
      }

      if (!memories || memories.length === 0) return "No relevant memories found.";
      return memories
        .map((m: any) => `- ${m.content}${m.category ? ` [${m.category}]` : ""}`)
        .join("\n");
    };

    declarations.push({
      name: "search_memories",
      description:
        "List all stored memories, optionally filtered. Use when the user wants to see what you remember.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "Optional search query to filter memories",
          },
        },
      },
    });
    handlers.search_memories = async (args) => {
      if (args.query) {
        let memories: any[] | null = null;

        try {
          const embedding = await embedText(args.query);
          const results = await deps.convexClient.searchMemoriesVector(deps.agentId, embedding);
          if (results && results.length > 0) {
            memories = results;
          }
        } catch {}

        if (!memories || memories.length === 0) {
          memories = await deps.convexClient.searchMemories(deps.agentId, args.query);
        }

        if (!memories || memories.length === 0) return "No memories match that search.";
        return memories
          .map((m: any) => `- ${m.content}${m.category ? ` [${m.category}]` : ""}`)
          .join("\n");
      }
      const memories = await deps.convexClient.listMemories(deps.agentId);
      if (!memories || memories.length === 0) return "No memories stored yet.";
      return memories
        .map((m: any) => `- ${m.content}${m.category ? ` [${m.category}]` : ""}`)
        .join("\n");
    };
  }

  // ── Page tools ────────────────────────────────────────────────────
  if (has(enabled, "pages")) {
    // create_page (always available when pages enabled)
    declarations.push({
      name: "create_page",
      description:
        "Create a new page/tab for this agent. The page appears immediately in the sidebar.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          label: {
            type: SchemaType.STRING,
            description: "Display name for the page (e.g. 'Project Tasks')",
          },
          type: {
            type: SchemaType.STRING,
            description:
              "Page type: 'tasks' (kanban board), 'notes' (markdown notes), 'spreadsheet' (data table), 'markdown' (read-only page), 'data_table' (read-only table)",
            enum: ["tasks", "notes", "spreadsheet", "markdown", "data_table"],
          },
        },
        required: ["label", "type"],
      },
    });
    handlers.create_page = async (args) => {
      const tabId = await deps.convexClient.createPage(deps.agentId, args.label, args.type);
      const extra =
        args.type === "spreadsheet"
          ? " Use add_spreadsheet_column to set up columns, then add_spreadsheet_row to add data."
          : "";
      return `Created "${args.label}" page (type: ${args.type}, ID: ${tabId}).${extra}`;
    };

    // Task tools
    const taskTabs = deps.tabs.filter((t) => t.type === "tasks");
    if (taskTabs.length > 0) {
      const desc = tabDescription(taskTabs);

      declarations.push({
        name: "create_task",
        description: `Create a new task on a Tasks page. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID to create the task in" },
            title: { type: SchemaType.STRING, description: "Task title" },
            description: { type: SchemaType.STRING, description: "Task description" },
            status: {
              type: SchemaType.STRING,
              description: "Task status (default: todo)",
              enum: ["todo", "in_progress", "done"],
            },
            priority: {
              type: SchemaType.STRING,
              description: "Task priority",
              enum: ["low", "medium", "high"],
            },
          },
          required: ["tabId", "title"],
        },
      });
      handlers.create_task = async (args) => {
        await deps.convexClient.createTask(args.tabId, deps.agentId, {
          title: args.title,
          description: args.description,
          status: args.status,
          priority: args.priority,
        });
        return `Created task: "${args.title}"`;
      };

      declarations.push({
        name: "update_task",
        description: "Update an existing task. Use list_tasks first to get task IDs.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING, description: "The task ID to update" },
            title: { type: SchemaType.STRING, description: "New title" },
            description: { type: SchemaType.STRING, description: "New description" },
            status: {
              type: SchemaType.STRING,
              enum: ["todo", "in_progress", "done"],
            },
            priority: {
              type: SchemaType.STRING,
              enum: ["low", "medium", "high"],
            },
          },
          required: ["taskId"],
        },
      });
      handlers.update_task = async (args) => {
        await deps.convexClient.updateTask(args.taskId, {
          title: args.title,
          description: args.description,
          status: args.status,
          priority: args.priority,
        });
        return `Updated task ${args.taskId}`;
      };

      declarations.push({
        name: "list_tasks",
        description: `List all tasks on a Tasks page. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID to list tasks from" },
          },
          required: ["tabId"],
        },
      });
      handlers.list_tasks = async (args) => {
        const tasks = await deps.convexClient.listTasks(args.tabId);
        if (!tasks || tasks.length === 0) return "No tasks found.";
        return tasks
          .map(
            (t: any) =>
              `- [${t._id}] ${t.title} (${t.status})${t.priority ? ` [${t.priority}]` : ""}${t.description ? `: ${t.description}` : ""}`
          )
          .join("\n");
      };
    }

    // Note tools
    const noteTabs = deps.tabs.filter((t) => t.type === "notes");
    if (noteTabs.length > 0) {
      const desc = tabDescription(noteTabs);

      declarations.push({
        name: "save_note",
        description: `Create a new note on a Notes page. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID to save the note in" },
            title: { type: SchemaType.STRING, description: "Note title" },
            content: { type: SchemaType.STRING, description: "Note content (markdown)" },
          },
          required: ["tabId", "title"],
        },
      });
      handlers.save_note = async (args) => {
        await deps.convexClient.createNote(args.tabId, deps.agentId, {
          title: args.title,
          content: args.content,
        });
        return `Saved note: "${args.title}"`;
      };

      declarations.push({
        name: "update_note",
        description: "Update an existing note. Use list_notes first to get note IDs.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            noteId: { type: SchemaType.STRING, description: "The note ID to update" },
            title: { type: SchemaType.STRING, description: "New title" },
            content: { type: SchemaType.STRING, description: "New content (markdown)" },
          },
          required: ["noteId"],
        },
      });
      handlers.update_note = async (args) => {
        await deps.convexClient.updateNote(args.noteId, {
          title: args.title,
          content: args.content,
        });
        return `Updated note ${args.noteId}`;
      };

      declarations.push({
        name: "list_notes",
        description: `List all notes on a Notes page. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID to list notes from" },
          },
          required: ["tabId"],
        },
      });
      handlers.list_notes = async (args) => {
        const notes = await deps.convexClient.listNotes(args.tabId);
        if (!notes || notes.length === 0) return "No notes found.";
        return notes
          .map((n: any) => `- [${n._id}] ${n.title} (${n.content.length} chars)`)
          .join("\n");
      };
    }

    // Spreadsheet tools
    const spreadsheetTabs = deps.tabs.filter((t) => t.type === "spreadsheet");
    if (spreadsheetTabs.length > 0) {
      const desc = tabDescription(spreadsheetTabs);

      declarations.push({
        name: "add_spreadsheet_column",
        description: `Add a new column to a Spreadsheet page. Always set up columns before adding rows. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID" },
            name: { type: SchemaType.STRING, description: "Column name" },
            type: {
              type: SchemaType.STRING,
              description: "Column data type",
              enum: ["text", "number", "date", "checkbox"],
            },
          },
          required: ["tabId", "name", "type"],
        },
      });
      handlers.add_spreadsheet_column = async (args) => {
        await deps.convexClient.addSpreadsheetColumn(args.tabId, deps.agentId, args.name, args.type);
        return `Added column "${args.name}" (${args.type})`;
      };

      declarations.push({
        name: "add_spreadsheet_row",
        description: `Add a row to a Spreadsheet page. Pass data as an object mapping column names to values. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID" },
            data: {
              type: SchemaType.OBJECT,
              description: 'Row data as { columnName: value }',
              properties: {},
            },
          },
          required: ["tabId", "data"],
        },
      });
      handlers.add_spreadsheet_row = async (args) => {
        await deps.convexClient.addSpreadsheetRow(args.tabId, deps.agentId, args.data);
        return "Added row to spreadsheet.";
      };

      declarations.push({
        name: "update_spreadsheet_row",
        description: "Update an existing spreadsheet row.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            rowId: { type: SchemaType.STRING, description: "The row ID to update" },
            data: {
              type: SchemaType.OBJECT,
              description: "Updated row data",
              properties: {},
            },
          },
          required: ["rowId", "data"],
        },
      });
      handlers.update_spreadsheet_row = async (args) => {
        await deps.convexClient.updateSpreadsheetRow(args.rowId, args.data);
        return `Updated row ${args.rowId}`;
      };

      declarations.push({
        name: "list_spreadsheet_data",
        description: `Get all columns and rows from a Spreadsheet page. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID" },
          },
          required: ["tabId"],
        },
      });
      handlers.list_spreadsheet_data = async (args) => {
        const data = await deps.convexClient.listSpreadsheetData(args.tabId);
        if (!data) return "No data found.";
        const colNames = data.columns.map((c: any) => c.name);
        const header = `Columns: ${colNames.join(", ")}`;
        const rows = data.rows
          .map((r: any, i: number) => `Row ${i + 1} [${r._id}]: ${JSON.stringify(r.data)}`)
          .join("\n");
        return `${header}\n${data.rows.length} rows:\n${rows}`;
      };
    }

    // Markdown/Data Table tools
    const markdownTabs = deps.tabs.filter(
      (t) => t.type === "markdown" || t.type === "data_table"
    );
    if (markdownTabs.length > 0) {
      const desc = tabDescription(markdownTabs);

      declarations.push({
        name: "write_page_content",
        description: `Write or update the content of a Markdown or Data Table page. ${desc}`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tabId: { type: SchemaType.STRING, description: "The tab ID" },
            content: {
              type: SchemaType.STRING,
              description: "The full page content (markdown or plain text)",
            },
          },
          required: ["tabId", "content"],
        },
      });
      handlers.write_page_content = async (args) => {
        await deps.convexClient.updateTabConfig(args.tabId, { content: args.content });
        return "Page content updated.";
      };
    }
  }

  // ── Suggest tools (always included) ───────────────────────────────
  declarations.push({
    name: "suggest_replies",
    description:
      "Suggest follow-up questions or actions the user might want. Call at the END of your response. Keep each under 60 chars.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        suggestions: {
          type: SchemaType.ARRAY,
          description: "Array of 2-4 suggested follow-up messages",
          items: { type: SchemaType.STRING },
        },
      },
      required: ["suggestions"],
    },
  });
  handlers.suggest_replies = async (args) => {
    const suggestions = args.suggestions as string[];
    await deps.convexClient.setSuggestions(deps.messageId, suggestions);
    return `Set ${suggestions.length} suggestions.`;
  };

  declarations.push({
    name: "ask_questions",
    description:
      "Present interactive multiple-choice questions to the user. Use INSTEAD of writing options as bullet points. Always include a flexible last option.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        questions: {
          type: SchemaType.ARRAY,
          description: "Array of questions with selectable options",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING, description: "Unique short ID" },
              question: { type: SchemaType.STRING, description: "The question text" },
              options: {
                type: SchemaType.ARRAY,
                description: "Selectable options (2-6, under 40 chars each)",
                items: { type: SchemaType.STRING },
              },
            },
            required: ["id", "question", "options"],
          },
        },
      },
      required: ["questions"],
    },
  });
  handlers.ask_questions = async (args) => {
    const questions = args.questions as Array<{
      id: string;
      question: string;
      options: string[];
    }>;
    await deps.convexClient.setQuestions(deps.messageId, questions);
    return `Presented ${questions.length} question(s). Wait for user selections.`;
  };

  // ── RAG / Knowledge Base tools ──────────────────────────────────────
  if (has(enabled, "rag")) {
    declarations.push({
      name: "search_documents",
      description:
        "Search uploaded documents in the knowledge base for relevant information. Use this when the user asks about content from uploaded files.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "The search query to find relevant document content",
          },
        },
        required: ["query"],
      },
    });
    handlers.search_documents = async (args) => {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return "Error: GEMINI_API_KEY is not configured";
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(args.query);
        const embedding = result.embedding.values;
        const results = await deps.convexClient.searchDocumentChunks(deps.agentId, embedding);
        if (!results || results.length === 0) return "No relevant content found in uploaded documents.";
        return results
          .map((r: any) => `[Source: ${r.fileName}]\n${r.content}`)
          .join("\n\n---\n\n");
      } catch (err: any) {
        return `Error searching documents: ${err.message}`;
      }
    };
  }

  // ── Custom HTTP tools ─────────────────────────────────────────────
  if (has(enabled, "custom_http_tools") && deps.customTools.length > 0) {
    for (const config of deps.customTools) {
      const toolName = `custom_${config.name}`;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      if (config.inputSchema && typeof config.inputSchema === "object") {
        for (const [key, def] of Object.entries(config.inputSchema)) {
          const fieldDef = def as any;
          let schemaType: any;
          switch (fieldDef.type) {
            case "number":
              schemaType = SchemaType.NUMBER;
              break;
            case "boolean":
              schemaType = SchemaType.BOOLEAN;
              break;
            case "array":
              schemaType = SchemaType.ARRAY;
              break;
            case "object":
              schemaType = SchemaType.OBJECT;
              break;
            default:
              schemaType = SchemaType.STRING;
          }
          properties[key] = { type: schemaType, description: fieldDef.description ?? key };
          if (!fieldDef.optional) required.push(key);
        }
      }

      if (Object.keys(properties).length === 0) {
        if (["POST", "PUT", "PATCH"].includes(config.method)) {
          properties.body = { type: SchemaType.STRING, description: "Request body (JSON string)" };
        } else if (config.method === "GET") {
          properties.query = {
            type: SchemaType.STRING,
            description: "Query parameters (e.g. ?key=value)",
          };
        }
      }

      declarations.push({
        name: toolName,
        description: config.description,
        parameters:
          Object.keys(properties).length > 0
            ? {
                type: SchemaType.OBJECT,
                properties,
                required: required.length > 0 ? required : undefined,
              }
            : undefined,
      });

      handlers[toolName] = async (args) => {
        try {
          let url = config.endpoint;
          const fetchOpts: RequestInit = {
            method: config.method,
            headers: {
              "Content-Type": "application/json",
              ...(config.headers ?? {}),
            },
          };

          if (config.method === "GET") {
            if (args.query) {
              url += (url.includes("?") ? "&" : "?") + args.query;
            }
          } else {
            const { body: rawBody, ...otherFields } = args;
            const bodyData =
              Object.keys(otherFields).length > 0
                ? otherFields
                : rawBody
                  ? JSON.parse(rawBody)
                  : undefined;
            if (bodyData) fetchOpts.body = JSON.stringify(bodyData);
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          fetchOpts.signal = controller.signal;

          const response = await fetch(url, fetchOpts);
          clearTimeout(timeout);
          const responseText = await response.text();
          const maxLen = 10000;
          const truncated =
            responseText.length > maxLen
              ? responseText.substring(0, maxLen) + "\n...(truncated)"
              : responseText;
          return `HTTP ${response.status} ${response.statusText}\n\n${truncated}`;
        } catch (err: any) {
          return `Error calling ${config.endpoint}: ${err.message}`;
        }
      };
    }
  }

  // ── Image Generation tools ────────────────────────────────────────
  if (has(enabled, "image_generation")) {
    declarations.push({
      name: "generate_image",
      description:
        "Generate an image from a text prompt using AI. The image is saved to the agent's assets library.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          prompt: {
            type: SchemaType.STRING,
            description:
              "Detailed description of the image to generate. Be specific about style, composition, colors, lighting, and subject matter.",
          },
          name: {
            type: SchemaType.STRING,
            description: "A short descriptive name for the image",
          },
          provider: {
            type: SchemaType.STRING,
            description: "Which provider to use: gemini or nano_banana",
            enum: ["gemini", "nano_banana"],
          },
          width: { type: SchemaType.NUMBER, description: "Image width in pixels" },
          height: { type: SchemaType.NUMBER, description: "Image height in pixels" },
        },
        required: ["prompt", "name"],
      },
    });
    handlers.generate_image = async (args) => {
      const reportProgress = (msg: string) => deps.onToolProgress?.("generate_image", msg);

      try {
        // Determine provider: imageGenModel setting (user's choice) > explicit input > config default
        let provider: "gemini" | "nano_banana" | undefined;
        let modelOverride: string | undefined;
        const imgConfig = deps.imageGenConfig;

        if (deps.imageGenModel) {
          const [p, m] = deps.imageGenModel.split(":");
          if (p === "gemini" || p === "nano_banana") {
            provider = p;
            modelOverride = m;
          }
        }
        if (!provider) {
          provider = (args.provider as "gemini" | "nano_banana") || imgConfig?.provider || "gemini";
        }

        const geminiApiKey = imgConfig?.geminiApiKey || process.env.GEMINI_API_KEY;
        const nanoBananaApiKey = imgConfig?.nanoBananaApiKey;

        let imageBase64: string;
        let mimeType: string;
        let modelUsed: string;

        if (provider === "nano_banana") {
          if (!nanoBananaApiKey) return "Error: Nano Banana API key not configured. Add it in Settings > Credentials.";
          modelUsed = "nano_banana_generate_2";
          reportProgress("Generating image with Nano Banana...");

          // Submit generation task
          const aspectRatio = args.width && args.height
            ? getAspectRatio(args.width, args.height) : "1:1";
          const submitRes = await fetch("https://api.nanobananaapi.ai/api/v1/nanobanana/generate-2", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${nanoBananaApiKey}` },
            body: JSON.stringify({ prompt: args.prompt, aspectRatio, resolution: "1K", outputFormat: "png" }),
          });
          if (!submitRes.ok) {
            const err = await submitRes.text();
            return `Nano Banana API error (${submitRes.status}): ${err}`;
          }
          const submitData = await submitRes.json();
          const taskId = submitData.data?.taskId;
          if (!taskId) return "No taskId returned from Nano Banana API";

          // Poll for completion
          let imageUrl: string | undefined;
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 3000));
            reportProgress(`Generating image... (${i * 3}s)`);
            const pollRes = await fetch(
              `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`,
              { headers: { Authorization: `Bearer ${nanoBananaApiKey}` } }
            );
            if (!pollRes.ok) continue;
            const pollData = await pollRes.json();
            const status = pollData.data?.successFlag ?? pollData.successFlag;
            if (status === 1) {
              imageUrl = pollData.data?.response?.resultImageUrl ?? pollData.response?.resultImageUrl;
              break;
            } else if (status === 2 || status === 3) {
              const errMsg = pollData.data?.errorMessage ?? pollData.errorMessage ?? "Unknown error";
              return `Nano Banana generation failed: ${errMsg}`;
            }
          }
          if (!imageUrl) return "Nano Banana image generation timed out";

          reportProgress("Downloading generated image...");
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) return `Failed to download generated image: ${imgRes.status}`;
          const buf = await imgRes.arrayBuffer();
          imageBase64 = Buffer.from(buf).toString("base64");
          mimeType = imgRes.headers.get("content-type") || "image/png";
        } else {
          // Gemini Imagen
          if (!geminiApiKey) return "Error: GEMINI_API_KEY not configured";
          modelUsed = modelOverride || "imagen-4.0-generate-001";
          reportProgress(`Generating image with ${modelUsed}...`);

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:predict?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instances: [{ prompt: args.prompt }],
                parameters: { sampleCount: 1 },
              }),
            }
          );
          if (!res.ok) {
            const err = await res.text();
            return `Image generation failed (${res.status}): ${err}`;
          }
          const data = await res.json();
          const prediction = data.predictions?.[0];
          if (!prediction?.bytesBase64Encoded) return "No image returned from Imagen API";
          imageBase64 = prediction.bytesBase64Encoded;
          mimeType = prediction.mimeType || "image/png";
        }

        // Upload to Convex storage
        reportProgress("Uploading image...");
        const uploadUrl = await deps.convexClient.getAssetUploadUrl();
        const buffer = Buffer.from(imageBase64, "base64");
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: buffer,
        });
        if (!uploadRes.ok) return `Upload failed: ${uploadRes.status}`;
        const { storageId } = await uploadRes.json();

        // Create asset
        reportProgress("Saving to assets library...");
        const assetId = await deps.convexClient.createAsset(deps.agentId, {
          name: args.name,
          type: "image",
          storageId,
          mimeType,
          fileSize: buffer.length,
          generatedBy: provider,
          prompt: args.prompt,
          model: modelUsed,
          width: args.width || 1024,
          height: args.height || 1024,
        });

        await deps.convexClient.emitEvent(
          deps.agentId,
          "image.generated",
          "image_gen_tools",
          { assetId, name: args.name, provider, prompt: args.prompt }
        );

        return JSON.stringify({ success: true, assetId, name: args.name, provider, prompt: args.prompt });
      } catch (err: any) {
        return `Image generation error: ${err.message}`;
      }
    };

    declarations.push({
      name: "list_assets",
      description: "List all generated images and files in the agent's asset library.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            description: "Filter by asset type: image or file",
            enum: ["image", "file"],
          },
        },
      },
    });
    handlers.list_assets = async (args) => {
      const assets = await deps.convexClient.listAssets(deps.agentId);
      const filtered = args.type
        ? (assets as any[]).filter((a: any) => a.type === args.type)
        : assets;
      if (!filtered || (filtered as any[]).length === 0) return "No assets found.";
      return (filtered as any[])
        .map(
          (a: any) =>
            `- [${a._id}] ${a.name} (${a.type})${a.generatedBy ? ` via ${a.generatedBy}` : ""}${a.resolvedUrl ? ` — ${a.resolvedUrl}` : ""}`
        )
        .join("\n");
    };
  }

  // ── Gmail tools ───────────────────────────────────────────────────
  if (has(enabled, "gmail") && deps.gmailConfig) {
    const gc = deps.gmailConfig;

    declarations.push({
      name: "gmail_list_messages",
      description: "List recent emails from Gmail inbox. Returns message summaries with subject, from, date, and snippet.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          max_results: { type: SchemaType.NUMBER, description: "Max messages to return (default 10, max 50)" },
          label: { type: SchemaType.STRING, description: "Filter by label (e.g. INBOX, SENT, UNREAD)" },
        },
      },
    });
    handlers.gmail_list_messages = async (args) => {
      try {
        const params = new URLSearchParams({ maxResults: String(Math.min(args.max_results ?? 10, 50)) });
        if (args.label) params.set("labelIds", args.label);
        const list = await gmailFetch(gc, `/messages?${params}`);
        const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
        if (!ids.length) return "No messages found.";
        const messages = await Promise.all(ids.slice(0, 10).map((id) =>
          gmailFetch(gc, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
        ));
        return JSON.stringify(messages.map((m) => ({
          id: m.id, threadId: m.threadId,
          from: gmailHeader(m.payload?.headers, "From"),
          subject: gmailHeader(m.payload?.headers, "Subject"),
          date: gmailHeader(m.payload?.headers, "Date"),
          snippet: m.snippet,
          labels: m.labelIds ?? [],
        })), null, 2);
      } catch (e: any) { return `Gmail error: ${e.message}`; }
    };

    declarations.push({
      name: "gmail_search",
      description: "Search Gmail using Gmail search syntax (e.g. 'from:alice subject:meeting', 'is:unread').",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: "Gmail search query" },
          max_results: { type: SchemaType.NUMBER, description: "Max results (default 10)" },
        },
        required: ["query"],
      },
    });
    handlers.gmail_search = async (args) => {
      try {
        const params = new URLSearchParams({ q: args.query, maxResults: String(Math.min(args.max_results ?? 10, 50)) });
        const list = await gmailFetch(gc, `/messages?${params}`);
        const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
        if (!ids.length) return `No messages found for "${args.query}".`;
        const messages = await Promise.all(ids.slice(0, 10).map((id) =>
          gmailFetch(gc, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
        ));
        return JSON.stringify(messages.map((m) => ({
          id: m.id, from: gmailHeader(m.payload?.headers, "From"),
          subject: gmailHeader(m.payload?.headers, "Subject"),
          date: gmailHeader(m.payload?.headers, "Date"), snippet: m.snippet,
        })), null, 2);
      } catch (e: any) { return `Gmail search error: ${e.message}`; }
    };

    declarations.push({
      name: "gmail_send",
      description: "Send an email via Gmail. Supports HTML content, CC, BCC.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          to: { type: SchemaType.STRING, description: "Recipient email address(es), comma-separated" },
          subject: { type: SchemaType.STRING, description: "Email subject" },
          body: { type: SchemaType.STRING, description: "Email body (HTML supported)" },
          cc: { type: SchemaType.STRING, description: "CC recipients, comma-separated" },
          bcc: { type: SchemaType.STRING, description: "BCC recipients, comma-separated" },
        },
        required: ["to", "subject", "body"],
      },
    });
    handlers.gmail_send = async (args) => {
      try {
        const raw = buildGmailMime({
          to: args.to, subject: args.subject, body: args.body,
          cc: args.cc ? [args.cc] : undefined,
          bcc: args.bcc ? [args.bcc] : undefined,
        });
        const result = await gmailFetch(gc, "/messages/send", "POST", { raw });
        const recipients = Array.isArray(args.to) ? args.to : [args.to];
        await deps.convexClient.logEmail(deps.agentId, { to: recipients, subject: args.subject, status: "sent", resendId: result.id });
        await deps.convexClient.emitEvent(deps.agentId, "gmail.sent", "gmail_tools", { to: recipients, subject: args.subject, gmailMessageId: result.id });
        return `Email sent to ${args.to}. Subject: "${args.subject}" (Message ID: ${result.id})`;
      } catch (e: any) {
        const recipients = Array.isArray(args.to) ? args.to : [args.to];
        await deps.convexClient.logEmail(deps.agentId, { to: recipients, subject: args.subject, status: "failed", error: e.message });
        return `Failed to send email: ${e.message}`;
      }
    };

    declarations.push({
      name: "gmail_list_labels",
      description: "List all Gmail labels/folders in the account.",
      parameters: { type: SchemaType.OBJECT, properties: {} },
    });
    handlers.gmail_list_labels = async () => {
      try {
        const data = await gmailFetch(gc, "/labels");
        return JSON.stringify((data.labels ?? []).map((l: any) => ({ id: l.id, name: l.name, type: l.type, unread: l.messagesUnread })), null, 2);
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gmail_get_message",
      description: "Get the full content of a specific Gmail message by ID.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: { message_id: { type: SchemaType.STRING, description: "Gmail message ID" } },
        required: ["message_id"],
      },
    });
    handlers.gmail_get_message = async (args) => {
      try {
        const msg = await gmailFetch(gc, `/messages/${args.message_id}?format=full`);
        const headers = msg.payload?.headers ?? [];
        return JSON.stringify({
          id: msg.id, threadId: msg.threadId,
          from: gmailHeader(headers, "From"), to: gmailHeader(headers, "To"),
          subject: gmailHeader(headers, "Subject"), date: gmailHeader(headers, "Date"),
          snippet: msg.snippet, labels: msg.labelIds ?? [],
        }, null, 2);
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gmail_reply",
      description: "Reply to an existing Gmail message in the same thread.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          message_id: { type: SchemaType.STRING, description: "Message ID to reply to" },
          body: { type: SchemaType.STRING, description: "Reply body (HTML supported)" },
          reply_all: { type: SchemaType.BOOLEAN, description: "Reply to all recipients" },
        },
        required: ["message_id", "body"],
      },
    });
    handlers.gmail_reply = async (args) => {
      try {
        const original = await gmailFetch(gc, `/messages/${args.message_id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`);
        const headers = original.payload?.headers ?? [];
        const origFrom = gmailHeader(headers, "From");
        const origSubject = gmailHeader(headers, "Subject");
        const origMsgId = gmailHeader(headers, "Message-ID");
        const origRefs = gmailHeader(headers, "References");
        const subject = origSubject.startsWith("Re:") ? origSubject : `Re: ${origSubject}`;
        const references = origRefs ? `${origRefs} ${origMsgId}` : origMsgId;
        const raw = buildGmailMime({ to: origFrom, subject, body: args.body, inReplyTo: origMsgId, references });
        const result = await gmailFetch(gc, "/messages/send", "POST", { raw, threadId: original.threadId });
        await deps.convexClient.emitEvent(deps.agentId, "gmail.replied", "gmail_tools", { to: origFrom, subject, gmailMessageId: result.id });
        return `Reply sent to ${origFrom}. Thread: ${result.threadId}`;
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gmail_modify_labels",
      description: "Add or remove labels from a Gmail message (archive, star, mark read/unread).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          message_id: { type: SchemaType.STRING, description: "Gmail message ID" },
          add_labels: { type: SchemaType.STRING, description: "Comma-separated label IDs to add (e.g. STARRED,IMPORTANT)" },
          remove_labels: { type: SchemaType.STRING, description: "Comma-separated label IDs to remove (e.g. UNREAD,INBOX)" },
        },
        required: ["message_id"],
      },
    });
    handlers.gmail_modify_labels = async (args) => {
      try {
        const body: any = {};
        if (args.add_labels) body.addLabelIds = args.add_labels.split(",").map((s: string) => s.trim());
        if (args.remove_labels) body.removeLabelIds = args.remove_labels.split(",").map((s: string) => s.trim());
        await gmailFetch(gc, `/messages/${args.message_id}/modify`, "POST", body);
        return `Labels updated on message ${args.message_id}.`;
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gmail_get_thread",
      description: "Get all messages in a Gmail thread/conversation.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: { thread_id: { type: SchemaType.STRING, description: "Gmail thread ID" } },
        required: ["thread_id"],
      },
    });
    handlers.gmail_get_thread = async (args) => {
      try {
        const thread = await gmailFetch(gc, `/threads/${args.thread_id}?format=metadata`);
        return JSON.stringify({ threadId: thread.id, messageCount: (thread.messages ?? []).length }, null, 2);
      } catch (e: any) { return `Error: ${e.message}`; }
    };
  }

  // ── Google Sheets tools ───────────────────────────────────────────
  if (has(enabled, "google_sheets") && deps.gsheetsConfig) {
    const sc = deps.gsheetsConfig;

    declarations.push({
      name: "gsheets_list_spreadsheets",
      description: "List all Google Sheets spreadsheets in Google Drive. Always use this first when asked to list spreadsheets.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: { max_results: { type: SchemaType.NUMBER, description: "Max results (default 20)" } },
      },
    });
    handlers.gsheets_list_spreadsheets = async (args) => {
      try {
        const token = await getGoogleAccessToken(sc);
        const params = new URLSearchParams({
          q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
          pageSize: String(args.max_results ?? 20),
          fields: "files(id,name,modifiedTime,webViewLink)",
          orderBy: "modifiedTime desc",
        });
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Drive API error: ${res.status}`);
        const files = (data.files ?? []).map((f: any) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, link: f.webViewLink }));
        return files.length > 0 ? JSON.stringify({ spreadsheets: files, count: files.length }, null, 2) : "No spreadsheets found.";
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gsheets_create",
      description: "Create a new Google Sheets spreadsheet with optional sheet names and headers.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, description: "Spreadsheet title" },
          headers: { type: SchemaType.STRING, description: "Comma-separated column headers for the first sheet" },
        },
        required: ["title"],
      },
    });
    handlers.gsheets_create = async (args) => {
      try {
        const body: any = { properties: { title: args.title }, sheets: [{ properties: { title: "Sheet1" } }] };
        const created = await sheetsFetch(sc, "", "POST", body);
        if (args.headers) {
          const headerArr = args.headers.split(",").map((h: string) => h.trim());
          await sheetsFetch(sc, `/${created.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, "POST", { values: [headerArr] });
        }
        await deps.convexClient.emitEvent(deps.agentId, "gsheets.spreadsheet_created", "gsheets_tools", { spreadsheetId: created.spreadsheetId, title: args.title });
        return `Spreadsheet created: "${args.title}"\nID: ${created.spreadsheetId}\nLink: ${created.spreadsheetUrl}`;
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gsheets_get_info",
      description: "Get metadata about a spreadsheet — title, sheet names, row/column counts.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: { spreadsheet_id: { type: SchemaType.STRING, description: "Spreadsheet ID" } },
        required: ["spreadsheet_id"],
      },
    });
    handlers.gsheets_get_info = async (args) => {
      try {
        const data = await sheetsFetch(sc, `/${args.spreadsheet_id}?fields=properties.title,sheets.properties`);
        return JSON.stringify({ title: data.properties.title, sheets: (data.sheets ?? []).map((s: any) => ({ name: s.properties.title, rows: s.properties.gridProperties?.rowCount })) }, null, 2);
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gsheets_read",
      description: "Read data from a range in a Google Sheet. Use A1 notation (e.g. 'Sheet1!A1:D10' or 'Sheet1').",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          spreadsheet_id: { type: SchemaType.STRING, description: "Spreadsheet ID" },
          range: { type: SchemaType.STRING, description: "A1 notation range" },
        },
        required: ["spreadsheet_id", "range"],
      },
    });
    handlers.gsheets_read = async (args) => {
      try {
        const data = await sheetsFetch(sc, `/${args.spreadsheet_id}/values/${encodeURIComponent(args.range)}`);
        const values = data.values ?? [];
        if (!values.length) return "Range is empty.";
        return JSON.stringify({ headers: values[0], rows: values.slice(1), totalRows: values.length - 1 }, null, 2);
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gsheets_write",
      description: "Write data to a specific range in a Google Sheet. Overwrites existing data.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          spreadsheet_id: { type: SchemaType.STRING, description: "Spreadsheet ID" },
          range: { type: SchemaType.STRING, description: "A1 notation range" },
          values: { type: SchemaType.STRING, description: "JSON string of 2D array [[row1col1, row1col2], [row2col1, ...]]" },
        },
        required: ["spreadsheet_id", "range", "values"],
      },
    });
    handlers.gsheets_write = async (args) => {
      try {
        const vals = typeof args.values === "string" ? JSON.parse(args.values) : args.values;
        const result = await sheetsFetch(sc, `/${args.spreadsheet_id}/values/${encodeURIComponent(args.range)}?valueInputOption=USER_ENTERED`, "PUT", { values: vals });
        await deps.convexClient.emitEvent(deps.agentId, "gsheets.data_written", "gsheets_tools", { spreadsheetId: args.spreadsheet_id, range: args.range, rowCount: vals.length });
        return `Updated ${result.updatedCells} cells in range ${result.updatedRange}.`;
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gsheets_append",
      description: "Append rows to the end of a Google Sheet. Automatically finds the next empty row.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          spreadsheet_id: { type: SchemaType.STRING, description: "Spreadsheet ID" },
          sheet: { type: SchemaType.STRING, description: "Sheet/tab name (default: first sheet)" },
          rows: { type: SchemaType.STRING, description: "JSON string of rows to append [[col1, col2, ...], ...]" },
        },
        required: ["spreadsheet_id", "rows"],
      },
    });
    handlers.gsheets_append = async (args) => {
      try {
        const rows = typeof args.rows === "string" ? JSON.parse(args.rows) : args.rows;
        const range = args.sheet ? `${args.sheet}!A:A` : "A:A";
        const result = await sheetsFetch(sc, `/${args.spreadsheet_id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, "POST", { values: rows });
        await deps.convexClient.emitEvent(deps.agentId, "gsheets.rows_appended", "gsheets_tools", { spreadsheetId: args.spreadsheet_id, sheet: args.sheet, rowCount: rows.length });
        return `Appended ${rows.length} row(s). Updated range: ${result.updates?.updatedRange || "success"}.`;
      } catch (e: any) { return `Error: ${e.message}`; }
    };

    declarations.push({
      name: "gsheets_clear",
      description: "Clear all values from a range in a Google Sheet (keeps formatting).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          spreadsheet_id: { type: SchemaType.STRING, description: "Spreadsheet ID" },
          range: { type: SchemaType.STRING, description: "A1 notation range to clear" },
        },
        required: ["spreadsheet_id", "range"],
      },
    });
    handlers.gsheets_clear = async (args) => {
      try {
        await sheetsFetch(sc, `/${args.spreadsheet_id}/values/${encodeURIComponent(args.range)}:clear`, "POST");
        return `Cleared range: ${args.range}`;
      } catch (e: any) { return `Error: ${e.message}`; }
    };
  }

  return { declarations, handlers };
}
