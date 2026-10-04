// ── Reach Abdout: Hermes → Slack DM, plus a macOS notification ───────────────
//
// `hermes send` is Hermes' no-LLM path: it reuses the gateway's Slack bot
// token and needs neither the model login (dead since 2026-09-13) nor a
// running gateway. Best effort — an alert that fails must never fail a send.

import { spawnSync } from "node:child_process";

import { loadConfig } from "./config";

const HERMES = `${process.env.HOME}/.local/bin/hermes`;

export function notify(text: string, subject?: string): boolean {
  const cfg = loadConfig();
  const args = [
    "send",
    "--to",
    cfg.slackTarget,
    "--quiet",
    ...(subject ? ["--subject", subject] : []),
    text,
  ];
  const res = spawnSync(HERMES, args, { encoding: "utf-8", timeout: 60_000 });
  const first = text.split("\n")[0].slice(0, 180).replace(/"/g, "'");
  spawnSync("osascript", [
    "-e",
    `display notification "${first}" with title "${(subject ?? "Jobs").replace(/"/g, "'")}"`,
  ]);
  if (res.status !== 0) {
    console.log(
      `(hermes send failed: ${(res.stderr || res.stdout || "").slice(0, 200)})`,
    );
    return false;
  }
  return true;
}

/// A one-line brief to Abdout's own WhatsApp chat — an application that went
/// out, or a reply that needs him. Best effort and silent on failure: a brief
/// must never fail the send it reports. The board stays the record.
export function whatsappBrief(text: string): void {
  const to = loadConfig().briefWhatsApp;
  if (!to || process.env.JOBS_BRIEF === "off") return;
  spawnSync(HERMES, ["send", "--to", `whatsapp:${to}`, "--quiet", text], {
    encoding: "utf-8",
    timeout: 60_000,
  });
}
