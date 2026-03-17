# REST API Endpoints

**Plan**: Pro+

Expose your agent as a REST API. External systems send HTTP requests, and your agent processes them and returns structured responses.

## Setup

1. Create an **API** page type for your agent
2. Define endpoints with name, method, prompt template, and response format
3. Generate an **API key** in agent settings
4. Call `POST /api/{agentId}/{endpointSlug}` with your API key

## Authentication

Pass your API key via:
- **Header**: `Authorization: Bearer YOUR_API_KEY`
- **Query parameter**: `?api_key=YOUR_API_KEY`

## Endpoint Configuration

Each endpoint has:
- **Name** — Display name and slug (e.g. "Summarize Text" → `/summarize-text`)
- **Method** — GET, POST, PUT, DELETE, PATCH
- **Prompt Template** — Instructions for the agent on how to handle the request
- **Response Format** — `json` or `text`

### Prompt Template

The prompt template receives the incoming request data:

```
Summarize the following text in 3 bullet points.

--- Incoming Request ---
Method: POST
Endpoint: /summarize-text
Query Parameters: {}
Body: {"text": "..."}
---

Respond with valid JSON only.
```

## Example

### Define Endpoint
```
Name: "Analyze Sentiment"
Method: POST
Prompt: "Analyze the sentiment of the given text. Return a JSON object with 'sentiment' (positive/negative/neutral) and 'confidence' (0-1)."
Response Format: json
```

### Call It
```bash
curl -X POST https://your-server.com/api/agent123/analyze-sentiment \
  -H "Authorization: Bearer ak_xxx" \
  -H "Content-Type: application/json" \
  -d '{"text": "I love this product!"}'
```

### Response
```json
{
  "sentiment": "positive",
  "confidence": 0.95
}
```

## Limits

- 20 endpoints per API page
- Endpoint slugs must be unique per agent
- The agent runs synchronously for API requests
