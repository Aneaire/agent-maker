# Custom HTTP Tools

**Tool set name**: `custom_http_tools`
**Default**: Enabled

Define custom API endpoints that your agent can call. Connect to any external service — CRMs, project management tools, internal APIs, etc.

## Setup

1. Go to Settings > **Custom HTTP Tools**
2. Click **Add Tool**
3. Configure:
   - **Name** — Tool name (snake_case, e.g. `get_weather`)
   - **Description** — What this tool does (helps the agent know when to use it)
   - **Method** — GET, POST, PUT, DELETE, or PATCH
   - **Endpoint** — Full URL (e.g. `https://api.example.com/data`)
   - **Headers** (optional) — Custom headers (e.g. `Authorization: Bearer xxx`)
   - **Input Schema** (optional) — Define input parameters with types

## How Tools Are Generated

Each custom tool becomes an MCP tool named `custom_{name}`. The agent sees it alongside its other tools and calls it when relevant.

The tool:
1. Builds the request from the input parameters
2. Sends the HTTP request with configured method, headers, and body
3. Returns the response (truncated to 10KB)
4. Times out after 15 seconds

## Input Schema

Define parameters your tool accepts:

```json
{
  "city": { "type": "string", "description": "City name" },
  "units": { "type": "string", "description": "metric or imperial" }
}
```

These become typed parameters in the tool's Zod schema, so the agent provides structured input.

## Example Configurations

### Slack Message

```
Name: send_slack_message
Method: POST
Endpoint: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Description: Send a message to the #general Slack channel
Input Schema: { "text": { "type": "string", "description": "Message text" } }
```

### Weather API

```
Name: get_weather
Method: GET
Endpoint: https://api.openweathermap.org/data/2.5/weather
Headers: { "x-api-key": "YOUR_API_KEY" }
Description: Get current weather for a city
Input Schema: { "q": { "type": "string", "description": "City name" } }
```

### GitHub Issues

```
Name: create_github_issue
Method: POST
Endpoint: https://api.github.com/repos/owner/repo/issues
Headers: { "Authorization": "token YOUR_TOKEN", "Accept": "application/vnd.github.v3+json" }
Description: Create a new GitHub issue
Input Schema: {
  "title": { "type": "string", "description": "Issue title" },
  "body": { "type": "string", "description": "Issue description" }
}
```

## Agent Guidance

When custom HTTP tools are enabled, the agent's system prompt includes guidance to suggest tool configurations when users ask for capabilities that aren't available. The agent will output a ready-to-paste configuration the user can add in Settings.

## Limits

- 15-second request timeout
- 10KB response size limit
- Supports standard HTTP methods (GET, POST, PUT, DELETE, PATCH)
