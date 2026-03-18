import { SchemaType } from "@google/generative-ai";
import type { AgentConvexClient } from "./convex-client.js";

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

interface GeminiToolDeps {
  convexClient: AgentConvexClient;
  agentId: string;
  messageId: string;
  enabledToolSets: string[];
  tabs: Tab[];
  customTools: CustomToolConfig[];
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
      await deps.convexClient.storeMemory(deps.agentId, args.content, args.category);
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
      const memories = await deps.convexClient.searchMemories(deps.agentId, args.query);
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
        const memories = await deps.convexClient.searchMemories(deps.agentId, args.query);
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
      try {
        // This handler delegates to the image gen config loaded at runtime
        // The actual generation happens via the MCP tool in Claude mode,
        // but for Gemini we use the Imagen API directly
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return "Error: GEMINI_API_KEY not configured";

        const model = "imagen-4.0-generate-001";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
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
        if (!prediction?.bytesBase64Encoded) {
          return "No image returned from Imagen API";
        }

        // Upload to Convex storage
        const uploadUrl = await deps.convexClient.getAssetUploadUrl();
        const buffer = Buffer.from(prediction.bytesBase64Encoded, "base64");
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": prediction.mimeType || "image/png" },
          body: buffer,
        });
        if (!uploadRes.ok) return `Upload failed: ${uploadRes.status}`;
        const { storageId } = await uploadRes.json();

        // Create asset
        const assetId = await deps.convexClient.createAsset(deps.agentId, {
          name: args.name,
          type: "image",
          storageId,
          mimeType: prediction.mimeType || "image/png",
          fileSize: buffer.length,
          generatedBy: "gemini",
          prompt: args.prompt,
          model,
          width: args.width || 1024,
          height: args.height || 1024,
        });

        await deps.convexClient.emitEvent(
          deps.agentId,
          "image.generated",
          "image_gen_tools",
          { assetId, name: args.name, provider: "gemini", prompt: args.prompt }
        );

        return `Image "${args.name}" generated and saved to assets (ID: ${assetId}).`;
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

  return { declarations, handlers };
}
