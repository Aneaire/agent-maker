# Vector Memory (Recall Memory Upgrade)

**Status**: Proposed
**Priority**: High (2nd after Agent Debug Dashboard)
**Estimated Effort**: 3-4 weeks
**Embedding Model**: `gemini-embedding-001` (3072 dimensions, same as RAG)

---

## Problem

The current memory system uses **full-text search** (`searchIndex`) to recall memories. As an agent accumulates memories over time:

- Search quality degrades — keyword matching misses semantically related memories
- Context window bloats — no relevance ranking, results are unordered
- No deduplication — agents store similar memories multiple times
- No pruning — old memories persist forever, wasting storage and tokens

## Current Architecture

```
User says "remember X"
  → store_memory tool
  → INSERT into memories table (content, category, agentId)
  → No embedding generated

Agent needs to recall
  → recall_memory tool
  → Convex searchIndex (full-text search on "content")
  → Returns up to 10 results, unordered by relevance
```

### Current Schema (`schema.ts:254`)

```ts
memories: defineTable({
  agentId: v.id("agents"),
  content: v.string(),
  category: v.optional(v.string()),
})
  .index("by_agent", ["agentId"])
  .searchIndex("search_content", {
    searchField: "content",
    filterFields: ["agentId"],
  })
```

---

## Proposed Architecture

```
User says "remember X"
  → store_memory tool
  → embed content via gemini-embedding-001
  → INSERT into memories table (content, category, agentId, embedding)
  → Check for duplicates (cosine similarity > 0.95)

Agent needs to recall
  → recall_memory tool
  → embed query via gemini-embedding-001
  → Convex vectorSearch on memories.by_embedding
  → Returns top 5 results ranked by semantic relevance
```

### New Schema

```ts
memories: defineTable({
  agentId: v.id("agents"),
  content: v.string(),
  category: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
})
  .index("by_agent", ["agentId"])
  .searchIndex("search_content", {
    searchField: "content",
    filterFields: ["agentId"],
  })
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 3072,
    filterFields: ["agentId", "category"],
  })
```

- Keep `searchIndex` as fallback for keyword-precise lookups
- Add `vectorIndex` for semantic search (primary path)
- `embedding` is optional to support backfill migration

---

## Implementation Plan

### Phase 1: Vector Search Foundation (Week 1-2)

#### 1.1 Extract shared embedding utility

Create `packages/agent/src/embeddings.ts`:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function embedText(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => embedText(t)));
}
```

- Extracted from existing `rag-tools.ts:8-15` and `document-processor.ts:44`
- Single source of truth for all embedding calls

#### 1.2 Update schema

In `packages/shared/convex/schema.ts`:
- Add `embedding: v.optional(v.array(v.float64()))` to `memories` table
- Add `vectorIndex("by_embedding", ...)` with `filterFields: ["agentId", "category"]`

#### 1.3 Update storeMemory mutation

In `packages/shared/convex/agentApi.ts` → `storeMemory`:
- Accept optional `embedding` parameter
- Store embedding alongside content

```ts
export const storeMemory = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    content: v.string(),
    category: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db.insert("memories", {
      agentId: args.agentId,
      content: args.content,
      category: args.category,
      embedding: args.embedding,
    });
  },
});
```

#### 1.4 Update store_memory tool

In `packages/agent/src/tools/memory-tools.ts`:
- Import `embedText` from shared util
- Generate embedding before storing

```ts
const embedding = await embedText(input.content);
await convexClient.storeMemory(agentId, input.content, input.category, embedding);
```

#### 1.5 Add vector search query

In `packages/shared/convex/agentApi.ts`:

```ts
export const searchMemoriesVector = action({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    embedding: v.array(v.float64()),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const limit = args.limit ?? 5;
    const results = await ctx.vectorSearch("memories", "by_embedding", {
      vector: args.embedding,
      limit,
      filter: (q) => {
        const conditions = [q.eq("agentId", args.agentId)];
        if (args.category) conditions.push(q.eq("category", args.category));
        return conditions.reduce((acc, c) => q.and(acc, c), conditions[0]);
      },
    });
    const memories = [];
    for (const result of results) {
      const doc = await ctx.runQuery(internal.memoriesInternal.getById, {
        id: result._id,
      });
      if (doc) {
        memories.push({ ...doc, score: result._score });
      }
    }
    return memories;
  },
});
```

#### 1.6 Update recall_memory tool

In `packages/agent/src/tools/memory-tools.ts`:
- Embed query, then call vector search
- Fall back to full-text search if no embedding results

```ts
const embedding = await embedText(input.query);
const results = await convexClient.searchMemoriesVector(agentId, embedding);

