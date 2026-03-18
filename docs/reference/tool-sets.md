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
| Notion | `notion` | Disabled | All |
| Slack | `slack` | Disabled | All |
| Google Calendar | `google_calendar` | Disabled | All |
| Google Drive | `google_drive` | Disabled | All |
| Google Sheets | `google_sheets` | Disabled | All |
| Image Generation | `image_generation` | Disabled | All |
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

### notion
| MCP Tool Name | Description |
|---------------|-------------|
| `notion_search` | Search pages and databases by keyword |
| `notion_query_database` | List and filter database entries |
| `notion_create_page` | Create a new page or database entry |
| `notion_update_page` | Update page properties |
| `notion_get_page` | Read page properties and content |
| `notion_append_blocks` | Add content blocks to a page |

**Requires configuration**: Notion API key

### slack
| MCP Tool Name | Description |
|---------------|-------------|
| `slack_send_message` | Post to channels or reply to threads |
| `slack_list_channels` | List available channels |
| `slack_read_messages` | Read recent channel or thread messages |
| `slack_add_reaction` | React to messages with emoji |
| `slack_set_topic` | Update channel topic |
| `slack_search_messages` | Search messages across channels |

**Requires configuration**: Slack bot token, optional default channel

### google_calendar
| MCP Tool Name | Description |
|---------------|-------------|
| `gcal_list_calendars` | List available calendars |
| `gcal_list_events` | List events (defaults to next 7 days) |
| `gcal_create_event` | Create event with attendees, location, Meet |
| `gcal_update_event` | Modify event details |
| `gcal_delete_event` | Cancel an event |
| `gcal_find_free_time` | Check availability across calendars |

**Requires configuration**: Google OAuth (clientId, clientSecret, refreshToken)

### google_drive
| MCP Tool Name | Description |
|---------------|-------------|
| `gdrive_search` | Search files by name or content |
| `gdrive_list_files` | Browse folder contents |
| `gdrive_read_file` | Read file content (Docs as text, Sheets as CSV) |
| `gdrive_create_file` | Create Docs, Sheets, folders, or text files |
| `gdrive_move_file` | Rename or reorganize files |
| `gdrive_delete_file` | Trash a file (recoverable) |

**Requires configuration**: Google OAuth (clientId, clientSecret, refreshToken)

### google_sheets
| MCP Tool Name | Description |
|---------------|-------------|
| `gsheets_create` | Create new spreadsheet with headers |
| `gsheets_get_info` | Get sheet names and dimensions |
| `gsheets_read` | Read data from a range (A1 notation) |
| `gsheets_write` | Overwrite a specific range |
| `gsheets_append` | Append rows at the bottom |
| `gsheets_clear` | Erase data from a range |

**Requires configuration**: Google OAuth (clientId, clientSecret, refreshToken)

### image_generation
| MCP Tool Name | Description |
|---------------|-------------|
| `generate_image` | Generate image from text prompt (Gemini Imagen or Nano Banana) |
| `list_assets` | List all generated images and files in asset library |

**Requires configuration**: Provider selection, Gemini API key and/or Nano Banana API key

### Always-On Tools (not gated)
| MCP Tool Name | Description |
|---------------|-------------|
| `suggest_replies` | Render clickable follow-up suggestion buttons |
| `ask_questions` | Present interactive multiple-choice cards |
