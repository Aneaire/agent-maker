# Google Sheets

**Tool set name**: `google_sheets`
**Default**: Disabled
**Requires**: Google OAuth credentials (client ID, client secret, refresh token)

Read and write data in Google Sheets spreadsheets. Create new spreadsheets, read ranges, write cells, append rows, and clear data.

## Setup

1. Go to your agent's **Settings** page
2. Enable the **Google Sheets** tool set
3. Configure:
   - **Client ID** — Google OAuth client ID
   - **Client Secret** — Google OAuth client secret
   - **Refresh Token** — OAuth refresh token with `https://www.googleapis.com/auth/spreadsheets` scope

## Tools

| Tool | Description |
|------|-------------|
| `gsheets_create` | Create a new spreadsheet with optional sheet names and column headers |
| `gsheets_get_info` | Get spreadsheet metadata — title, sheet names, row/column counts |
| `gsheets_read` | Read data from a range (A1 notation), returns headers and rows |
| `gsheets_write` | Write a 2D array of values to a specific range (overwrites existing data) |
| `gsheets_append` | Append rows to the end of a sheet (auto-finds the next empty row) |
| `gsheets_clear` | Clear all values from a range (keeps formatting intact) |

## Event Bus Integration

The following events are emitted:
- `gsheets.spreadsheet_created` — New spreadsheet created
- `gsheets.data_written` — Data written to a range
- `gsheets.rows_appended` — Rows appended to a sheet

## Example Usage

**User**: "Create a spreadsheet to track expenses with columns for Date, Description, Amount, and Category"

**Agent**: Uses `gsheets_create` with the title and headers, returns the spreadsheet link.

**User**: "Add a row: March 15, Lunch meeting, $45, Food"

**Agent**: Uses `gsheets_append` to add the row to the next empty position.

**User**: "Show me everything in the expenses sheet"

**Agent**: Uses `gsheets_read` with the full sheet range and presents the data in a readable format.
