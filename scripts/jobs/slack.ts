// ── Slack #jobs: post, thread, read Abdout's replies ─────────────────────────
//
// `hermes send` (notify.ts) stays the path for one-line alerts, but it does
// not hand back a message ts, and the weekly report needs one: the discussion
// lives in that message's thread. Same kun bot token Hermes uses, called
// directly — the mkan intake desk's pattern (mkan/scripts/crm/home-intake.ts).

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function envKey(key: string): string {
  if (process.env[key]) return process.env[key]!.trim();
  const line = readFileSync(join(homedir(), ".hermes/.env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  return (line?.split("=").slice(1).join("=") ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

/// The open weekly report thread (written by week.ts, read by discuss.ts).
export const WEEK_THREAD = "jobs/.state/week-thread.json";

/// Abdout's Slack user — the first id Hermes is allowed to hear.
export function abdoutUserId(): string {
  return envKey("SLACK_ALLOWED_USERS").split(",")[0].trim();
}

async function api<T>(
  method: string,
  body: Record<string, unknown>,
  get = false,
): Promise<T> {
  const token = envKey("SLACK_BOT_TOKEN");
  if (!token) throw new Error("no SLACK_BOT_TOKEN in env or ~/.hermes/.env");
  const url = `https://slack.com/api/${method}`;
  const res = get
    ? await fetch(
        `${url}?${new URLSearchParams(body as Record<string, string>)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
    : await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(body),
      });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(`slack ${method}: ${data.error}`);
  return data;
}

/// Post to a channel (or into a thread); returns the new message's ts.
export async function post(
  channel: string,
  text: string,
  threadTs?: string,
): Promise<string> {
  const r = await api<{ ts: string }>("chat.postMessage", {
    channel,
    text,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    unfurl_links: false,
    unfurl_media: false,
  });
  return r.ts;
}

export interface SlackMessage {
  ts: string;
  user?: string;
  bot_id?: string;
  subtype?: string; // channel_join, etc. — system events, not words
  text: string;
}

/// Replies in a thread newer than `afterTs` (the parent itself excluded).
export async function replies(
  channel: string,
  threadTs: string,
  afterTs = "0",
): Promise<SlackMessage[]> {
  const r = await api<{ messages: SlackMessage[] }>(
    "conversations.replies",
    { channel, ts: threadTs, oldest: afterTs, limit: "200" },
    true,
  );
  return r.messages.filter((m) => m.ts !== threadTs && m.ts > afterTs);
}

/// Top-level channel messages newer than `afterTs`.
export async function history(
  channel: string,
  afterTs = "0",
): Promise<SlackMessage[]> {
  const r = await api<{ messages: SlackMessage[] }>(
    "conversations.history",
    { channel, oldest: afterTs, limit: "100" },
    true,
  );
  return r.messages.filter((m) => m.ts > afterTs);
}

/// Slack mrkdwn escapes → the words as typed.
export function plain(t: string): string {
  return t
    .replace(/<(https?:[^|>]+)(?:\|[^>]*)?>/g, "$1")
    .replace(/<@[A-Z0-9]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
