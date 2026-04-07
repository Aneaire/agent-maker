"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { encrypt, decrypt } from "../src/crypto";
import { getCredentialTypeDef } from "../src/credential-types";

// ── User-facing actions (need Node crypto) ────────────────────────────

export const create = action({
  args: {
    name: v.string(),
    type: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { encrypted, iv } = encrypt(JSON.stringify(args.data));
    const now = Date.now();

    return await ctx.runMutation(internal.credentials._insert, {
      name: args.name,
      type: args.type,
      encryptedData: encrypted,
      iv,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = action({
  args: {
    credentialId: v.id("credentials"),
    name: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;

    if (args.data !== undefined) {
      const { encrypted, iv } = encrypt(JSON.stringify(args.data));
      patch.encryptedData = encrypted;
      patch.iv = iv;
      patch.status = "untested";
    }

    await ctx.runMutation(internal.credentials._update, {
      credentialId: args.credentialId,
      patch,
    });
  },
});

export const test = action({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, args) => {
    const cred = await ctx.runQuery(internal.credentials._get, {
      credentialId: args.credentialId,
    });
    if (!cred) throw new Error("Credential not found");

    const typeDef = getCredentialTypeDef(cred.type);
    if (!typeDef) throw new Error(`Unknown credential type: ${cred.type}`);

    const data = JSON.parse(decrypt(cred.encryptedData, cred.iv));

    // For OAuth2 credentials, refresh the access token before testing
    // so the test doesn't fail just because the stored token expired
    if (typeDef.authMethod === "oauth2") {
      const hasRefreshToken = !!data.refreshToken;
      const hasClientId = !!data.clientId;
      const hasClientSecret = !!data.clientSecret;
      console.log("[credential test] OAuth2 fields:", { hasRefreshToken, hasClientId, hasClientSecret, keys: Object.keys(data) });

      if (hasRefreshToken && hasClientId && hasClientSecret) {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: data.clientId,
            client_secret: data.clientSecret,
            refresh_token: data.refreshToken,
            grant_type: "refresh_token",
          }),
          signal: AbortSignal.timeout(10000),
        });
        const tokenData = await tokenRes.json();
        console.log("[credential test] Token refresh status:", tokenRes.status, tokenData.error ?? "ok");
        if (tokenRes.ok && tokenData.access_token) {
          data.accessToken = tokenData.access_token;
        } else {
          return { valid: false, error: `Token refresh failed: ${tokenData.error_description ?? tokenData.error ?? tokenRes.status}` };
        }
      } else {
        return { valid: false, error: `Missing OAuth fields: refreshToken=${hasRefreshToken} clientId=${hasClientId} clientSecret=${hasClientSecret}` };
      }
    }

    let url = typeDef.test.url;
    const headers: Record<string, string> = {};

    const interpolate = (str: string) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");

    url = interpolate(url);
    if (typeDef.test.headers) {
      for (const [k, val] of Object.entries(typeDef.test.headers)) {
        headers[k] = interpolate(val);
      }
    }

    try {
      const resp = await fetch(url, {
        method: typeDef.test.method,
        headers,
        signal: AbortSignal.timeout(10000),
      });

      const expectedStatus = typeDef.test.expectedStatus ?? 200;
      const isValid = resp.status === expectedStatus;

      if (cred.type === "slack" && isValid) {
        try {
          const body = await resp.json();
          if (body.ok === false) {
            await ctx.runMutation(internal.credentials._update, {
              credentialId: args.credentialId,
              patch: {
                status: "invalid" as const,
                lastTestedAt: Date.now(),
                updatedAt: Date.now(),
              },
            });
            return { valid: false, error: body.error ?? "Slack API returned ok: false" };
          }
        } catch {
          // ok based on status
        }
      }

      await ctx.runMutation(internal.credentials._update, {
        credentialId: args.credentialId,
        patch: {
          status: isValid ? ("valid" as const) : ("invalid" as const),
          lastTestedAt: Date.now(),
          updatedAt: Date.now(),
        },
      });

      return {
        valid: isValid,
        error: isValid ? undefined : `Expected status ${expectedStatus}, got ${resp.status}`,
      };
    } catch (err: any) {
      await ctx.runMutation(internal.credentials._update, {
        credentialId: args.credentialId,
        patch: {
          status: "invalid" as const,
          lastTestedAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
      return { valid: false, error: err.message };
    }
  },
});

// ── Internal: peek slack credential keys for diagnostic purposes ──────

import { internalAction } from "./_generated/server";

export const _peekSlackCredentialKeys = internalAction({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args): Promise<string[] | null> => {
    const link: any = await ctx.runQuery(internal.credentials._getLinkByAgentToolset, {
      agentId: args.agentId,
      toolSetName: "slack",
    });
    if (!link) return null;
    const cred: any = await ctx.runQuery(internal.credentials._get, {
      credentialId: link.credentialId,
    });
    if (!cred) return null;
    try {
      const data = JSON.parse(decrypt(cred.encryptedData, cred.iv));
      return Object.keys(data).filter((k) => data[k]);
    } catch {
      return null;
    }
  },
});

// ── User-facing decrypt (for editing in the UI) ───────────────────────

export const getDecryptedForUser = action({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, args): Promise<any> => {
    const cred: any = await ctx.runQuery(internal.credentials._getForOwner, {
      credentialId: args.credentialId,
    });
    try {
      return JSON.parse(decrypt(cred.encryptedData, cred.iv));
    } catch {
      throw new Error("Failed to decrypt credential");
    }
  },
});

// ── Server-facing decrypt (agent runtime) ─────────────────────────────

export const getDecryptedForAgent = action({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    toolSetName: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const expected = process.env.AGENT_SERVER_TOKEN;
    if (!expected || args.serverToken !== expected) {
      throw new Error("Invalid server token");
    }

    const link: any = await ctx.runQuery(internal.credentials._getLinkByAgentToolset, {
      agentId: args.agentId,
      toolSetName: args.toolSetName,
    });
    if (!link) return null;

    // Fetch agent and credential in parallel
    const [agent, cred]: [any, any] = await Promise.all([
      ctx.runQuery(internal.agents._get, { agentId: args.agentId }),
      ctx.runQuery(internal.credentials._get, { credentialId: link.credentialId }),
    ]);

    if (!agent || !cred) return null;

    // Verify the credential belongs to the same user as the agent
    if (agent.userId !== cred.userId) return null;

    try {
      return JSON.parse(decrypt(cred.encryptedData, cred.iv));
    } catch {
      return null;
    }
  },
});

