/**
 * Sends the completed agent response back to Slack via chat.postMessage.
 * Slack messages can be up to ~40k chars but practically we split at ~3k for readability.
 */

const SLACK_API = "https://slack.com/api";
const MAX_MESSAGE_LENGTH = 3000;

function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_MESSAGE_LENGTH) {
    const slice = remaining.slice(0, MAX_MESSAGE_LENGTH);
    const paraBreak = slice.lastIndexOf("\n\n");
    const lineBreak = slice.lastIndexOf("\n");
    const sentBreak = slice.lastIndexOf(". ");
    let splitAt: number;
    if (paraBreak > MAX_MESSAGE_LENGTH * 0.5) splitAt = paraBreak + 2;
    else if (lineBreak > MAX_MESSAGE_LENGTH * 0.5) splitAt = lineBreak + 1;
    else if (sentBreak > MAX_MESSAGE_LENGTH * 0.5) splitAt = sentBreak + 2;
    else splitAt = MAX_MESSAGE_LENGTH;
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export async function sendSlackReply(
  botToken: string,
  channelId: string,
  content: string,
  threadTs?: string
): Promise<void> {
  const chunks = splitMessage(content.trim());
  for (const chunk of chunks) {
    const resp = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        text: chunk,
        ...(threadTs && { thread_ts: threadTs }),
      }),
    });
    if (!resp.ok) {
      console.error(
        `[slack-response] Failed to send to ${channelId}: ${resp.status} ${await resp.text()}`
      );
    } else {
      const data = await resp.json();
      if (!data.ok) {
        console.error(`[slack-response] Slack API error: ${data.error}`);
      }
    }
  }
}
