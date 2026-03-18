# Google Drive

**Tool set name**: `google_drive`
**Default**: Disabled
**Requires**: Google OAuth credentials (client ID, client secret, refresh token)

Search, read, create, and organize files in Google Drive. Supports Google Docs, Sheets, and regular files.

## Setup

1. Go to your agent's **Settings** page
2. Enable the **Google Drive** tool set
3. Configure:
   - **Client ID** — Google OAuth client ID
   - **Client Secret** — Google OAuth client secret
   - **Refresh Token** — OAuth refresh token with `https://www.googleapis.com/auth/drive` scope

## Tools

| Tool | Description |
|------|-------------|
| `gdrive_search` | Search files and folders by name, content, or Drive query syntax |
| `gdrive_list_files` | List files in a folder (defaults to root) |
| `gdrive_read_file` | Read text content from a file (exports Google Docs as text, Sheets as CSV) |
| `gdrive_create_file` | Create a Google Doc, Sheet, folder, or plain text file with optional initial content |
| `gdrive_move_file` | Move a file to a different folder and/or rename it |
| `gdrive_delete_file` | Move a file to the trash |

## Event Bus Integration

The following events are emitted:
- `gdrive.file_created` — New file or folder created
- `gdrive.file_deleted` — File moved to trash

## Example Usage

**User**: "Find the Q2 report in my Drive"

**Agent**: Uses `gdrive_search` with the query and returns matching files with links.

**User**: "Create a new Google Doc called 'Meeting Notes' with today's agenda"

**Agent**: Uses `gdrive_create_file` with type `doc` and the agenda as initial content.

**User**: "Read the contents of that spreadsheet"

**Agent**: Uses `gdrive_read_file` which exports the Google Sheet as CSV for reading.