// ── OAuth2 start ──────────────────────────────────────────────────────

export const startOAuth = action({
  args: {
    provider: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const typeDef = getCredentialTypeDef(args.provider);
    if (!typeDef?.oauth2) throw new Error(`Provider ${args.provider} does not support OAuth2`);

    const { randomBytes } = await import("crypto");
    const state = randomBytes(32).toString("hex");
    const now = Date.now();

    await ctx.runMutation(internal.credentials._insertOAuthState, {
      state,
      provider: args.provider,
      scopes: args.scopes,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
    });

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const serverUrl = process.env.AGENT_SERVER_PUBLIC_URL;
    if (!clientId || !serverUrl) {
      throw new Error("Google OAuth not configured (missing GOOGLE_OAUTH_CLIENT_ID or AGENT_SERVER_PUBLIC_URL)");
    }

    const redirectUri = `${serverUrl}/oauth/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: args.scopes.join(" "),
      state,
      ...(typeDef.oauth2.extraParams ?? {}),
    });

    return { authUrl: `${typeDef.oauth2.authUrl}?${params.toString()}` };
  },
});

// ── Migration from legacy agentToolConfigs ────────────────────────────

const LEGACY_TOOL_SET_TO_CRED_TYPE: Record<string, string> = {
  email: "resend",
  slack: "slack",
  notion: "notion",
  google_calendar: "google_oauth2",
  google_drive: "google_oauth2",
  google_sheets: "google_oauth2",
  gmail: "google_oauth2",
};

function legacyDedupeKey(toolSetName: string, config: any): string {
  const credType = LEGACY_TOOL_SET_TO_CRED_TYPE[toolSetName] ?? toolSetName;
  if (credType === "google_oauth2") {
    return `google_oauth2:${config.clientId ?? ""}:${config.refreshToken ?? ""}`;
  }
  if (credType === "resend") return `resend:${config.resendApiKey ?? ""}`;
  if (credType === "slack") return `slack:${config.botToken ?? ""}`;
  if (credType === "notion") return `notion:${config.apiKey ?? ""}`;
  return `${credType}:${JSON.stringify(config)}`;
}

export const migrateFromLegacy = action({
  args: {},
  handler: async (ctx): Promise<{ migrated: number; linked: number; skipped: number }> => {
    const legacyConfigs: any[] = await ctx.runQuery(
      internal.credentials._listLegacyConfigs, {}
    );

    if (!legacyConfigs || legacyConfigs.length === 0) {
      return { migrated: 0, linked: 0, skipped: 0 };
    }

    const toolConfigsNeedingMigration = [
      "email", "slack", "notion",
      "google_calendar", "google_drive", "google_sheets",
    ];

    const deduped = new Map<string, { encrypted: string; iv: string; name: string; type: string }>();
    const linksToCreate: Array<{ agentId: string; toolSetName: string; dedupeKey: string }> = [];
    let skipped = 0;

    for (const item of legacyConfigs) {
      if (!toolConfigsNeedingMigration.includes(item.toolSetName)) { skipped++; continue; }
      if (!item.config || Object.keys(item.config).length === 0) { skipped++; continue; }

      const credType = LEGACY_TOOL_SET_TO_CRED_TYPE[item.toolSetName];
      if (!credType) { skipped++; continue; }

      const dedupeKey = legacyDedupeKey(item.toolSetName, item.config);

      if (!deduped.has(dedupeKey)) {
        const { encrypted, iv } = encrypt(JSON.stringify(item.config));
        const name = credType === "google_oauth2"
          ? `Google (migrated)`
          : `${credType} (migrated)`;
        deduped.set(dedupeKey, { encrypted, iv, name, type: credType });
      }

      linksToCreate.push({
        agentId: item.agentId,
        toolSetName: item.toolSetName,
        dedupeKey,
      });
    }

    const credEntries = Array.from(deduped.entries()).map(([key, val]) => ({
      dedupeKey: key, ...val,
    }));

    const result = await ctx.runMutation(internal.credentials._writeMigratedCredentials, {
      credentials: credEntries,
      links: linksToCreate,
    });

    return result;
  },
});
