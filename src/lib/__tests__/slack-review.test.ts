import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The review lane is the one destination that must work unattended: it carries
// the approval notice and the token alarm. These tests pin the two properties
// that actually failed in production on 2026-08-23 — a lane that reports itself
// alertable when it is not, and a lane with no destination that fails silently.

const ENV_KEYS = [
  "SLACK_WEBHOOK_URL",
  "HERMES_API_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_REVIEW_CHAT_ID",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

describe("slack transport", () => {
  it("reports not-configured rather than pretending to send", async () => {
    const { isSlackConfigured, sendSlackMessage } = await import("../slack");
    expect(isSlackConfigured()).toBe(false);

    const res = await sendSlackMessage("hello");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/SLACK_WEBHOOK_URL/);
  });

  it("trims the stray trailing newline Vercel env vars carry", async () => {
    process.env.SLACK_WEBHOOK_URL =
      "https://hooks.slack.com/services/AAA/BBB\n";
    const { getSlackWebhook } = await import("../slack");
    expect(getSlackWebhook()).toBe("https://hooks.slack.com/services/AAA/BBB");
  });

  it("never leaks the webhook URL into an error message", async () => {
    const secret = "https://hooks.slack.com/services/SUPER/SECRET/VALUE";
    process.env.SLACK_WEBHOOK_URL = secret;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("channel_not_found", { status: 404 })),
    );

    const { sendSlackMessage } = await import("../slack");
    const res = await sendSlackMessage("hi");

    expect(res.ok).toBe(false);
    expect(res.error).toContain("channel_not_found");
    expect(res.error).not.toContain("SECRET");
  });

  it("posts the title as a mrkdwn heading above the body", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/A/B";
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push([String(url), init]);
        return new Response("ok", { status: 200 });
      }),
    );

    const { sendSlackMessage } = await import("../slack");
    expect((await sendSlackMessage("body text", "Heading")).ok).toBe(true);

    const body = JSON.parse(String(calls[0][1].body));
    expect(body.text).toBe("*Heading*\nbody text");
  });
});

describe("review lane routing", () => {
  it("is not alertable with no destination — the 2026-08-23 production state", async () => {
    const { canSendReview, sendReview } = await import("../social-review");
    expect(canSendReview()).toBe(false);

    const res = await sendReview("anything");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No review destination configured/);
  });

  it("prefers Slack over Hermes — the serverless-reachable lane wins", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/A/B";
    process.env.HERMES_API_URL = "http://localhost:9999";
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return new Response("ok", { status: 200 });
      }),
    );

    const { canSendReview, sendReview } = await import("../social-review");
    expect(canSendReview()).toBe(true);

    const res = await sendReview("draft ready");
    expect(res.ok).toBe(true);
    expect(res.via).toBe("slack");
    expect(urls[0]).toContain("hooks.slack.com");
  });

  it("counts Hermes alone as alertable, so existing installs keep working", async () => {
    process.env.HERMES_API_URL = "http://localhost:9999";
    const { canSendReview } = await import("../social-review");
    expect(canSendReview()).toBe(true);
  });

  it("does NOT count a Telegram config as a destination any more", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.TELEGRAM_REVIEW_CHAT_ID = "-100123";
    const { canSendReview } = await import("../social-review");
    expect(canSendReview()).toBe(false);
  });
});
