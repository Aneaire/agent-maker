import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface GSheetsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function getAccessToken(config: GSheetsConfig): Promise<string> {
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

async function sheetsFetch(
  config: GSheetsConfig,
  path: string,
  method: string = "GET",
  body?: any
) {
  const accessToken = await getAccessToken(config);
  const res = await fetch(`${SHEETS_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error?.message || `Google Sheets API error: ${res.status}`
    );
  }
  return data;
}

export function createGSheetsTools(
  convexClient: AgentConvexClient,
  agentId: string,
  config: GSheetsConfig
) {
  // ── Create Spreadsheet ──────────────────────────────────────────────
  const createSpreadsheet = tool(
    "gsheets_create",
    "Create a new Google Sheets spreadsheet. Optionally provide sheet names and initial headers.",
    {
      title: z.string().describe("Spreadsheet title"),
      sheets: z
        .array(z.string())
        .optional()
        .describe("Sheet/tab names (default: ['Sheet1'])"),
      headers: z
        .array(z.string())
        .optional()
        .describe("Column headers for the first sheet"),
    },
    async (input) => {
      try {
        const sheetNames = input.sheets ?? ["Sheet1"];
        const body: any = {
          properties: { title: input.title },
          sheets: sheetNames.map((name) => ({
            properties: { title: name },
          })),
        };

        const created = await sheetsFetch(config, "", "POST", body);

        // Add headers if provided
        if (input.headers && input.headers.length > 0) {
          await sheetsFetch(
            config,
            `/${created.spreadsheetId}/values/${encodeURIComponent(sheetNames[0])}!A1:append?valueInputOption=USER_ENTERED`,
            "POST",
            { values: [input.headers] }
          );
        }

        await convexClient.emitEvent(
          agentId,
          "gsheets.spreadsheet_created",
          "gsheets_tools",
          {
            spreadsheetId: created.spreadsheetId,
            title: input.title,
          }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Spreadsheet created: "${input.title}"\nID: ${created.spreadsheetId}\nLink: ${created.spreadsheetUrl}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create spreadsheet: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Get Spreadsheet Info ────────────────────────────────────────────
  const getSpreadsheet = tool(
    "gsheets_get_info",
    "Get metadata about a spreadsheet — title, sheet names, and row/column counts.",
    {
      spreadsheet_id: z.string().describe("The spreadsheet ID"),
    },
    async (input) => {
      try {
        const data = await sheetsFetch(
          config,
          `/${input.spreadsheet_id}?fields=properties.title,sheets.properties`
        );

        const info = {
          title: data.properties.title,
          sheets: (data.sheets ?? []).map((s: any) => ({
            name: s.properties.title,
            sheetId: s.properties.sheetId,
            rows: s.properties.gridProperties?.rowCount,
            columns: s.properties.gridProperties?.columnCount,
          })),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get spreadsheet info: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Read Range ──────────────────────────────────────────────────────
  const readRange = tool(
    "gsheets_read",
    "Read data from a range in a Google Sheet. Returns the cell values as a 2D array.",
    {
      spreadsheet_id: z.string().describe("The spreadsheet ID"),
      range: z
        .string()
        .describe(
          "A1 notation range (e.g. 'Sheet1!A1:D10', 'Sheet1', 'A1:B5')"
        ),
    },
    async (input) => {
      try {
        const data = await sheetsFetch(
          config,
          `/${input.spreadsheet_id}/values/${encodeURIComponent(input.range)}`
        );

        const values = data.values ?? [];
        if (values.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "Range is empty — no data found." },
            ],
          };
        }

        // Format as a readable table
        const headers = values[0] as string[];
        const rows = values.slice(1);
        const table = {
          headers,
          rows,
          totalRows: rows.length,
          range: data.range,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(table, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to read range: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Write Range ─────────────────────────────────────────────────────
  const writeRange = tool(
    "gsheets_write",
    "Write data to a specific range in a Google Sheet. Overwrites existing data in that range.",
    {
      spreadsheet_id: z.string().describe("The spreadsheet ID"),
      range: z
        .string()
        .describe("A1 notation range to write to (e.g. 'Sheet1!A1:C3')"),
      values: z
        .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
        .describe("2D array of values — each inner array is a row"),
    },
    async (input) => {
      try {
        const result = await sheetsFetch(
          config,
          `/${input.spreadsheet_id}/values/${encodeURIComponent(input.range)}?valueInputOption=USER_ENTERED`,
          "PUT",
          { values: input.values }
        );

        await convexClient.emitEvent(
          agentId,
          "gsheets.data_written",
          "gsheets_tools",
          {
            spreadsheetId: input.spreadsheet_id,
            range: input.range,
            rowCount: input.values.length,
          }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Updated ${result.updatedCells} cells in range ${result.updatedRange}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to write data: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Append Rows ─────────────────────────────────────────────────────
  const appendRows = tool(
    "gsheets_append",
    "Append rows to the end of a sheet. Automatically finds the next empty row.",
    {
      spreadsheet_id: z.string().describe("The spreadsheet ID"),
      sheet: z
        .string()
        .optional()
        .describe("Sheet/tab name (default: first sheet)"),
      rows: z
        .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
        .describe("Array of rows to append — each inner array is a row"),
    },
    async (input) => {
      try {
        const range = input.sheet
          ? `${input.sheet}!A:A`
          : "A:A";

        const result = await sheetsFetch(
          config,
          `/${input.spreadsheet_id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          "POST",
          { values: input.rows }
        );

        await convexClient.emitEvent(
          agentId,
          "gsheets.rows_appended",
          "gsheets_tools",
          {
            spreadsheetId: input.spreadsheet_id,
            sheet: input.sheet,
            rowCount: input.rows.length,
          }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Appended ${input.rows.length} row(s). Updated range: ${result.updates?.updatedRange || "success"}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to append rows: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── List Spreadsheets ───────────────────────────────────────────────
  const listSpreadsheets = tool(
    "gsheets_list_spreadsheets",
    "List all Google Sheets spreadsheets in the user's Google Drive. Returns titles, IDs, and links.",
    {
      max_results: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results to return (default 20)"),
    },
    async (input) => {
      try {
        const accessToken = await getAccessToken(config);
        const params = new URLSearchParams({
          q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
          pageSize: String(input.max_results ?? 20),
          fields: "files(id,name,modifiedTime,webViewLink)",
          orderBy: "modifiedTime desc",
        });
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || `Drive API error: ${res.status}`);
        }
        const files = (data.files ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
          modifiedTime: f.modifiedTime,
          link: f.webViewLink,
        }));
        return {
          content: [
            {
              type: "text" as const,
              text:
                files.length > 0
                  ? JSON.stringify({ spreadsheets: files, count: files.length }, null, 2)
                  : "No spreadsheets found in Google Drive.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list spreadsheets: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Clear Range ─────────────────────────────────────────────────────
  const clearRange = tool(
    "gsheets_clear",
    "Clear all values from a range in a Google Sheet (keeps formatting).",
    {
      spreadsheet_id: z.string().describe("The spreadsheet ID"),
      range: z
        .string()
        .describe("A1 notation range to clear (e.g. 'Sheet1!A2:Z')"),
    },
    async (input) => {
      try {
        await sheetsFetch(
          config,
          `/${input.spreadsheet_id}/values/${encodeURIComponent(input.range)}:clear`,
          "POST"
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Cleared range: ${input.range}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to clear range: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  return [
    listSpreadsheets,
    createSpreadsheet,
    getSpreadsheet,
    readRange,
    writeRange,
    appendRows,
    clearRange,
  ];
}
