# Agent Steering Optimization Plan

> **Date**: 2026-04-13
> **Status**: Complete (Phases 1-3)
> **Sources**: [How to Build an Agent (ampcode.com)](https://ampcode.com/notes/how-to-build-an-agent) | [The Emperor Has No Clothes (mihaileric.com)](https://www.mihaileric.com/The-Emperor-Has-No-Clothes/)

---

## Core Insight

Both articles agree: **an agent is just an LLM + a loop + tools**. The model does the cognitive heavy lifting. The loop mechanics in HiGantic are solid (Claude Agent SDK, streaming, MCP tools, debounced flushes, atomic job claiming). What separates a mediocre agent from a great one is **how you steer the model's cognition** through the system prompt and context design.

The current `system-prompt.ts` is ~95% tool reference manual. It tells the agent *what* it can do but never *how* to think, reason, or approach problems.

---

## The 7 Key Improvement Areas

### 1. Add a Cognitive Framework to the System Prompt

**Priority**: Highest | **Effort**: Medium | **File**: `packages/agent/src/system-prompt.ts`

**Problem**: No guidance on how to think. The agent jumps straight to tool calls without planning. A simple question, a multi-step workflow, and a creative request all get the same cognitive approach.

**What to add** (new section in system prompt):

- **Think before acting** — Before calling tools, briefly reason about what the user needs and which approach is best
- **Task classification** — Identify the type of request (simple question, multi-step task, creative work, information lookup) and adapt approach accordingly
- **Gather before generating** — For questions about existing data, read/search first, then synthesize. Don't guess.
- **Verify completeness** — After responding, check: did I address all parts of the request? Did I miss anything?
- **Confidence signaling** — When unsure, say so. "I'm not certain about X, let me verify" is better than a confident wrong answer.

**Example prompt section**:
```
## How to Approach Tasks
1. UNDERSTAND — Read the full request. Identify what type it is (question, task, creative, lookup).
2. PLAN — For multi-step requests, outline the steps before executing. For simple ones, act directly.
3. EXECUTE — Use tools methodically. Don't call tools speculatively — know what you need first.
4. VERIFY — Check your work. Did you address everything? Did any tool calls fail that need retry?
5. RESPOND — Match your response format to the request type. Questions get answers. Tasks get confirmation + summary. Creative gets the deliverable.
```

---

### 2. Add Planning Scaffolding for Complex Requests

**Priority**: High | **Effort**: Medium | **File**: `packages/agent/src/system-prompt.ts`

**Problem**: If a user says "set up a full project tracking system with tasks, automations, and daily reports," the agent has no framework to decompose this. It might create a task page and then stop, or do things out of order.

**What to add**:

- **Decomposition pattern** — For requests involving 3+ steps, mentally break them into ordered sub-tasks
- **Dependency awareness** — Create things in the right order (e.g., create the page before adding rows to it, create the schedule before the automation that depends on it)
- **Progress signaling** — For multi-step work, tell the user what you're doing at each step ("Setting up the task board... now creating the automation...")
- **Completion summary** — After multi-step work, summarize everything that was set up

**Example guidance**:
```
When a request involves multiple tools or steps:
- List what needs to happen (mentally, don't dump a plan unless the user asks)
- Execute in dependency order (create before populate, configure before activate)
- Signal progress: "Creating your task board... Adding columns... Setting up the daily digest schedule..."
- Summarize at the end: "Done. Here's what I set up: [list]"
```

---

### 3. Smarter Context Management

**Priority**: High | **Effort**: High | **Files**: `system-prompt.ts`, `run-agent.ts`

**Problem**: On a long conversation with many integrations enabled, the system prompt balloons with full tool documentation for every integration — most irrelevant to the current turn. Memories are all listed regardless of relevance. No conversation summarization.

**Sub-problems & solutions**:

#### 3a. Lazy Tool Documentation
- Currently: full usage guide for every enabled integration (Slack, Discord, Gmail, etc.) every turn
- Better: brief one-line capability mention for all, full docs only for integrations relevant to the current message
- Implementation: analyze the user's latest message for keywords/intent, only include full guidance sections for matching integrations

#### 3b. Relevance-Filtered Memories
- Currently: all memories dumped into system prompt
- Better: semantic search memories against current query, include top-N most relevant
- Implementation: use existing embedding infrastructure to score memory relevance

#### 3c. Conversation Summarization
- Currently: flat text dump of all messages, 24h cutoff for external chats
- Better: summarize older turns into a condensed context block, keep recent turns verbatim
- Implementation: when conversation exceeds N messages, summarize the oldest K into a paragraph

#### 3d. Dynamic Context Budget
- Allocate context window budget: X% for system prompt, Y% for history, Z% for tool docs
- When approaching limits, compress least-important sections first

---

### 4. Structured Persona Framework

**Priority**: Medium | **Effort**: Low-Medium | **Files**: `system-prompt.ts`, possibly agent config schema

**Problem**: The only behavior guidance is "Keep responses concise but informative" plus the user's freeform `systemPrompt` field. Most users write a few sentences and expect the agent to extrapolate an entire persona.

**What to add**:

- **Response style guidance** derived from the user's prompt:
  - When to be conversational vs. structured
  - When to use bullet points vs. prose
  - When to be brief vs. detailed
- **Audience adaptation** — infer user expertise from context and adjust explanations
- **Consistency rules** — maintain the same tone and style across the entire conversation

**Possible implementation**: Add structured persona fields to agent config (tone, formality, verbosity, expertise-level) that translate into system prompt sections. Or generate these from the freeform prompt.

---

### 5. Error Recovery Strategy

**Priority**: Medium | **Effort**: Low | **File**: `system-prompt.ts`

**Problem**: Current guidance is one line: "If a tool fails, explain what happened and suggest alternatives."

**What to add**:
```
## When Things Go Wrong
- **Transient errors** (timeouts, rate limits): retry once before reporting failure
- **Auth/permission errors**: tell the user what access is needed and where to configure it (Settings page)
- **Missing data errors**: suggest what the user can provide or what tool to use to find it
- **Never dead-end**: every error message must include a suggested next step
- **Don't over-apologize**: state what happened, what you tried, what to do next. One sentence each.
```

---

### 6. Self-Reflection / Verification Step

**Priority**: Medium | **Effort**: Low | **File**: `system-prompt.ts`

**Problem**: The agent's first answer is its final answer. No self-check for completeness, accuracy, or missed parts of the request.

**What to add**:
```
Before finalizing your response, quickly check:
- Did I address ALL parts of the user's request? (Users often ask 2-3 things in one message)
- Did any tool calls fail that I should retry or mention?
- Is my response the right length? (Don't over-explain simple things, don't under-explain complex things)
- Would the user need to ask a follow-up for something I could have included?
```

This is lightweight — it doesn't require another API call, just a mental checklist baked into the prompt.

---

### 7. Sharper UX Tool Guidance

**Priority**: Medium | **Effort**: Low | **File**: `system-prompt.ts`

**Problem**: `ask_questions` is only suggested for "onboarding, preferences, configuration." `suggest_replies` guidance is generic.

**What to change**:

#### `ask_questions` — expand when to use it:
- When a request is ambiguous and acting on the wrong interpretation would waste time
- When the user needs to choose between meaningfully different approaches
- When you need specific information (dates, names, preferences) before proceeding
- **Don't use** for yes/no questions — just ask in text

#### `suggest_replies` — make them strategic:
- After completing a task: suggest logical next steps specific to what was just done
- After explaining something: suggest deeper dives into the most useful areas
- After an error: suggest the recovery actions
- **Never generic** ("Tell me more", "What else can you do?") — always specific to context

---

## Implementation Order

```
Phase 1 (Quick wins — system prompt text changes only):
  [x] Cognitive framework section          ← DONE
  [x] Error recovery strategy              ← DONE
  [x] Self-reflection checklist            ← DONE
  [x] UX tool guidance improvements        ← DONE

Phase 2 (Medium effort — prompt restructuring):
  [x] Planning scaffolding                ← DONE (added "Complex Workflows" subsection with dependency ordering, progress signaling, workflow pattern recognition)
  [x] Structured persona framework        ← DONE (added "Your Identity" section: stay in character, adapt to audience, domain confidence, consistent voice)

Phase 3 (Significant effort — code changes):
  [x] Lazy tool documentation loading     ← DONE (keyword-based, 8 integration guides gated by message relevance; first message always gets all)
  [x] Relevance-filtered memories         ← DONE (vector search top-15 when agent has >15 memories; falls back to recency-based truncation)
  [x] Conversation history truncation     ← DONE (cap at 30 recent messages, note count of truncated older messages)
  [ ] Dynamic context budget              ← DEFERRED (the above 3 cover the key issues; budget allocation is a future optimization)
```

**Phase 1 is purely additive text in `system-prompt.ts`** — no code logic changes, no schema changes, immediately effective for every agent.

---

## Final System Prompt Structure (after all phases)

```
[User's custom systemPrompt]
[Conversation history]             ← NOW: capped at 30 messages, older noted with count
[Memories section]                 ← NOW: top-15 by vector relevance when >15 exist
[Pages/tabs section]
[Knowledge base section]
[Custom tools section]
[Schedules section]
[Automations section]
[Capabilities list]
[Your Identity]                    ← NEW: persona framework
[How to Approach Tasks]            ← NEW: cognitive framework + complex workflow scaffolding
[Autonomy guidelines]
[When Things Go Wrong]             ← NEW: error recovery strategy
[Schedule/timer guidance]
[Automation guidance]
[Inter-agent guidance]
[Per-integration guides]           ← NOW: lazy-loaded by message keywords (8 guides)
[Self-assessment section]
[Interactive questions guidance]   ← IMPROVED: expanded when-to-use / when-not-to-use
[Suggested follow-ups guidance]    ← IMPROVED: strategic context-specific guidance
[Before You Respond (Self-Check)]  ← NEW: verification checklist
[General guidelines]               ← IMPROVED: proactive memory, match detail to complexity
```

---

## Metrics to Track

After implementing changes, measure:
- **Task completion rate** — does the agent complete multi-step requests fully?
- **Follow-up rate** — do users need fewer clarifying follow-ups?
- **Tool call efficiency** — fewer wasted/failed tool calls per conversation?
- **Response quality** — subjective review of response helpfulness and format
- **Context utilization** — are we using the context window more efficiently?
