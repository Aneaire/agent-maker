# Tool Sets Reference

Complete list of all tool sets, their tools, and configuration.

## Overview

| Tool Set | Key | Default | Plan |
|----------|-----|---------|------|
| Memory | `memory` | Enabled | All |
| Web Search | `web_search` | Enabled | All |
| Pages | `pages` | Enabled | All |
| Custom HTTP Tools | `custom_http_tools` | Enabled | All |
| Email | `email` | Disabled | All |
| Knowledge Base (RAG) | `rag` | Disabled | All |
| Scheduled Actions | `schedules` | Disabled | All |
| Automations | `automations` | Disabled | All |
| Timers & Delays | `timers` | Disabled | All |
| Webhooks | `webhooks` | Disabled | All |
| Inter-Agent Messaging | `agent_messages` | Disabled | All |
| REST API | `rest_api` | Disabled | Pro+ |
| PostgreSQL | `postgres` | Disabled | Pro+ |

## All Tools by Set

### memory
| MCP Tool Name | Description |
|---------------|-------------|
| `store_memory` | Save information with optional category |
| `recall_memory` | Full-text search across memories |
| `search_memories` | List all memories with optional filter |

### web_search
| SDK Tool Name | Description |
|---------------|-------------|
| `WebSearch` | Search the internet |
| `WebFetch` | Fetch and read web pages |

### pages
| MCP Tool Name | Description |
|---------------|-------------|
| `create_page` | Create a new page (tasks, notes, spreadsheet, markdown, data_table) |
| `create_task` | Create task (if tasks page exists) |
| `update_task` | Update task fields |
| `list_tasks` | List tasks on a board |
| `save_note` | Create note (if notes page exists) |
| `update_note` | Update note content |
| `list_notes` | List notes |
| `add_spreadsheet_column` | Define spreadsheet column (if spreadsheet page exists) |
| `add_spreadsheet_row` | Add spreadsheet row |
| `update_spreadsheet_row` | Update spreadsheet row |
| `list_spreadsheet_data` | Get all columns and rows |
| `write_page_content` | Write markdown/data_table page content |

### email
| MCP Tool Name | Description |
|---------------|-------------|
| `send_email` | Send email via Resend (HTML, CC, BCC, reply-to) |

**Requires configuration**: Resend API key, from email, from name

### rag
| MCP Tool Name | Description |
|---------------|-------------|
| `search_documents` | Vector search across uploaded documents |

**Requires**: Uploaded documents + GEMINI_API_KEY env var

### custom_http_tools
| MCP Tool Name | Description |
|---------------|-------------|
| `custom_{name}` | Dynamically generated per user configuration |

### schedules
| MCP Tool Name | Description |
|---------------|-------------|
| `create_schedule` | Create recurring/one-time scheduled action |
| `list_schedules` | List all schedules with status |
| `pause_schedule` | Pause an active schedule |
| `resume_schedule` | Resume a paused schedule |
| `delete_schedule` | Delete a schedule |

### automations
| MCP Tool Name | Description |
|---------------|-------------|
| `create_automation` | Create event → action rule |
| `list_automations` | List all automation rules |
| `delete_automation` | Delete an automation |

### timers
| MCP Tool Name | Description |
|---------------|-------------|
| `set_timer` | Set a delayed action |
| `list_timers` | List active timers |
| `cancel_timer` | Cancel a waiting timer |

### webhooks
| MCP Tool Name | Description |
|---------------|-------------|
| `fire_webhook` | Send POST to any URL |
| `list_events` | View event bus history |

### agent_messages
| MCP Tool Name | Description |
|---------------|-------------|
| `list_sibling_agents` | List other agents you can message |
| `send_to_agent` | Send message to another agent |
| `check_agent_messages` | Check for pending messages |
| `respond_to_agent` | Reply to an agent message |

### Always-On Tools (not gated)
| MCP Tool Name | Description |
|---------------|-------------|
| `suggest_replies` | Render clickable follow-up suggestion buttons |
| `ask_questions` | Present interactive multiple-choice cards |
