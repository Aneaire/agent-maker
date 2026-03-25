import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface GCalConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const GCAL_BASE = "https://www.googleapis.com/calendar/v3";

/** Exchange refresh token for a fresh access token */
async function getAccessToken(config: GCalConfig): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google OAuth error: ${data.error_description || data.error || res.status}`
    );
  }
  return data.access_token;
}

async function gcalFetch(
  config: GCalConfig,
  path: string,
  method: string = "GET",
  body?: any
) {
  const accessToken = await getAccessToken(config);
  const res = await fetch(`${GCAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (method === "DELETE" && res.status === 204) return {};

  const data = await res.json();
  if (!res.ok) {
    const msg = data.error?.message || `Google Calendar API error: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Format a Google Calendar event into a concise summary */
function summariseEvent(event: any) {
  return {
    id: event.id,
    title: event.summary || "(no title)",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    location: event.location || null,
    description: event.description
      ? event.description.substring(0, 200)
      : null,
    status: event.status,
    attendees: (event.attendees ?? []).map((a: any) => ({
      email: a.email,
      status: a.responseStatus,
    })),
    meetLink: event.hangoutLink || null,
    htmlLink: event.htmlLink,
  };
}

export function createGCalTools(
  convexClient: AgentConvexClient,
  agentId: string,
  gcalConfig: GCalConfig
) {
  // ── List Calendars ──────────────────────────────────────────────────
  const listCalendars = tool(
    "gcal_list_calendars",
    "List all calendars accessible to the user. Use this to find calendar IDs.",
    {},
    async () => {
      try {
        const data = await gcalFetch(gcalConfig, "/users/me/calendarList");
        const calendars = (data.items ?? []).map((cal: any) => ({
          id: cal.id,
          name: cal.summary,
          description: cal.description || null,
          primary: cal.primary || false,
          timeZone: cal.timeZone,
        }));
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(calendars, null, 2) },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Failed to list calendars: ${err.message}` },
          ],
        };
      }
    }
  );

  // ── List Events ─────────────────────────────────────────────────────
  const listEvents = tool(
    "gcal_list_events",
    "List upcoming events from a calendar. Can filter by date range. Returns event details including title, time, location, and attendees.",
    {
      calendar_id: z
        .string()
        .optional()
        .describe("Calendar ID (default: 'primary')"),
      time_min: z
        .string()
        .optional()
        .describe("Start of time range (ISO 8601, e.g. '2025-03-20T00:00:00Z'). Defaults to now."),
      time_max: z
        .string()
        .optional()
        .describe("End of time range (ISO 8601). Defaults to 7 days from now."),
      max_results: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max events to return (default 20)"),
      query: z
        .string()
        .optional()
        .describe("Free-text search query to filter events"),
    },
    async (input) => {
      try {
        const calId = encodeURIComponent(input.calendar_id || "primary");
        const now = new Date().toISOString();
        const weekFromNow = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        const params = new URLSearchParams({
          timeMin: input.time_min || now,
          timeMax: input.time_max || weekFromNow,
          maxResults: String(input.max_results ?? 20),
          singleEvents: "true",
          orderBy: "startTime",
        });
        if (input.query) params.set("q", input.query);

        const data = await gcalFetch(
          gcalConfig,
          `/calendars/${calId}/events?${params}`
        );
        const events = (data.items ?? []).map(summariseEvent);

        return {
          content: [
            {
              type: "text" as const,
              text:
                events.length > 0
                  ? JSON.stringify(events, null, 2)
                  : "No events found in the given range.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Failed to list events: ${err.message}` },
          ],
        };
      }
    }
  );

  // ── Create Event ────────────────────────────────────────────────────
  const createEvent = tool(
    "gcal_create_event",
    "Create a new event on a Google Calendar. Can include attendees, location, description, and Google Meet link.",
    {
      title: z.string().describe("Event title/summary"),
      start: z
        .string()
        .describe("Start time in ISO 8601 (e.g. '2025-03-20T14:00:00-05:00') or date for all-day (e.g. '2025-03-20')"),
      end: z
        .string()
        .describe("End time in ISO 8601 or date for all-day events"),
      calendar_id: z
        .string()
        .optional()
        .describe("Calendar ID (default: 'primary')"),
      description: z.string().optional().describe("Event description (supports HTML)"),
      location: z.string().optional().describe("Event location"),
      attendees: z
        .array(z.string())
        .optional()
        .describe("Attendee email addresses"),
      add_meet: z
        .boolean()
        .optional()
        .describe("Add a Google Meet video conference link"),
      timezone: z
        .string()
        .optional()
        .describe("Timezone (e.g. 'America/New_York'). Defaults to calendar timezone."),
    },
    async (input) => {
      try {
        const calId = encodeURIComponent(input.calendar_id || "primary");
        const isAllDay = !input.start.includes("T");

        const event: any = {
          summary: input.title,
          start: isAllDay
            ? { date: input.start }
            : { dateTime: input.start, timeZone: input.timezone },
          end: isAllDay
            ? { date: input.end }
            : { dateTime: input.end, timeZone: input.timezone },
        };
        if (input.description) event.description = input.description;
        if (input.location) event.location = input.location;
        if (input.attendees) {
          event.attendees = input.attendees.map((email) => ({ email }));
        }
        if (input.add_meet) {
          event.conferenceData = {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
        }

        const params = input.add_meet ? "?conferenceDataVersion=1" : "";
        const created = await gcalFetch(
          gcalConfig,
          `/calendars/${calId}/events${params}`,
          "POST",
          event
        );

        await convexClient.emitEvent(
          agentId,
          "gcal.event_created",
          "gcal_tools",
          {
            eventId: created.id,
            title: input.title,
            start: input.start,
            end: input.end,
            description: input.description,
            location: input.location,
            attendees: input.attendees,
            timezone: input.timezone,
            meetLink: created.hangoutLink,
            htmlLink: created.htmlLink,
          }
        );

        const meetInfo = created.hangoutLink
          ? `\nMeet link: ${created.hangoutLink}`
          : "";

        return {
          content: [
            {
              type: "text" as const,
              text: `Event created: "${input.title}"\nID: ${created.id}\nLink: ${created.htmlLink}${meetInfo}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Failed to create event: ${err.message}` },
          ],
        };
      }
    }
  );

  // ── Update Event ────────────────────────────────────────────────────
  const updateEvent = tool(
    "gcal_update_event",
    "Update an existing Google Calendar event. Only specify the fields you want to change.",
    {
      event_id: z.string().describe("The event ID to update"),
      calendar_id: z
        .string()
        .optional()
        .describe("Calendar ID (default: 'primary')"),
      title: z.string().optional().describe("New event title"),
      start: z.string().optional().describe("New start time (ISO 8601)"),
      end: z.string().optional().describe("New end time (ISO 8601)"),
      description: z.string().optional().describe("New description"),
      location: z.string().optional().describe("New location"),
      attendees: z
        .array(z.string())
        .optional()
        .describe("Updated attendee email list (replaces existing)"),
      timezone: z.string().optional().describe("Timezone for start/end"),
    },
    async (input) => {
      try {
        const calId = encodeURIComponent(input.calendar_id || "primary");
        const patch: any = {};

        if (input.title) patch.summary = input.title;
        if (input.description !== undefined)
          patch.description = input.description;
        if (input.location !== undefined) patch.location = input.location;
        if (input.start) {
          const isAllDay = !input.start.includes("T");
          patch.start = isAllDay
            ? { date: input.start }
            : { dateTime: input.start, timeZone: input.timezone };
        }
        if (input.end) {
          const isAllDay = !input.end.includes("T");
          patch.end = isAllDay
            ? { date: input.end }
            : { dateTime: input.end, timeZone: input.timezone };
        }
        if (input.attendees) {
          patch.attendees = input.attendees.map((email) => ({ email }));
        }

        const updated = await gcalFetch(
          gcalConfig,
          `/calendars/${calId}/events/${input.event_id}`,
          "PATCH",
          patch
        );

        await convexClient.emitEvent(
          agentId,
          "gcal.event_updated",
          "gcal_tools",
          {
            eventId: input.event_id,
            title: input.title ?? updated.summary,
            start: input.start,
            end: input.end,
            description: input.description,
            location: input.location,
            attendees: input.attendees,
            htmlLink: updated.htmlLink,
            changed: Object.keys(patch),
          }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Event updated: "${updated.summary}"\nLink: ${updated.htmlLink}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Failed to update event: ${err.message}` },
          ],
        };
      }
    }
  );

  // ── Delete Event ────────────────────────────────────────────────────
  const deleteEvent = tool(
    "gcal_delete_event",
    "Delete an event from Google Calendar.",
    {
      event_id: z.string().describe("The event ID to delete"),
      calendar_id: z
        .string()
        .optional()
        .describe("Calendar ID (default: 'primary')"),
    },
    async (input) => {
      try {
        const calId = encodeURIComponent(input.calendar_id || "primary");
        await gcalFetch(
          gcalConfig,
          `/calendars/${calId}/events/${input.event_id}`,
          "DELETE"
        );

        await convexClient.emitEvent(
          agentId,
          "gcal.event_deleted",
          "gcal_tools",
          {
            eventId: input.event_id,
            calendarId: input.calendar_id ?? "primary",
          }
        );

        return {
          content: [
            { type: "text" as const, text: "Event deleted successfully." },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Failed to delete event: ${err.message}` },
          ],
        };
      }
    }
  );

  // ── Find Free Time ──────────────────────────────────────────────────
  const findFreeTime = tool(
    "gcal_find_free_time",
    "Check availability (free/busy) for one or more calendars. Use this to find open time slots for scheduling meetings.",
    {
      calendars: z
        .array(z.string())
        .optional()
        .describe("Calendar IDs to check (default: ['primary'])"),
      time_min: z
        .string()
        .describe("Start of range (ISO 8601)"),
      time_max: z
        .string()
        .describe("End of range (ISO 8601)"),
    },
    async (input) => {
      try {
        const calendarIds = input.calendars ?? ["primary"];
        const data = await gcalFetch(gcalConfig, "/freeBusy", "POST", {
          timeMin: input.time_min,
          timeMax: input.time_max,
          items: calendarIds.map((id) => ({ id })),
        });

        const result: Record<string, any> = {};
        for (const [calId, info] of Object.entries(data.calendars ?? {}) as [
          string,
          any,
        ][]) {
          result[calId] = {
            busy: (info.busy ?? []).map((b: any) => ({
              start: b.start,
              end: b.end,
            })),
            errors: info.errors,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Failed to check availability: ${err.message}` },
          ],
        };
      }
    }
  );

  return [
    listCalendars,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    findFreeTime,
  ];
}
