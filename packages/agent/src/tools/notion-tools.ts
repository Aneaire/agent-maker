import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface NotionConfig {
  apiKey: string;
}

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notionFetch(
  config: NotionConfig,
  path: string,
  method: string = "GET",
  body?: any
) {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.message || `Notion API error: ${res.status} ${data.code}`
    );
  }
  return data;
}

/** Extract plain text from Notion rich_text array */
function richTextToPlain(richText: any[]): string {
  return (richText ?? []).map((t: any) => t.plain_text ?? "").join("");
}

/** Convert a plain string to Notion rich_text block */
function plainToRichText(text: string) {
  return [{ type: "text", text: { content: text } }];
}

/** Summarise a Notion page object into a concise record */
function summarisePage(page: any) {
  const title =
    Object.values(page.properties ?? {}).find(
      (p: any) => p.type === "title"
    ) as any;
  return {
    id: page.id,
    title: title ? richTextToPlain(title.title) : "(untitled)",
    url: page.url,
    created: page.created_time,
    lastEdited: page.last_edited_time,
  };
}

/** Summarise a Notion database object */
function summariseDatabase(db: any) {
  const title = richTextToPlain(db.title ?? []);
  const props = Object.entries(db.properties ?? {}).map(
    ([name, p]: [string, any]) => `${name} (${p.type})`
  );
  return {
    id: db.id,
    title: title || "(untitled)",
    url: db.url,
    properties: props,
  };
}

