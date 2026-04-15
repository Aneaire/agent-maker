---
name: test-integration
description: Test a HiGantic tool set integration end-to-end. Use when asked to test, verify, or validate that an integration (Discord, Slack, Gmail, Google Sheets, etc.) is working — including tools, event bus, and automations.
metadata:
  tags: testing, integration, convex, discord, slack, gmail, event-bus, automations, sandbox
---

## When to use

Use this skill whenever you need to test or verify that a HiGantic tool set integration is working end-to-end. This includes:
- Testing a newly added integration
- Verifying tools call the external API correctly
- Checking that events are emitted to the event bus
- Confirming automations can be triggered by integration events

## How testing works

All integration testing goes through the **Sandbox Test Agent** — a dedicated agent seeded in Convex for testing. Tests follow this pattern:

1. Write an `internalMutation` in `packages/shared/convex/seed.ts` using `dispatchAgentPrompt()`
2. Deploy to Convex with `npx convex deploy`
3. Run the mutation with `npx convex run`
4. Wait ~15-25 seconds, then check results with `seed:verifyConversation`
5. Check event bus with `seed:verifyDiscordEvents` (or similar)

## Convex credentials

Always use these flags for `npx convex` commands:

```bash
--url https://robust-gnat-728.convex.cloud
--admin-key "eyJ2MiI6IjU4ZjJjYmMyYWI1YTQ4OGQ4M2QxZGIyZThhZGU1YmZiIn0="
```

All commands must be run from `packages/shared/` for `npx convex deploy`.

## dispatchAgentPrompt pattern

This helper already exists in `seed.ts`. Use it to create and dispatch a test job:

```typescript
export const testMyIntegration = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please test X by doing:
1. Call tool_a to ...
2. Call tool_b to ...
3. Report results.`;

    const result = await dispatchAgentPrompt(ctx, agent._id, user._id, prompt, "TEST: My Integration");
    return { status: "dispatched", ...result };
  },
});
```

## Verifying results

### Check conversation output
```bash
npx convex run --url ... --admin-key "..." seed:verifyConversation '{"conversationId":"<id>"}'
```

Returns: `jobStatus`, `assistantStatus`, `assistantResponse`, and `toolCalls` with outputs.

### Check event bus
Query `agentEvents` table filtering on `e.event.startsWith("myintegration.")`. The field is `event` (not `name`).

Example query pattern:
```typescript
export const verifyMyEvents = internalQuery({
  args: { },
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx); // uses SANDBOX_SLUG
    const allEvents = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agent._id))
      .order("desc")
      .take(20);
    const myEvents = allEvents.filter((e: any) => e.event?.startsWith("myintegration."));
    return {
      count: myEvents.length,
      events: myEvents.map((e: any) => ({ event: e.event, payload: e.payload })),
    };
  },
});
```

## Existing test mutations (already deployed)

| Mutation | What it tests |
|----------|--------------|
| `seed:testDiscord` | Lists Discord guilds and channels |
| `seed:testDiscordSend` | Sends a message to #general |
| `seed:testDiscordThreadAndReaction` | Creates a thread and adds a reaction |
| `seed:testDiscordAutomation` | Creates a discord.message_sent automation |
| `seed:verifyDiscordEvents` | Checks discord events in the event bus |
| `seed:testGmailSend` | Sends an email via Gmail |
| `seed:testSpreadsheet` | Creates/reads/writes a Google Sheet |
| `seed:testMultiTool` | Tests multiple tools together |
| `seed:testCreateTaskAutomation` | Task → automation → event pipeline |
| `seed:verifyAutomationResults` | Verifies automation fired correctly |
| `seed:testSchedule` | Creates and fires a schedule |
| `seed:verifyScheduleResults` | Verifies schedule ran |
| `seed:verifyConversation` | Generic: check any conversation result |
| `seed:verifyDiscordEvents` | Check discord events in event bus |

## What to test for any new integration

1. **All tools** — write a prompt that exercises every tool, check `toolCalls` in `verifyConversation`
2. **Event bus** — verify events appear in `agentEvents` with correct `event` name and `payload` fields
3. **Automations** — ask the agent to create an automation triggered by an integration event, then trigger it
4. **Error handling** — confirm tools return readable errors when credentials are wrong or API fails

## Full test flow example (Discord)

```bash
# 1. Add mutations to seed.ts, then deploy
cd packages/shared && npx convex deploy --url ... --admin-key "..."

