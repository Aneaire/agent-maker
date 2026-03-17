# Memory

**Tool set name**: `memory`
**Default**: Enabled

Persistent memory allows agents to store and recall information across conversations. When a user shares preferences, important details, or context, the agent can save it and reference it later.

## Tools

| Tool | Description |
|------|-------------|
| `store_memory` | Save information with an optional category |
| `recall_memory` | Full-text search across stored memories |
| `search_memories` | List all memories, optionally filtered |

## How It Works

Memories are stored per-agent in the `memories` table with full-text search indexing. When a conversation starts, the agent's system prompt includes its most recent memories (up to 20) so it has context from prior interactions.

## Agent Behavior

When memory is enabled, the agent's system prompt includes:
> "When the user shares preferences or important information, store it in memory"

The agent will proactively remember:
- User preferences ("I prefer dark mode", "Call me Alex")
- Project context ("We're using Next.js for the frontend")
- Important facts ("The deadline is March 30th")
- Recurring topics across conversations

## Categories

Memories can be tagged with categories for organization:
- `preference` — User preferences
- `work` — Work-related context
- `project` — Project-specific details
- `contact` — Contact information
- Custom categories as needed

## Example Usage

**User**: "Remember that I prefer TypeScript over JavaScript and always use Tailwind for styling"

**Agent** stores:
```
Content: "User prefers TypeScript over JavaScript and always uses Tailwind for styling"
Category: "preference"
```

**User** (next conversation): "Set up a new project for me"

**Agent** reads memory and knows to use TypeScript + Tailwind.

## Limits

- Up to 20 memories loaded into context per conversation
- Full-text search across all memories when using `recall_memory`
- No hard limit on total memories per agent (managed by search relevance)
