/**
 * Manages per-agent Discord Gateway WebSocket connections.
 * On startup, queries Convex for all Discord-bot-enabled agents, fetches their
 * bot tokens via the credential system, and opens a gateway connection for each.
 * Syncs periodically and on-demand (via syncAll()).
 */

import { AgentConvexClient } from "./convex-client.js";
import { DiscordGateway, type MentionEvent } from "./discord-gateway.js";
import { sendDiscordReply, sendDiscordTyping } from "./discord-response-handler.js";

interface GatewayEntry {
  gateway: DiscordGateway;
  botToken: string;
}

export class DiscordGatewayManager {
  private gateways = new Map<string, GatewayEntry>();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private convexClient: AgentConvexClient;

  constructor(convexUrl: string, serverToken: string) {
    this.convexClient = new AgentConvexClient(convexUrl, serverToken);
  }

  /** Initialize: connect all currently enabled agents */
  async initialize() {
    console.log("[discord-gateway-manager] Initializing...");
    await this.syncAll();

    // Re-sync every 60 seconds to pick up config changes
    this.syncTimer = setInterval(() => {
      this.syncAll().catch((err) =>
        console.error("[discord-gateway-manager] syncAll error:", err.message)
      );
    }, 60_000);
  }

  /** Re-sync enabled agents: start new connections, stop removed ones */
  async syncAll() {
    let agents: any[];
    try {
      agents = (await this.convexClient.listDiscordEnabledAgents()) ?? [];
    } catch (err: any) {
      console.error("[discord-gateway-manager] Failed to list agents:", err.message);
      return;
    }

    const enabledIds = new Set(agents.map((a) => a._id as string));

    // Stop gateways for agents that are no longer enabled
    for (const [agentId, entry] of this.gateways) {
      if (!enabledIds.has(agentId)) {
        console.log(`[discord-gateway-manager] Stopping gateway for agent ${agentId}`);
        entry.gateway.destroy();
        this.gateways.delete(agentId);
        this.convexClient
          .updateDiscordGatewayState(agentId, { status: "disconnected" })
          .catch(() => {});
      }
    }

    // Start gateways for newly enabled agents
    for (const agent of agents) {
      const agentId = agent._id as string;
      if (this.gateways.has(agentId)) continue; // already connected

      try {
        const creds = await this.convexClient.getCredentialForToolSet(agentId, "discord");
        const botToken = creds?.botToken;
        if (!botToken) {
          console.warn(`[discord-gateway-manager] No Discord bot token for agent ${agentId} — skipping`);
          continue;
        }

        this.startGateway(agentId, botToken, agent);
      } catch (err: any) {
        console.error(`[discord-gateway-manager] Error starting gateway for ${agentId}:`, err.message);
      }
    }
  }

  /** Restart a specific agent's gateway (used when config changes) */
  async restartGateway(agentId: string) {
    const existing = this.gateways.get(agentId);
    if (existing) {
      existing.gateway.destroy();
      this.gateways.delete(agentId);
    }

    let agents: any[];
    try {
      agents = (await this.convexClient.listDiscordEnabledAgents()) ?? [];
    } catch {
      return;
    }

    const agent = agents.find((a) => a._id === agentId);
    if (!agent) return; // no longer enabled

    const creds = await this.convexClient.getCredentialForToolSet(agentId, "discord").catch(() => null);
    const botToken = creds?.botToken;
    if (!botToken) return;

    this.startGateway(agentId, botToken, agent);
  }

  private startGateway(agentId: string, botToken: string, agent: any) {
    console.log(`[discord-gateway-manager] Starting gateway for agent ${agentId} (${agent.name})`);

    const gateway = new DiscordGateway(botToken, {
      onMention: (event) => this.handleMention(agentId, botToken, agent, event),
      onReady: (botUserId) => {
        this.convexClient
          .updateDiscordGatewayState(agentId, { status: "connected", botUserId })
          .catch(() => {});
      },
      onStateChange: (status, sessionId, resumeUrl, seq) => {
        this.convexClient
          .updateDiscordGatewayState(agentId, {
            status,
            sessionId,
            resumeGatewayUrl: resumeUrl,
            lastSequence: seq,
          })
          .catch(() => {});
      },
    });

    this.gateways.set(agentId, { gateway, botToken });
    gateway.connect();
  }

  private async handleMention(
    agentId: string,
    botToken: string,
    agentConfig: any,
    event: MentionEvent
  ) {
    const { guildId, channelId, content, author } = event;
    console.log(
      `[discord-gateway-manager] @mention in ${channelId} from ${author.username}: "${content.slice(0, 80)}"`
    );

    if (!content) return;

    try {
      // Determine mode: authorized users get full agent, everyone else gets bot prompt
      const authorizedUsers: string[] = agentConfig.discordAuthorizedUsers ?? [];
      const mode: "agent" | "bot" = authorizedUsers.includes(author.username) ? "agent" : "bot";

      // Get or create a persistent conversation for this channel
      const conversationId = await this.convexClient.getOrCreateDiscordConversation(
        agentId,
        channelId,
        guildId,
        mode
      );

      // Show typing indicator while processing
      await sendDiscordTyping(botToken, channelId).catch(() => {});

      // Create job — existing pipeline picks it up
      const { assistantMessageId } = await this.convexClient.createDiscordJob(
        agentId,
        conversationId as string,
        content
      );

      // Poll for completion, then send the reply
      this.waitAndRespond(botToken, channelId, assistantMessageId as string);
    } catch (err: any) {
      console.error(`[discord-gateway-manager] handleMention error:`, err.message);
      await sendDiscordReply(botToken, channelId, "⚠️ Something went wrong. Please try again.").catch(() => {});
    }
  }

  /** Poll until the assistant message is done, then send it to Discord */
  private waitAndRespond(
    botToken: string,
    channelId: string,
    assistantMessageId: string,
    maxWaitMs = 120_000
  ) {
    const pollInterval = 2500;
    const startTime = Date.now();

    const poll = async (): Promise<void> => {
      if (Date.now() - startTime > maxWaitMs) {
        await sendDiscordReply(botToken, channelId, "⏱️ Request timed out.").catch(() => {});
        return;
      }

      try {
        const msg = await this.convexClient.getMessageStatus(assistantMessageId);

        if (!msg || msg.status === "pending" || msg.status === "processing") {
          // Still running — show typing and poll again
          await sendDiscordTyping(botToken, channelId).catch(() => {});
          setTimeout(poll, pollInterval);
          return;
        }

        if (msg.status === "error") {
          await sendDiscordReply(
            botToken,
            channelId,
            `❌ ${msg.error ?? "An error occurred."}`
          ).catch(() => {});
          return;
        }

        // Done — send the response
        if (msg.content) {
          await sendDiscordReply(botToken, channelId, msg.content);
        }
      } catch (err: any) {
        console.error("[discord-gateway-manager] poll error:", err.message);
        setTimeout(poll, pollInterval * 2);
      }
    };

    setTimeout(poll, pollInterval);
  }

  destroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    for (const { gateway } of this.gateways.values()) {
      gateway.destroy();
    }
    this.gateways.clear();
  }
}
