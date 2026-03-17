# Web Search

**Tool set name**: `web_search`
**Default**: Enabled

Allows agents to search the internet and fetch web pages for current information.

## Tools

| Tool | Description |
|------|-------------|
| `WebSearch` | Search the web (built-in Claude Agent SDK) |
| `WebFetch` | Fetch and read web pages (built-in Claude Agent SDK) |

## How It Works

These are native Claude Agent SDK tools — they don't go through the MCP tool server. When enabled, the agent can search for current events, prices, documentation, or any publicly available information.

## Agent Behavior

When web search is enabled, the agent's system prompt includes:
> "Always search the web when asked about current events, prices, or recent information"

## Example Usage

**User**: "What's the current price of Bitcoin?"
**Agent**: Uses `WebSearch` to find the current price, then responds with up-to-date data.

**User**: "Read the docs at https://docs.convex.dev/quickstart"
**Agent**: Uses `WebFetch` to read the page and summarize the content.
