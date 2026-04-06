/**
 * Discord Gateway v10 WebSocket client.
 * Handles heartbeat, identify, resume, and MESSAGE_CREATE filtering for @mentions.
 * No external dependencies — uses the global WebSocket available in Bun/Node 21+.
 */

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
// GUILD_MESSAGES (1 << 9 = 512) | MESSAGE_CONTENT (1 << 15 = 32768)
const INTENTS = 33280;

export interface MentionEvent {
  guildId: string;
  channelId: string;
  content: string;
  author: { id: string; username: string };
  messageId: string;
}

type GatewayStatus = "connected" | "disconnected" | "connecting";

export interface DiscordGatewayCallbacks {
  onMention: (event: MentionEvent) => void;
  onReady?: (botUserId: string) => void;
  onStateChange?: (status: GatewayStatus, sessionId?: string, resumeUrl?: string, seq?: number) => void;
}

export class DiscordGateway {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private resumeGatewayUrl: string | null = null;
  private botUserId: string | null = null;
  private reconnectDelay = 1000;
  private destroyed = false;

  constructor(
    private botToken: string,
    private callbacks: DiscordGatewayCallbacks
  ) {}

  connect() {
    if (this.destroyed) return;
    this.callbacks.onStateChange?.("connecting");
    const url = this.resumeGatewayUrl ?? GATEWAY_URL;
    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (ev: MessageEvent) => {
      this.handleMessage(typeof ev.data === "string" ? ev.data : String(ev.data));
    });
    this.ws.addEventListener("close", (ev: CloseEvent) => {
      this.handleClose(ev.code);
    });
    this.ws.addEventListener("error", () => {
      // Error events precede close; just log
      console.error("[discord-gateway] WebSocket error");
    });
  }

  destroy() {
    this.destroyed = true;
    this.clearHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, "destroyed");
    this.ws = null;
  }

  get currentBotUserId() { return this.botUserId; }
  get currentSessionId() { return this.sessionId; }
  get currentResumeUrl() { return this.resumeGatewayUrl; }
  get currentSequence() { return this.sequence; }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startHeartbeat(intervalMs: number) {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ op: 1, d: this.sequence });
    }, intervalMs);
  }

  private handleClose(code: number) {
    this.clearHeartbeat();
    this.callbacks.onStateChange?.("disconnected");
    if (this.destroyed) return;

    // Non-resumable close codes — clear session
    const noResume = [4004, 4010, 4011, 4012, 4013, 4014];
    if (noResume.includes(code)) {
      console.warn(`[discord-gateway] Non-resumable close ${code} — clearing session`);
      this.sessionId = null;
      this.resumeGatewayUrl = null;
    }

    const delay = Math.min(this.reconnectDelay, 30000);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    console.log(`[discord-gateway] Reconnecting in ${delay}ms (code ${code})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private handleMessage(raw: string) {
    let payload: any;
    try { payload = JSON.parse(raw); } catch { return; }

    const { op, d, s, t } = payload;
    if (s != null) this.sequence = s;

    switch (op) {
      case 10: // Hello — start heartbeat then identify or resume
        this.startHeartbeat(d.heartbeat_interval);
        if (this.sessionId && this.resumeGatewayUrl) {
          this.send({
            op: 6,
            d: { token: this.botToken, session_id: this.sessionId, seq: this.sequence },
          });
        } else {
          this.send({
            op: 2,
            d: {
              token: this.botToken,
              intents: INTENTS,
              properties: { os: "linux", browser: "agent-maker", device: "agent-maker" },
            },
          });
        }
        break;

      case 11: // Heartbeat ACK — reset reconnect backoff
        this.reconnectDelay = 1000;
        break;

      case 1: // Server requests heartbeat immediately
        this.send({ op: 1, d: this.sequence });
        break;

      case 7: // Reconnect
        this.ws?.close(4000, "server requested reconnect");
        break;

      case 9: // Invalid session — start fresh after random delay
        this.sessionId = null;
        this.resumeGatewayUrl = null;
        setTimeout(() => this.connect(), 2000 + Math.random() * 3000);
        break;

      case 0: // Dispatch
        this.handleDispatch(t, d);
        break;
    }
  }

  private handleDispatch(t: string, d: any) {
    if (t === "READY") {
      this.botUserId = d.user.id;
      this.sessionId = d.session_id;
      this.resumeGatewayUrl = d.resume_gateway_url;
      this.reconnectDelay = 1000;
      console.log(`[discord-gateway] Ready as ${d.user.username}#${d.user.discriminator} (${d.user.id})`);
      this.callbacks.onStateChange?.("connected", this.sessionId!, this.resumeGatewayUrl!, this.sequence ?? undefined);
      this.callbacks.onReady?.(d.user.id);
    }

    if (t === "RESUMED") {
      console.log("[discord-gateway] Session resumed");
      this.callbacks.onStateChange?.("connected", this.sessionId!, this.resumeGatewayUrl!, this.sequence ?? undefined);
    }

    if (t === "MESSAGE_CREATE") {
      this.handleMessageCreate(d);
    }
  }

  private handleMessageCreate(msg: any) {
    if (msg.author?.bot) return;
    if (!this.botUserId) return;

    const mentions: any[] = msg.mentions ?? [];
    const mentioned = mentions.some((u: any) => u.id === this.botUserId);
    if (!mentioned) return;

    // Strip all @BOT mentions from the content
    const content = (msg.content ?? "")
      .replace(new RegExp(`<@!?${this.botUserId}>`, "g"), "")
      .trim();

    this.callbacks.onMention({
      guildId: msg.guild_id ?? "",
      channelId: msg.channel_id,
      content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
      },
      messageId: msg.id,
    });
  }
}
