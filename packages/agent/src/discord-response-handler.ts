/**
 * Sends the completed agent response back to Discord.
 * Called by server.ts onComplete when the conversation has a Discord source.
 */

const DISCORD_API = "https://discord.com/api/v10";
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Split a long response into ≤2000-char chunks, preferring paragraph breaks,
 * then sentence breaks, then hard splits.
 */
function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_MESSAGE_LENGTH) {
    // Try to split on a paragraph break
    const slice = remaining.slice(0, MAX_MESSAGE_LENGTH);
    const paraBreak = slice.lastIndexOf("\n\n");
    const lineBreak = slice.lastIndexOf("\n");
    const sentBreak = slice.lastIndexOf(". ");

    let splitAt: number;
    if (paraBreak > MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = paraBreak + 2;
    } else if (lineBreak > MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = lineBreak + 1;
    } else if (sentBreak > MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = sentBreak + 2;
    } else {
      splitAt = MAX_MESSAGE_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export async function sendDiscordReply(
  botToken: string,
  channelId: string,
  content: string
): Promise<void> {
  const chunks = splitMessage(content.trim());

  for (const chunk of chunks) {
    const resp = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: chunk }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[discord-response] Failed to send message to ${channelId}: ${resp.status} ${err}`);
      // Don't throw — a partial send is better than crashing
    }
  }
}

export async function sendDiscordTyping(
  botToken: string,
  channelId: string
): Promise<void> {
  await fetch(`${DISCORD_API}/channels/${channelId}/typing`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}` },
  }).catch(() => {
    // Typing indicator failure is non-critical
  });
}
