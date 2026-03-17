# Knowledge Base (RAG)

**Tool set name**: `rag`
**Default**: Disabled
**Requires**: Documents uploaded in Settings

Upload documents and let your agent search them using vector similarity. Agents answer questions grounded in your actual content instead of guessing.

## Setup

1. Enable **Knowledge Base** in your agent's Settings
2. Upload documents (PDF, DOCX, TXT, etc.)
3. Wait for processing (chunking + embedding)
4. Your agent can now search the documents

## How It Works

1. **Upload**: Documents are stored in Convex file storage
2. **Process**: The server extracts text, splits into chunks (2000 chars, 200 overlap)
3. **Embed**: Each chunk is embedded using Gemini Embedding API (`gemini-embedding-001`, 3072 dimensions)
4. **Store**: Chunks + embeddings are stored in Convex with a vector index
5. **Search**: When the agent uses `search_documents`, query text is embedded and matched against stored chunks via cosine similarity

## Tools

| Tool | Description |
|------|-------------|
| `search_documents` | Search uploaded documents by natural language query |

### search_documents Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language search query |

### Response

Returns the top 8 matching chunks with:
- `content` — The matched text chunk
- `fileName` — Source document name
- `score` — Relevance score (0-1)

## Agent Behavior

When RAG is enabled and documents exist, the system prompt includes:
> "You have access to N uploaded documents: [file list]. Use the `search_documents` tool to find information from these documents before answering questions about their content."

The agent will automatically search documents when questions relate to uploaded content.

## Supported File Types

- PDF (.pdf)
- Word documents (.docx)
- Plain text (.txt)
- Markdown (.md)

## Example Usage

**User uploads**: `company-handbook.pdf`

**User**: "What's our vacation policy?"

**Agent**: Searches the handbook via `search_documents`, finds the relevant section, and answers with specific details from the document.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for embeddings |

## Limits

- Chunk size: 2,000 characters with 200 character overlap
- Vector dimensions: 3,072 (Gemini embedding-001)
- Search results: Top 8 chunks per query
- No hard limit on documents per agent
