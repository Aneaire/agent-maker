import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AgentConvexClient } from "../convex-client.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function embedQuery(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured — cannot generate embeddings");
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export function createRagTools(
  convexClient: AgentConvexClient,
  agentId: string
) {
  const searchDocuments = tool(
    "search_documents",
    "Search uploaded documents in the knowledge base for relevant information. Use this when the user asks about content from uploaded files.",
    {
      query: z
        .string()
        .describe("The search query to find relevant document content"),
    },
    async (input) => {
      try {
        const embedding = await embedQuery(input.query);
        const results = await convexClient.searchDocumentChunks(agentId, embedding);

        if (!results || results.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No relevant content found in uploaded documents." },
            ],
          };
        }

        const text = results
          .map(
            (r: any) =>
              `[Source: ${r.fileName}]\n${r.content}`
          )
          .join("\n\n---\n\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Error searching documents: ${err.message}` },
          ],
        };
      }
    }
  );

  return [searchDocuments];
}
