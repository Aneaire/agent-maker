import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AgentConvexClient } from "./convex-client.js";

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface ProcessDocumentParams {
  documentId: string;
  storageUrl: string;
  fileName: string;
  fileType: string;
  agentId: string;
  convexClient: AgentConvexClient;
}

export async function processDocument(params: ProcessDocumentParams) {
  const { documentId, storageUrl, fileName, fileType, agentId, convexClient } = params;

  try {
    await convexClient.updateDocumentStatus(documentId, "processing");

    // Download file
    const response = await fetch(storageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    // Extract text based on file type
    const text = await extractText(response, fileType);

    if (!text.trim()) {
      throw new Error("No text content could be extracted from the file");
    }

    // Chunk the text
    const chunks = chunkText(text);

    // Generate embeddings
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    // Batch embed chunks
    const embeddedChunks: Array<{
      chunkIndex: number;
      content: string;
      embedding: number[];
    }> = [];

    // Process in batches of 10
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const embeddings = await Promise.all(
        batch.map(async (chunk) => {
          const result = await model.embedContent(chunk);
          return result.embedding.values;
        })
      );

      for (let j = 0; j < batch.length; j++) {
        embeddedChunks.push({
          chunkIndex: i + j,
          content: batch[j],
          embedding: embeddings[j],
        });
      }
    }

    // Store chunks
    await convexClient.storeDocumentChunks(documentId, agentId, embeddedChunks);

    // Update status to ready
    await convexClient.updateDocumentStatus(documentId, "ready", embeddedChunks.length);

    // Emit document.ready event
    await convexClient.emitEvent(agentId, "document.ready", "document_processor", {
      documentId,
      fileName,
      chunkCount: embeddedChunks.length,
    });

    console.log(
      `[document-processor] Processed "${fileName}": ${embeddedChunks.length} chunks`
    );
  } catch (err: any) {
    console.error(`[document-processor] Error processing "${fileName}":`, err.message);
    await convexClient.updateDocumentStatus(documentId, "error", undefined, err.message);
  }
}

const IMAGE_TYPES = ["png", "jpg", "jpeg", "webp", "gif"];
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

async function extractText(response: Response, fileType: string): Promise<string> {
  if (IMAGE_TYPES.includes(fileType)) {
    return await describeImage(response, fileType);
  }

  switch (fileType) {
    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const buffer = Buffer.from(await response.arrayBuffer());
      const pdf = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await pdf.getText();
      await pdf.destroy();
      return result.text;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(await response.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt":
    case "md":
    case "csv":
      return await response.text();
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

async function describeImage(response: Response, fileType: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = IMAGE_MIME[fileType] ?? "image/png";

  // Use Gemini REST API directly for vision (avoids SDK version issues)
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const apiResponse = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            {
              text: "Describe this image in thorough detail. Include all visible text, data, labels, colors, layout, and any other information that would be useful for someone searching for this image's content later. If it contains a chart, table, or diagram, describe the structure and all data points.",
            },
          ],
        },
      ],
    }),
  });

  if (!apiResponse.ok) {
    const errBody = await apiResponse.text();
    throw new Error(`Gemini vision API error (${apiResponse.status}): ${errBody}`);
  }

  const data = await apiResponse.json();
  const description =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!description.trim()) {
    throw new Error("Vision model returned empty description for image");
  }

  return `[Image description]\n${description}`;
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];

  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  let start = 0;
  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // Try to break at paragraph boundary
    const paragraphBreak = text.lastIndexOf("\n\n", end);
    if (paragraphBreak > start + CHUNK_SIZE / 2) {
      end = paragraphBreak + 2;
    } else {
      // Try sentence boundary
      const sentenceBreak = text.lastIndexOf(". ", end);
      if (sentenceBreak > start + CHUNK_SIZE / 2) {
        end = sentenceBreak + 2;
      }
    }

    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
