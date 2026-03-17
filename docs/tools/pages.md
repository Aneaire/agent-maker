# Pages

**Tool set name**: `pages`
**Default**: Enabled

Pages are structured workspaces that appear in the user's sidebar. Agents can autonomously create and manage different page types — they don't just chat, they build organized data.

## Page Types

### Tasks
Kanban-style task boards with drag-and-drop columns.

| Tool | Description |
|------|-------------|
| `create_task` | Create a task with title, description, status, priority |
| `update_task` | Update any task field |
| `list_tasks` | List all tasks on a board |

**Status values**: `todo`, `in_progress`, `done` (plus custom statuses via column config)
**Priority values**: `low`, `medium`, `high`

### Notes
Markdown note collections.

| Tool | Description |
|------|-------------|
| `save_note` | Create a new note with title and content |
| `update_note` | Update title or content |
| `list_notes` | List all notes on a page |

### Spreadsheets
Structured data tables with typed columns. **Pro+ only**.

| Tool | Description |
|------|-------------|
| `add_spreadsheet_column` | Define a column (text, number, date, checkbox) |
| `add_spreadsheet_row` | Add a row with data mapped to column names |
| `update_spreadsheet_row` | Update an existing row |
| `list_spreadsheet_data` | Get all columns and rows |

### Markdown / Data Table
Static content pages the agent writes.

| Tool | Description |
|------|-------------|
| `write_page_content` | Write or overwrite the full page content |

### Creating Pages

| Tool | Description |
|------|-------------|
| `create_page` | Create a new page of any type |

## Agent Behavior

When pages are enabled, the system prompt tells the agent to:
- **Be proactive**: Create task pages when users need to track things, spreadsheets for data, notes for documentation
- **Set up everything**: Define spreadsheet columns before adding rows
- **Manage fully**: Don't just create pages — populate them with content

## Webhooks Integration

Task pages support outgoing webhooks. When tasks are created, updated, or deleted, webhooks fire automatically:
- `task.created` — New task added
- `task.updated` — Task fields changed
- `task.deleted` — Task removed

Configure webhooks in the task page's settings panel.

## Example Usage

**User**: "Track my weekly expenses"

**Agent** creates:
1. A spreadsheet page called "Weekly Expenses"
2. Columns: Date (date), Description (text), Amount (number), Category (text)
3. Adds rows for any expenses the user mentions

## Limits

| Limit | Value |
|-------|-------|
| Tasks per page | 500 |
| Notes per page | 200 |
| Spreadsheet rows per page | 10,000 |
| Spreadsheet columns per page | 100 |
| Title length | 500 chars |
| Description length | 5,000 chars |
| Note content | 100KB |
| Row data | 50KB |

## Page Type Availability

| Page Type | Free | Pro | Enterprise |
|-----------|------|-----|------------|
| Tasks | Yes | Yes | Yes |
| Notes | Yes | Yes | Yes |
| Markdown | Yes | Yes | Yes |
| Data Table | Yes | Yes | Yes |
| Spreadsheet | — | Yes | Yes |
| PostgreSQL | — | Yes | Yes |
| API Endpoints | — | Yes | Yes |
