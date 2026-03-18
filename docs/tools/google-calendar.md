# Google Calendar

**Tool set name**: `google_calendar`
**Default**: Disabled
**Requires**: Google OAuth credentials (client ID, client secret, refresh token)

Manage Google Calendar events — list, create, update, delete events, and check availability.

## Setup

1. Go to your agent's **Settings** page
2. Enable the **Google Calendar** tool set
3. Configure:
   - **Client ID** — Google OAuth client ID
   - **Client Secret** — Google OAuth client secret
   - **Refresh Token** — OAuth refresh token with `https://www.googleapis.com/auth/calendar` scope

## Tools

| Tool | Description |
|------|-------------|
| `gcal_list_calendars` | List all calendars accessible to the user |
| `gcal_list_events` | List upcoming events with optional date range and search filters |
| `gcal_create_event` | Create an event with attendees, location, description, and Google Meet link |
| `gcal_update_event` | Update an existing event (title, time, attendees, etc.) |
| `gcal_delete_event` | Delete an event from a calendar |
| `gcal_find_free_time` | Check free/busy status across one or more calendars |

## Event Bus Integration

The following events are emitted:
- `gcal.event_created` — New event created
- `gcal.event_updated` — Event modified
- `gcal.event_deleted` — Event removed

## Example Usage

**User**: "What's on my calendar this week?"

**Agent**: Uses `gcal_list_events` with the current week's date range to show upcoming events.

**User**: "Schedule a meeting with alice@example.com tomorrow at 2pm for 1 hour"

**Agent**: Uses `gcal_create_event` with the attendee, start/end times, and optionally adds a Google Meet link.

**User**: "When am I free on Friday?"

**Agent**: Uses `gcal_find_free_time` to check availability and reports open time slots.
