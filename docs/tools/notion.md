# Notion

**Tool set name**: `notion`
**Default**: Disabled
**Requires**: Notion API key (internal integration token)

Connect your agent to Notion to search, read, create, and update pages and databases.

## Setup

1. Go to your agent's **Settings** page
2. Enable the **Notion** tool set
3. Configure:
   - **Notion API Key** — Create an internal integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
4. Share the relevant Notion pages/databases with your integration (via the "Connections" menu in Notion)

## Tools

| Tool | Description |
|------|-------------|
| `notion_search` | Search Notion for pages and databases by keyword |
| `notion_query_database` | Query a database with optional filters and sorts |
| `notion_create_page` | Create a new page under a parent page or as a database entry |
| `notion_update_page` | Update properties on an existing page |
| `notion_get_page` | Retrieve a page's properties and text content |
| `notion_append_blocks` | Append content blocks (paragraphs, headings, lists, todos) to a page |

## Event Bus Integration

The following events are emitted:
- `notion.searched` — Search performed
- `notion.database_queried` — Database query executed
- `notion.page_created` — New page created
- `notion.page_updated` — Page properties updated
- `notion.blocks_appended` — Content blocks added to a page

## Example Usage

**User**: "Find my project tracker database in Notion and show me all tasks with status 'In Progress'"

**Agent**: Uses `notion_search` to find the database, then `notion_query_database` with a status filter to retrieve matching entries.

**User**: "Add a new task called 'Review designs' to my project tracker"

**Agent**: Uses `notion_create_page` with `parent_type: "database"` and the database ID to create the entry.

**User**: "Add meeting notes to the Q2 Planning page"

**Agent**: Uses `notion_append_blocks` to add headings, bullet points, and paragraphs to the existing page.