export function createNotionTools(
  convexClient: AgentConvexClient,
  agentId: string,
  notionConfig: NotionConfig
) {
  // ── Search ──────────────────────────────────────────────────────────
  const searchNotion = tool(
    "notion_search",
    "Search Notion for pages and databases by keyword. Returns matching items with titles and URLs.",
    {
      query: z.string().describe("Search query text"),
      filter: z
        .enum(["page", "database"])
        .optional()
        .describe("Filter results to only pages or only databases"),
      page_size: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .describe("Max results to return (default 10)"),
    },
    async (input) => {
      try {
        const body: any = {
          query: input.query,
          page_size: input.page_size ?? 10,
        };
        if (input.filter) {
          body.filter = { value: input.filter, property: "object" };
        }
        const data = await notionFetch(notionConfig, "/search", "POST", body);
        const results = data.results.map((r: any) =>
          r.object === "database" ? summariseDatabase(r) : summarisePage(r)
        );

        await convexClient.emitEvent(agentId, "notion.searched", "notion_tools", {
          query: input.query,
          resultCount: results.length,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                results.length > 0
                  ? JSON.stringify(results, null, 2)
                  : "No results found.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Notion search failed: ${err.message}` }],
        };
      }
    }
  );

  // ── Query Database ──────────────────────────────────────────────────
  const queryDatabase = tool(
    "notion_query_database",
    "Query a Notion database to retrieve its entries. Can filter and sort results. Returns page summaries with property values.",
    {
      database_id: z.string().describe("The Notion database ID"),
      filter: z
        .any()
        .optional()
        .describe(
          "Notion filter object (e.g. { property: 'Status', status: { equals: 'Done' } })"
        ),
      sorts: z
        .array(z.any())
        .optional()
        .describe(
          "Notion sorts array (e.g. [{ property: 'Created', direction: 'descending' }])"
        ),
      page_size: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results (default 20)"),
    },
    async (input) => {
      try {
        const body: any = { page_size: input.page_size ?? 20 };
        if (input.filter) body.filter = input.filter;
        if (input.sorts) body.sorts = input.sorts;

        const data = await notionFetch(
          notionConfig,
          `/databases/${input.database_id}/query`,
          "POST",
          body
        );

        const entries = data.results.map((page: any) => {
          const props: Record<string, any> = {};
          for (const [name, prop] of Object.entries(page.properties ?? {}) as [string, any][]) {
            switch (prop.type) {
              case "title":
                props[name] = richTextToPlain(prop.title);
                break;
              case "rich_text":
                props[name] = richTextToPlain(prop.rich_text);
                break;
              case "number":
                props[name] = prop.number;
                break;
              case "select":
                props[name] = prop.select?.name ?? null;
                break;
              case "multi_select":
                props[name] = (prop.multi_select ?? []).map((s: any) => s.name);
                break;
              case "status":
                props[name] = prop.status?.name ?? null;
                break;
              case "date":
                props[name] = prop.date?.start ?? null;
                break;
              case "checkbox":
                props[name] = prop.checkbox;
                break;
              case "url":
                props[name] = prop.url;
                break;
              case "email":
                props[name] = prop.email;
                break;
              case "phone_number":
                props[name] = prop.phone_number;
                break;
              case "relation":
                props[name] = (prop.relation ?? []).map((r: any) => r.id);
                break;
              default:
                props[name] = `(${prop.type})`;
            }
          }
          return { id: page.id, url: page.url, properties: props };
        });

        await convexClient.emitEvent(agentId, "notion.database_queried", "notion_tools", {
          databaseId: input.database_id,
          resultCount: entries.length,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(entries, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Query failed: ${err.message}` }],
        };
      }
    }
  );

  // ── Create Page ─────────────────────────────────────────────────────
  const createPage = tool(
    "notion_create_page",
    "Create a new page in Notion. Can be a standalone page (under a parent page) or a new entry in a database.",
    {
      parent_type: z
        .enum(["page", "database"])
        .describe("Whether the parent is a page or a database"),
      parent_id: z.string().describe("The ID of the parent page or database"),
      title: z.string().describe("Page title"),
      properties: z
        .record(z.any())
        .optional()
        .describe(
          "Additional database properties as { propertyName: value }. For database entries, match the property types."
        ),
      content: z
        .string()
        .optional()
        .describe(
          "Optional body text for the page (rendered as a paragraph block)"
        ),
    },
    async (input) => {
      try {
        const parent =
          input.parent_type === "database"
            ? { database_id: input.parent_id }
            : { page_id: input.parent_id };

        // Build properties
        const properties: Record<string, any> = {};
        if (input.parent_type === "database") {
          // For databases, title goes in the title property
          // We need to find the title property name, default to "Name"
          properties["Name"] = { title: plainToRichText(input.title) };
          // Merge additional properties
          if (input.properties) {
            Object.assign(properties, input.properties);
          }
        } else {
          properties["title"] = { title: plainToRichText(input.title) };
        }

        const body: any = { parent, properties };

        // Add content as paragraph blocks
        if (input.content) {
          body.children = [
            {
              object: "block",
              type: "paragraph",
              paragraph: { rich_text: plainToRichText(input.content) },
            },
          ];
        }

        const page = await notionFetch(notionConfig, "/pages", "POST", body);

        await convexClient.emitEvent(agentId, "notion.page_created", "notion_tools", {
          pageId: page.id,
          title: input.title,
          parentType: input.parent_type,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Page created: "${input.title}"\nID: ${page.id}\nURL: ${page.url}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to create page: ${err.message}` }],
        };
      }
    }
  );

  // ── Update Page Properties ──────────────────────────────────────────
  const updatePage = tool(
    "notion_update_page",
    "Update properties of an existing Notion page (e.g. change status, title, dates, etc.).",
    {
      page_id: z.string().describe("The Notion page ID to update"),
      properties: z
        .record(z.any())
        .describe(
          "Properties to update as { propertyName: notionPropertyValue }. Use Notion property format."
        ),
    },
    async (input) => {
      try {
        const page = await notionFetch(
          notionConfig,
          `/pages/${input.page_id}`,
          "PATCH",
          { properties: input.properties }
        );

        await convexClient.emitEvent(agentId, "notion.page_updated", "notion_tools", {
          pageId: page.id,
          updatedProperties: Object.keys(input.properties),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Page updated successfully.\nURL: ${page.url}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to update page: ${err.message}` }],
        };
      }
    }
  );

  // ── Get Page ────────────────────────────────────────────────────────
  const getPage = tool(
    "notion_get_page",
    "Retrieve a Notion page's properties and metadata by its ID.",
    {
      page_id: z.string().describe("The Notion page ID"),
    },
    async (input) => {
      try {
        const page = await notionFetch(
          notionConfig,
          `/pages/${input.page_id}`
        );

        // Also fetch page content (blocks)
        const blocks = await notionFetch(
          notionConfig,
          `/blocks/${input.page_id}/children?page_size=50`
        );

        const props: Record<string, any> = {};
        for (const [name, prop] of Object.entries(page.properties ?? {}) as [string, any][]) {
          if (prop.type === "title") {
            props[name] = richTextToPlain(prop.title);
          } else if (prop.type === "rich_text") {
            props[name] = richTextToPlain(prop.rich_text);
          } else if (prop.type === "select") {
            props[name] = prop.select?.name ?? null;
          } else if (prop.type === "status") {
            props[name] = prop.status?.name ?? null;
          } else if (prop.type === "number") {
            props[name] = prop.number;
          } else if (prop.type === "checkbox") {
            props[name] = prop.checkbox;
          } else if (prop.type === "date") {
            props[name] = prop.date?.start ?? null;
          } else {
            props[name] = `(${prop.type})`;
          }
        }

        // Extract text from blocks
        const content = blocks.results
          .map((block: any) => {
            const rt = block[block.type]?.rich_text;
            if (rt) return richTextToPlain(rt);
            return null;
          })
          .filter(Boolean)
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: page.id,
                  url: page.url,
                  properties: props,
                  content: content || "(no text content)",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to get page: ${err.message}` }],
        };
      }
    }
  );

  // ── Append Blocks ───────────────────────────────────────────────────
  const appendBlocks = tool(
    "notion_append_blocks",
    "Append content blocks to an existing Notion page. Use this to add text, headings, lists, todos, etc.",
    {
      page_id: z.string().describe("The Notion page ID to append to"),
      blocks: z
        .array(
          z.object({
            type: z
              .enum([
                "paragraph",
                "heading_1",
                "heading_2",
                "heading_3",
                "bulleted_list_item",
                "numbered_list_item",
                "to_do",
                "quote",
                "callout",
                "divider",
              ])
              .describe("Block type"),
            text: z
              .string()
              .optional()
              .describe("Text content for the block"),
            checked: z
              .boolean()
              .optional()
              .describe("For to_do blocks: whether the item is checked"),
          })
        )
        .describe("Array of blocks to append"),
    },
    async (input) => {
      try {
        const children = input.blocks.map((block) => {
          if (block.type === "divider") {
            return { object: "block", type: "divider", divider: {} };
          }
          const blockContent: any = {
            rich_text: plainToRichText(block.text ?? ""),
          };
          if (block.type === "to_do" && block.checked !== undefined) {
            blockContent.checked = block.checked;
          }
          return {
            object: "block",
            type: block.type,
            [block.type]: blockContent,
          };
        });

        await notionFetch(
          notionConfig,
          `/blocks/${input.page_id}/children`,
          "PATCH",
          { children }
        );

        await convexClient.emitEvent(agentId, "notion.blocks_appended", "notion_tools", {
          pageId: input.page_id,
          blockCount: input.blocks.length,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Appended ${input.blocks.length} block(s) to page.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to append blocks: ${err.message}` }],
        };
      }
    }
  );

  return [
    searchNotion,
    queryDatabase,
    createPage,
    updatePage,
    getPage,
    appendBlocks,
  ];
}
