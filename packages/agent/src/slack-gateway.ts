/**
 * Slack Socket Mode WebSocket client.
 * Calls apps.connections.open with the app-level token (xapp-) to get a one-shot
 * wss:// URL, opens the WebSocket, ACKs every envelope, and parses app_mention
 * and message.im events into a unified SlackInboundEvent.
 *
 * No external dependencies — uses the global WebSocket available in Bun/Node 21+.
 */

const SLACK_API = "https://slack.com/api";

export interface SlackInboundEvent {
  teamId: string;
  channelId: string;
  channelType: "channel" | "im";
  userId: string;
  text: string;
  ts: string;
  threadTs?: string;
  isDm: boolean;
}

type GatewayStatus = "connected" | "disconnected" | "connecting";

export interface SlackGatewayCallbacks {
  onMessage: (event: SlackInboundEvent) => void;
  onReady?: (botUserId: string) => void;
  onStateChange?: (status: GatewayStatus) => void;
}

export class SlackGateway {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private destroyed = false;
  private botUserId: string | null = null;

  constructor(
    private appToken: string, // xapp-…
    private botToken: string, // xoxb-… (used to look up bot user id once)
    private callbacks: SlackGatewayCallbacks
  ) {}

  async connect() {
    if (this.destroyed) return;
    this.callbacks.onStateChange?.("connecting");

    // Look up the bot's user ID via auth.test (once per connect; cheap and lets us
    // strip self-mentions and ignore our own messages).
    if (!this.botUserId) {
      try {
        const auth = await this.slackPost("auth.test", this.botToken);
        this.botUserId = auth.user_id ?? null;
        if (this.botUserId) this.callbacks.onReady?.(this.botUserId);
      } catch (err: any) {
        console.error("[slack-gateway] auth.test failed:", err.message);
      }
    }

    // Open a Socket Mode connection.
    let wsUrl: string;
    try {
      const open = await this.slackPost("apps.connections.open", this.appToken);
      wsUrl = open.url;
    } catch (err: any) {
      console.error("[slack-gateway] apps.connections.open failed:", err.message);
      this.scheduleReconnect();
      return;
    }

    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", (ev: MessageEvent) => {
      this.handleMessage(typeof ev.data === "string" ? ev.data : String(ev.data));
    });
    this.ws.addEventListener("close", () => {
      this.callbacks.onStateChange?.("disconnected");
      if (!this.destroyed) this.scheduleReconnect();
    });
    this.ws.addEventListener("error", () => {
      console.error("[slack-gateway] WebSocket error");
    });
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, "destroyed");
    this.ws = null;
  }

  get currentBotUserId() {
    return this.botUserId;
  }

  private async slackPost(method: string, token: string): Promise<any> {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "slack api error");
    return data;
  }

  private scheduleReconnect() {
    const delay = Math.min(this.reconnectDelay, 30000);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    console.log(`[slack-gateway] Reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleMessage(raw: string) {
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    const type = payload.type;

    if (type === "hello") {
      this.reconnectDelay = 1000;
      this.callbacks.onStateChange?.("connected");
      console.log(`[slack-gateway] connected${this.botUserId ? ` as ${this.botUserId}` : ""}`);
      return;
    }

    if (type === "disconnect") {
      // Slack asks us to gracefully reconnect — close so onclose triggers reconnect
      console.log(`[slack-gateway] server requested disconnect (${payload.reason})`);
      this.ws?.close(1000, "server disconnect");
      return;
    }

    // Every other envelope must be ACK'd by echoing its envelope_id
    if (payload.envelope_id) {
      this.send({ envelope_id: payload.envelope_id });
    }

    if (type === "events_api") {
      const event = payload.payload?.event;
      const teamId = payload.payload?.team_id ?? "";
      if (event) this.handleEvent(teamId, event);
    }
  }

  private handleEvent(teamId: string, event: any) {
    // Filter our own messages and other bots
    if (event.bot_id) return;
    if (this.botUserId && event.user === this.botUserId) return;

    let inbound: SlackInboundEvent | null = null;

    if (event.type === "app_mention") {
      inbound = {
        teamId,
        channelId: event.channel,
        channelType: "channel",
        userId: event.user,
        text: this.stripBotMention(event.text ?? ""),
        ts: event.ts,
        threadTs: event.thread_ts,
        isDm: false,
      };
    } else if (event.type === "message" && event.channel_type === "im") {
      // Skip subtype edits / bot replies / hidden envelopes
      if (event.subtype) return;
      inbound = {
        teamId,
        channelId: event.channel,
        channelType: "im",
        userId: event.user,
        text: event.text ?? "",
        ts: event.ts,
        threadTs: event.thread_ts,
        isDm: true,
      };
    }

    if (inbound && inbound.text.trim()) {
      this.callbacks.onMessage(inbound);
    }
  }

  private stripBotMention(text: string): string {
    if (!this.botUserId) return text.trim();
    return text.replace(new RegExp(`<@${this.botUserId}>`, "g"), "").trim();
  }
}
