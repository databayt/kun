// kun's one sink — the node twin of .claude/scripts/lib/notify.sh (same channels, same order).
//
//   import { kunNotify } from "../lib/notify.mjs";
//   kunNotify("me", "kun", "disk under 10 GB");
//
// `me` → this machine's ~/.claude/.kun-notify (per machine, never fleet config); other
// channels → engine.json → notify.<channel>. Transport: `hermes send` (Slack, no LLM) →
// desktop banner on macOS → stderr. For `me`, presence wins: at the Mac → banner only.
// Best effort: returns whether something was delivered, never throws.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const run = (cmd, args) => {
  try {
    execFileSync(cmd, args, { stdio: "ignore", timeout: 60000 });
    return true;
  } catch {
    return false;
  }
};

export function kunNotify(channel = "me", subject = "kun", text = "") {
  if (!text) return false;
  let target = "";
  if (channel === "me") {
    try {
      target = fs.readFileSync(path.join(HOME, ".claude/.kun-notify"), "utf8").split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")) || "";
    } catch {}
    if (process.platform === "darwin" && fs.existsSync(path.join(HOME, ".claude/.present"))) target = "";
  } else {
    try {
      const engine = JSON.parse(fs.readFileSync(path.join(process.env.KUN_DIR || path.join(HOME, "kun"), ".claude/engine.json"), "utf8"));
      target = engine.notify?.[channel] || "";
    } catch {}
  }
  const hermes = path.join(HOME, ".local/bin/hermes");
  if (target && fs.existsSync(hermes) && run(hermes, ["send", "--to", target, "--quiet", "--subject", subject, text])) return true;
  if (process.platform === "darwin" && run("osascript", ["-e", `display notification ${JSON.stringify(text.split("\n")[0].slice(0, 180))} with title ${JSON.stringify(subject)}`])) return true;
  process.stderr.write(`[${subject}] ${text}\n`);
  return false;
}