# 2. Run a test
npx convex run --url ... --admin-key "..." seed:testDiscordThreadAndReaction '{}'
# → returns conversationId

# 3. Wait ~20s, then check result
npx convex run --url ... --admin-key "..." seed:verifyConversation '{"conversationId":"<id>"}'

# 4. Check event bus
npx convex run --url ... --admin-key "..." seed:verifyDiscordEvents '{}'

# 5. Test automation
npx convex run --url ... --admin-key "..." seed:testDiscordAutomation '{}'
```

## Important notes

- The Sandbox Test Agent must exist: run `seed:run` first if it's missing (latest sandbox run: 2026-04-15 for `johnv@hometownroofingtx.com`; slug `sandbox-test-agent`, userId `k973cgefw5ehpy3kz733kzc8r582tbes`)
- The agent server must be running (`cd packages/agent && bun run dev`) and built with latest code
- If tools say "not available", the agent server likely needs a restart to pick up new code
- Which tool-set credentials get fetched at run time is driven by `TOOL_SET_REGISTRY` entries with `requiresCredential: true` (via `getCredentialToolSetKeys()` in `packages/shared/src/tool-set-registry.ts`), NOT a hand-maintained array in `run-agent.ts`. If a new integration's credential isn't loading, check the registry entry.
- Event field in `agentEvents` is `event`, not `name` — filter on `e.event`

## AI model provider credentials (BYOK)

As of the Vercel AI SDK migration, the three AI provider credential types — `anthropic`, `google_ai`, `openai` — are **user-scoped**, not tool-set-scoped (`compatibleToolSets: []` in `packages/shared/src/credential-types.ts`). They do NOT appear in `agentCredentialLinks`.

Runtime lookup path:
- `packages/shared/convex/credentials.ts` → `_getUserAiProviderCredential(userId, providerType)` internalQuery
- `packages/shared/convex/credentialActions.ts` → `getAiProviderApiKey(serverToken, agentId, providerType)` action (gated by `AGENT_SERVER_TOKEN`, resolves the agent's `userId`, decrypts, returns `{ apiKey }`)
- `packages/agent/src/convex-client.ts` → `AgentConvexClient.getAiProviderApiKey(agentId, providerType)` with 5-min cache
- `packages/agent/src/model-factory.ts` → `providerTypeForModel(modelId)` maps `claude-*`→`anthropic`, `gemini-*`→`google_ai`, `gpt-*|o1|o3|o4`→`openai`, else→`openrouter`. `getLanguageModel(modelId, { apiKey? })` uses per-call `createAnthropic`/`createGoogleGenerativeAI`/`createOpenAI` when a key is provided; falls back to env-var singletons otherwise.
- `assertProviderCredentialAvailable()` throws a user-friendly error before streaming when neither BYOK nor env-var fallback is present — surfaces in the assistant message bubble.

Embeddings (memory search + RAG + document processing) also respect BYOK via the agent-owner's `google_ai` credential. The key is fetched once in `run-agent.ts` / `run-api-endpoint.ts` and threaded via `buildMcpServer({ googleApiKey })` into `createMemoryTools` / `createRagTools`, or passed directly into `embedText(text, apiKey?)`. `document-processor.ts` resolves its own key at call time since it runs outside the main agent flow.

**Testing AI provider BYOK:**
1. Store a provider credential via the UI (`listAiProviders` should return the type).
2. Ensure the agent's `model` matches the provider (`claude-*` for Anthropic creds, etc.).
3. Temporarily unset the server env var (e.g. `unset ANTHROPIC_API_KEY` in the agent-server process) and verify the agent still succeeds — that proves the BYOK path is live.
4. Delete the credential while the env var is unset and confirm the fail-fast error appears in the chat message (not the raw server logs).

**Note on the Agent Creator:** `packages/agent/src/run-creator.ts` intentionally stays on the env-var key — it is the app's meta-tool, not a user agent. Don't expect creator runs to consume user BYOK credentials.
