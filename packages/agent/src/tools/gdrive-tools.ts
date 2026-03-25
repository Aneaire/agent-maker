import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface GDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

async function getAccessToken(config: GDriveConfig): Promise<string> {
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

async function driveFetch(
  config: GDriveConfig,
  path: string,
  method: string = "GET",
  body?: any,
  extraHeaders?: Record<string, string>
) {
  const accessToken = await getAccessToken(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...extraHeaders,
  };
  if (body && !extraHeaders?.["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${DRIVE_BASE}${path}`, {
    method,
    headers,
    ...(body && {
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

  if (res.status === 204) return {};
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error?.message || `Google Drive API error: ${res.status}`
    );
  }
  return data;
}

function summariseFile(file: any) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? `${Math.round(Number(file.size) / 1024)}KB` : null,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
    parents: file.parents,
  };
}

const EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.drawing": "image/png",
};

export function createGDriveTools(
  convexClient: AgentConvexClient,
  agentId: string,
  config: GDriveConfig
) {
  // ── Search Files ────────────────────────────────────────────────────
  const searchFiles = tool(
    "gdrive_search",
    "Search Google Drive for files and folders by name or content. Returns file metadata with IDs and links.",
    {
      query: z
        .string()
        .describe(
          "Search query — file name, content keywords, or Drive query syntax (e.g. \"name contains 'report'\")"
        ),
      max_results: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default 20)"),
      mime_type: z
        .string()
        .optional()
        .describe(
          "Filter by MIME type (e.g. 'application/vnd.google-apps.spreadsheet', 'application/pdf')"
        ),
    },
    async (input) => {
      try {
        let q = `fullText contains '${input.query.replace(/'/g, "\\'")}'`;
        // If the query looks like Drive query syntax, use it directly
        if (
          input.query.includes(" contains ") ||
          input.query.includes("mimeType") ||
          input.query.includes("name =")
        ) {
          q = input.query;
        }
        if (input.mime_type) {
          q += ` and mimeType = '${input.mime_type}'`;
        }
        q += " and trashed = false";

        const params = new URLSearchParams({
          q,
          pageSize: String(input.max_results ?? 20),
          fields:
            "files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",
          orderBy: "modifiedTime desc",
        });

        const data = await driveFetch(config, `/files?${params}`);
        const files = (data.files ?? []).map(summariseFile);

        return {
          content: [
            {
              type: "text" as const,
              text:
                files.length > 0
                  ? JSON.stringify(files, null, 2)
                  : "No files found.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Search failed: ${err.message}` },
          ],
        };
      }
    }
  );

  // ── List Files ──────────────────────────────────────────────────────
  const listFiles = tool(
    "gdrive_list_files",
    "List files in a Google Drive folder. Defaults to the root folder.",
    {
      folder_id: z
        .string()
        .optional()
        .describe("Folder ID to list (default: root)"),
      max_results: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results (default 30)"),
    },
    async (input) => {
      try {
        const parentId = input.folder_id || "root";
        const params = new URLSearchParams({
          q: `'${parentId}' in parents and trashed = false`,
          pageSize: String(input.max_results ?? 30),
          fields:
            "files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",
          orderBy: "folder,name",
        });

        const data = await driveFetch(config, `/files?${params}`);
        const files = (data.files ?? []).map(summariseFile);

        return {
          content: [
            {
              type: "text" as const,
              text:
                files.length > 0
                  ? JSON.stringify(files, null, 2)
                  : "No files in this folder.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list files: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Read File Content ───────────────────────────────────────────────
  const readFile = tool(
    "gdrive_read_file",
    "Read the text content of a file from Google Drive. Works with Google Docs, Sheets (as CSV), text files, and other text-based formats.",
    {
      file_id: z.string().describe("The file ID to read"),
    },
    async (input) => {
      try {
        // First get file metadata to determine type
        const meta = await driveFetch(
          config,
          `/files/${input.file_id}?fields=id,name,mimeType,size`
        );

        const accessToken = await getAccessToken(config);
        let content: string;

        if (EXPORT_MIME[meta.mimeType]) {
          // Google Workspace files need export
          const exportMime = EXPORT_MIME[meta.mimeType];
          const res = await fetch(
            `${DRIVE_BASE}/files/${input.file_id}/export?mimeType=${encodeURIComponent(exportMime)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!res.ok) throw new Error(`Export failed: ${res.status}`);
          content = await res.text();
        } else {
          // Regular files — download content
          const res = await fetch(
            `${DRIVE_BASE}/files/${input.file_id}?alt=media`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!res.ok) throw new Error(`Download failed: ${res.status}`);
          content = await res.text();
        }

        // Truncate very large files
        const maxLen = 15000;
        const truncated =
          content.length > maxLen
            ? content.substring(0, maxLen) + "\n...(truncated)"
            : content;

        return {
          content: [
            {
              type: "text" as const,
              text: `File: ${meta.name} (${meta.mimeType})\n\n${truncated}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to read file: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Create File ─────────────────────────────────────────────────────
  const createFile = tool(
    "gdrive_create_file",
    "Create a new file in Google Drive. Can create Google Docs, plain text files, or folders.",
    {
      name: z.string().describe("File name"),
      type: z
        .enum(["doc", "sheet", "folder", "text"])
        .describe(
          "File type: 'doc' (Google Doc), 'sheet' (Google Sheet), 'folder', or 'text' (plain text)"
        ),
      content: z
        .string()
        .optional()
        .describe("Initial text content (for doc or text types)"),
      parent_id: z
        .string()
        .optional()
        .describe("Parent folder ID (default: root)"),
    },
    async (input) => {
      try {
        const mimeTypes: Record<string, string> = {
          doc: "application/vnd.google-apps.document",
          sheet: "application/vnd.google-apps.spreadsheet",
          folder: "application/vnd.google-apps.folder",
          text: "text/plain",
        };

        const metadata: any = {
          name: input.name,
          mimeType: mimeTypes[input.type],
        };
        if (input.parent_id) {
          metadata.parents = [input.parent_id];
        }

        let created: any;

        if (input.content && (input.type === "doc" || input.type === "text")) {
          // Multipart upload for files with content
          const accessToken = await getAccessToken(config);
          const boundary = "agent_upload_boundary";
          const body = [
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify(metadata),
            `--${boundary}`,
            `Content-Type: ${input.type === "doc" ? "text/plain" : "text/plain"}`,
            "",
            input.content,
            `--${boundary}--`,
          ].join("\r\n");

          const res = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
              },
              body,
            }
          );
          created = await res.json();
          if (!res.ok)
            throw new Error(
              created.error?.message || `Upload failed: ${res.status}`
            );
        } else {
          created = await driveFetch(
            config,
            "/files?fields=id,name,mimeType,webViewLink",
            "POST",
            metadata
          );
        }

        await convexClient.emitEvent(
          agentId,
          "gdrive.file_created",
          "gdrive_tools",
          {
            fileId: created.id,
            name: input.name,
            type: input.type,
            mimeType: created.mimeType,
            parentId: input.parent_id,
            webViewLink: created.webViewLink,
          }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Created ${input.type}: "${input.name}"\nID: ${created.id}${created.webViewLink ? `\nLink: ${created.webViewLink}` : ""}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create file: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Move / Rename File ──────────────────────────────────────────────
  const moveFile = tool(
    "gdrive_move_file",
    "Move a file to a different folder and/or rename it.",
    {
      file_id: z.string().describe("The file ID"),
      new_name: z.string().optional().describe("New file name"),
      new_parent_id: z
        .string()
        .optional()
        .describe("New parent folder ID to move to"),
    },
    async (input) => {
      try {
        const updates: any = {};
        if (input.new_name) updates.name = input.new_name;

        let url = `/files/${input.file_id}?fields=id,name,parents`;
        if (input.new_parent_id) {
          // Get current parents to remove
          const current = await driveFetch(
            config,
            `/files/${input.file_id}?fields=parents`
          );
          const removeParents = (current.parents ?? []).join(",");
          url += `&addParents=${input.new_parent_id}&removeParents=${removeParents}`;
        }

        const updated = await driveFetch(config, url, "PATCH", updates);

        return {
          content: [
            {
              type: "text" as const,
              text: `File updated: "${updated.name}" (ID: ${updated.id})`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to move/rename file: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // ── Delete File ─────────────────────────────────────────────────────
  const deleteFile = tool(
    "gdrive_delete_file",
    "Move a file to the trash in Google Drive.",
    {
      file_id: z.string().describe("The file ID to trash"),
    },
    async (input) => {
      try {
        await driveFetch(config, `/files/${input.file_id}`, "PATCH", {
          trashed: true,
        });

        await convexClient.emitEvent(
          agentId,
          "gdrive.file_deleted",
          "gdrive_tools",
          { fileId: input.file_id }
        );

        return {
          content: [
            { type: "text" as const, text: "File moved to trash." },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to delete file: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  return [searchFiles, listFiles, readFile, createFile, moveFile, deleteFile];
}
