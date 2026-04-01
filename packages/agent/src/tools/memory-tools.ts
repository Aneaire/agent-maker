import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";
import { embedText } from "../embeddings.js";

export function createMemoryTools(
  convexClient: AgentConvexClient,
  agentId: string
) {
  const storeMemory = tool(
    "store_memory",
    "Store a piece of information for future reference. Use this when the user shares preferences, important details, or asks you to remember something.",
    {
      content: z
        .string()
        .describe(
          "The information to remember, written as a clear statement"
        ),
      category: z
        .string()
        .optional()
        .describe(
          'Category for organization, e.g. "preference", "personal", "work", "project"'
        ),
    },
    async (input) => {
      let embedding: number[] | undefined;
      try {
        embedding = await embedText(input.content);
      } catch {}

      await convexClient.storeMemory(agentId, input.content, input.category, embedding);
      await convexClient.emitEvent(agentId, "memory.stored", "memory_tools", {
        content: input.content,
        category: input.category,
      });
      return {
        content: [
          { type: "text" as const, text: `Stored memory: "${input.content}"` },
        ],
      };
    }
  );

  const recallMemory = tool(
    "recall_memory",
    "Search your memories. Use this to recall stored information before answering questions about user preferences or past conversations.",
    {
      query: z
        .string()
        .describe("Search query to find relevant memories"),
    },
    async (input) => {
      let memories: any[] | null = null;

      try {
        const embedding = await embedText(input.query);
        const results = await convexClient.searchMemoriesVector(agentId, embedding);
        if (results && results.length > 0) {
          memories = results;
        }
      } catch {}

      if (!memories || memories.length === 0) {
        memories = await convexClient.searchMemories(agentId, input.query);
      }

      if (!memories || memories.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No relevant memories found." },
          ],
        };
      }

      const text = memories
        .map(
          (m: any) =>
            `- ${m.content}${m.category ? ` [${m.category}]` : ""}`
        )
        .join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );

  const searchMemories = tool(
    "search_memories",
    "List all stored memories, optionally filtered. Use when the user wants to see what you remember.",
    {
      query: z
        .string()
        .optional()
        .describe("Optional search query to filter memories"),
    },
    async (input) => {
      if (input.query) {
        let memories: any[] | null = null;

        try {
          const embedding = await embedText(input.query);
          const results = await convexClient.searchMemoriesVector(agentId, embedding);
          if (results && results.length > 0) {
            memories = results;
          }
        } catch {}

        if (!memories || memories.length === 0) {
          memories = await convexClient.searchMemories(agentId, input.query);
        }

        if (!memories || memories.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No memories match that search." },
            ],
          };
        }

        const text = memories
          .map(
            (m: any) =>
              `- ${m.content}${m.category ? ` [${m.category}]` : ""}`
          )
          .join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      const memories = await convexClient.listMemories(agentId);

      if (!memories || memories.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No memories stored yet." },
          ],
        };
      }

      const text = memories
        .map(
          (m: any) =>
            `- ${m.content}${m.category ? ` [${m.category}]` : ""}`
        )
        .join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );

  return [storeMemory, recallMemory, searchMemories];
}