if (!results || results.length === 0) {
  const memories = await convexClient.searchMemories(agentId, input.query);
  // ... existing fallback
}
```

#### 1.7 Update Gemini tools

In `packages/agent/src/gemini-tools.ts`:
- Mirror the same embedding + vector search flow for Gemini agent runs

### Phase 2: Deduplication (Week 2-3)

#### 2.1 Duplicate detection on store

Before inserting a new memory, search existing memories by embedding:
- If top result has cosine similarity > 0.95, skip or update instead of inserting
- Prevents "user prefers TypeScript" stored 5 times across different conversations

```ts
const existing = await convexClient.searchMemoriesVector(agentId, embedding, undefined, 1);
if (existing.length > 0 && existing[0].score > 0.95) {
  await convexClient.updateMemory(existing[0]._id, input.content, input.category);
  return { content: [{ type: "text", text: `Updated memory: "${input.content}"` }] };
}
```

#### 2.2 Update system prompt

In `packages/agent/src/system-prompt.ts`:
- Update memory capability description to mention semantic understanding
- Guide agent to use `recall_memory` more proactively (it's smarter now)

### Phase 3: Pruning & Maintenance (Week 3-4)

#### 3.1 Memory age tracking

- Add `createdAt: v.number()` to schema (if not present)
- Add `accessCount: v.optional(v.number())` to track how often recalled

#### 3.2 Pruning query

Add a mutation that agents or schedules can call:

```ts
export const pruneOldMemories = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    maxAge: v.number(), // ms
    keepCount: v.number(), // always keep newest N
  },
  handler: async (ctx, args) => {
    // Delete memories older than maxAge, but always keep newest keepCount
  },
});
```

#### 3.3 Token budget in recall

Update `recall_memory` to respect a token budget:
- Estimate tokens in matched memories (~4 chars per token)
- Stop adding results when budget is reached (default: 2000 tokens)
- Ensures context window isn't flooded

### Phase 4: Backfill & Migration (Week 4)

#### 4.1 Backfill existing memories

Create a one-time action to embed all memories without embeddings:

```ts
export const backfillMemoryEmbeddings = action({
  handler: async (ctx) => {
    const memories = await ctx.runQuery(internal.memoriesInternal.getWithoutEmbeddings, {});
    for (const memory of memories) {
      const embedding = await embedText(memory.content);
      await ctx.runMutation(internal.memoriesInternal.setEmbedding, {
        id: memory._id,
        embedding,
      });
    }
  },
});
```

#### 4.2 Remove optional from embedding field

Once backfill is complete, make `embedding` required in schema.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/convex/schema.ts` | Add embedding field + vectorIndex to memories |
| `packages/shared/convex/agentApi.ts` | Update storeMemory args, add searchMemoriesVector action |
| `packages/agent/src/tools/memory-tools.ts` | Embed on store, vector search on recall |
| `packages/agent/src/gemini-tools.ts` | Mirror memory tool changes |
| `packages/agent/src/convex-client.ts` | Add searchMemoriesVector + update storeMemory |
| `packages/agent/src/system-prompt.ts` | Update memory capability description |
| New: `packages/agent/src/embeddings.ts` | Shared embedding utility |
| New: `packages/shared/convex/memoriesInternal.ts` | Internal queries for vector search joins |

---

## Embedding Model Details

| Property | Value |
|----------|-------|
| Model | `gemini-embedding-001` |
| Dimensions | 3072 (adjustable via MRL) |
| Max input | 2,048 tokens |
| Modality | Text only |
| Pricing | $0.15 / 1M tokens (Vertex AI), free tier available |
| Task types | RETRIEVAL_QUERY (for recall), RETRIEVAL_DOCUMENT (for store) |

### Cost Estimate

- Average memory: ~20 words = ~25 tokens
- 1,000 memories stored/month = 25,000 tokens = **$0.004**
- 5,000 recall searches/month = 125,000 tokens = **$0.02**
- **Total: ~$0.03/month per agent** — negligible

---

## Comparison: Before vs After

| Aspect | Before (Full-text) | After (Vector) |
|--------|-------------------|----------------|
| Search quality | Keyword match only | Semantic similarity |
| Relevance ranking | None | Cosine similarity score |
| Deduplication | None | Auto-detect similar memories |
| Cross-conversation recall | Weak | Strong |
| Token efficiency | Returns up to 10 unranked | Returns top 5 ranked, token-budgeted |
| Category filter | No | Yes |
| Pruning | Manual only | Age + access-based |

---

## Open Questions

- Should we reduce dimensions from 3072 to 768 or 1024 to save storage? (MRL allows this)
- Should pruning be automatic (schedule-based) or agent-triggered?
- Should memories support task-specific embedding hints (e.g., `task_type: RETRIEVAL_DOCUMENT` for store vs `RETRIEVAL_QUERY` for recall)?
- Should we add a memory management UI page for users to view/search/delete memories?

---

## Dependencies

- `GEMINI_API_KEY` env var (already required for RAG)
- Convex vector index support (already used for documentChunks)
- No new external packages needed
