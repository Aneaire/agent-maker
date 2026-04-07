/**
 * Manages per-agent Slack Socket Mode connections.
 * Mirrors discord-gateway-manager.ts.
 */

import { AgentConvexClient } from "./convex-client.js";
import { SlackGateway, type SlackInboundEvent } from "./slack-gateway.js";
import { sendSlackReply } from "./slack-response-handler.js";

interface GatewayEntry {
  gateway: SlackGateway;
  botToken: string;
}

export class SlackGatewayManager {
  private gateways = new Map<string, GatewayEntry>();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private convexClient: AgentConvexClient;

  constructor(convexUrl: string, serverToken: string) {
    this.convexClient = new AgentConvexClient(convexUrl, serverToken);
  }

  async initialize() {
    console.log("[slack-gateway-manager] Initializing...");
    await this.syncAll();
    this.syncTimer = setInterval(() => {
      this.syncAll().catch((err) =>
        console.error("[slack-gateway-manager] syncAll error:", err.message)
      );
    }, 60_000);
  }

  async syncAll() {
    let agents: any[];
    try {
      agents = (await this.convexClient.listSlackEnabledAgents()) ?? [];
    } catch (err: any) {
      console.error("[slack-gateway-manager] Failed to list agents:", err.message);
      return;
    }

    const enabledIds = new Set(agents.map((a) => a._id as string));

    for (const [agentId, entry] of this.gateways) {
      if (!enabledIds.has(agentId)) {
        console.log(`[slack-gateway-manager] Stopping gateway for agent ${agentId}`);
        entry.gateway.destroy();
        this.gateways.delete(agentId);
        this.convexClient
          .updateSlackGatewayState(agentId, { status: "disconnected" })
          .catch(() => {});
      }
    }

    for (const agent of agents) {
      const agentId = agent._id as string;
      if (this.gateways.has(agentId)) continue;

      try {
        const creds = await this.convexClient.getCredentialForToolSet(agentId, "slack");
        const botToken = creds?.botToken;
        const appToken = creds?.appToken;
        if (!botToken || !appToken) {
          console.warn(
            `[slack-gateway-manager] Agent ${agentId} missing slack ${botToken ? "appToken" : "botToken"} — skipping`
          );
          continue;
        }
        this.startGateway(agentId, botToken, appToken, agent);
      } catch (err: any) {
        console.error(
          `[slack-gateway-manager] Error starting gateway for ${agentId}:`,
          err.message
        );
      }
    }
  }

  async restartGateway(agentId: string) {
    const existing = this.gateways.get(agentId);
    if (existing) {
      existing.gateway.destroy();
      this.gateways.delete(agentId);
    }

    const agents = (await this.convexClient.listSlackEnabledAgents().catch(() => [])) ?? [];
    const agent = agents.find((a: any) => a._id === agentId);
    if (!agent) return;

    const creds = await this.convexClient.getCredentialForToolSet(agentId, "slack").catch(() => null);
    const botToken = creds?.botToken;
    const appToken = creds?.appToken;
    if (!botToken || !appToken) return;

    this.startGateway(agentId, botToken, appToken, agent);
  }

  private startGateway(agentId: string, botToken: string, appToken: string, agent: any) {
    console.log(`[slack-gateway-manager] Starting gateway for agent ${agentId} (${agent.name})`);

    const gateway = new SlackGateway(appToken, botToken, {
      onMessage: (event) => this.handleEvent(agentId, botToken, event),
      onReady: (botUserId) => {
        this.convexClient
          .updateSlackGatewayState(agentId, { status: "connected", botUserId })
          .catch(() => {});
      },
      onStateChange: (status) => {
        this.convexClient
          .updateSlackGatewayState(agentId, { status })
          .catch(() => {});
      },
    });

    this.gateways.set(agentId, { gateway, botToken });
    gateway.connect();
  }

  private async handleEvent(agentId: string, botToken: string, event: SlackInboundEvent) {
    const { teamId, channelId, channelType, userId, text, threadTs } = event;
    console.log(
      `[slack-gateway-manager] ${channelType === "im" ? "DM" : "@mention"} in ${channelId} from ${userId}: "${text.slice(0, 80)}"`
    );

    if (!text) return;

    try {
      const freshAgent = await this.convexClient.getAgent(agentId);
      const authorized: string[] = ((freshAgent as any)?.slackAuthorizedUsers ?? []) as string[];
      const mode: "agent" | "bot" = authorized.includes(userId) ? "agent" : "bot";

      const conversationId = await this.convexClient.getOrCreateSlackConversation(
        agentId,
        teamId,
        channelId,
        channelType,
        mode,
        userId
      );

      // Emit inbound event for automations
      const inboundEventName = channelType === "im" ? "slack.dm_received" : "slack.mention_received";
      this.convexClient
        .emitEvent(agentId, inboundEventName, "slack_gateway", {
          channel: channelId,
          userId,
          text,
          mode,
        })
        .catch(() => {});

      const { assistantMessageId } = await this.convexClient.createSlackJob(
        agentId,
        conversationId as string,
        text
      );

      // Reply in the same thread if the inbound was a thread message; otherwise top-level
      this.waitAndRespond(botToken, channelId, assistantMessageId as string, threadTs);
    } catch (err: any) {
      console.error("[slack-gateway-manager] handleEvent error:", err.message);
      await sendSlackReply(botToken, channelId, "⚠️ Something went wrong. Please try again.", threadTs).catch(
        () => {}
      );
    }
  }

  private waitAndRespond(
    botToken: string,
    channelId: string,
    assistantMessageId: string,
    threadTs?: string,
    maxWaitMs = 120_000
  ) {
    const pollInterval = 2500;
    const startTime = Date.now();

    const poll = async (): Promise<void> => {
      if (Date.now() - startTime > maxWaitMs) {
        await sendSlackReply(botToken, channelId, "⏱️ Request timed out.", threadTs).catch(() => {});
        return;
      }

      try {
        const msg = await this.convexClient.getMessageStatus(assistantMessageId);

        if (!msg || msg.status === "pending" || msg.status === "processing") {
          setTimeout(poll, pollInterval);
          return;
        }

        if (msg.status === "error") {
          await sendSlackReply(botToken, channelId, `❌ ${msg.error ?? "An error occurred."}`, threadTs).catch(
            () => {}
          );
          return;
        }

        if (msg.content) {
          await sendSlackReply(botToken, channelId, msg.content, threadTs);
        }
      } catch (err: any) {
        console.error("[slack-gateway-manager] poll error:", err.message);
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
