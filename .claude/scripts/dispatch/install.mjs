#!/usr/bin/env node
// Writes the launchd plist (macOS) or systemd user timer (Linux) for the runner. Never loads it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KUN_DIR } from "./lib.mjs";

export const LABEL = "com.databayt.dispatch-runner";

export function plist({ node, runner, log, kunDir, home, interval = 120 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${node}</string><string>${runner}</string></array>
  <key>StartInterval</key><integer>${interval}</integer>
  <key>RunAtLoad</key><true/>
  <key>WorkingDirectory</key><string>${kunDir}</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>${home}/.local/bin:${home}/.opencode/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>KUN_DIR</key><string>${kunDir}</string>
  </dict>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict></plist>
`;
}

export function install({ platform = process.platform, home = os.homedir(), interval = 120 } = {}) {
  const node = process.execPath;
  const runner = path.join(KUN_DIR, ".claude/scripts/dispatch/runner.mjs");
  const dir = path.join(home, ".kun", "dispatch");
  const log = path.join(dir, "runner.log");
  fs.mkdirSync(dir, { recursive: true });
  if (platform === "darwin") {
    const file = path.join(home, "Library/LaunchAgents", `${LABEL}.plist`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, plist({ node, runner, log, kunDir: KUN_DIR, home, interval }));
    return { file, run: `launchctl bootstrap gui/$(id -u) ${file}`, stop: `launchctl bootout gui/$(id -u)/${LABEL}` };
  }
  const ud = path.join(home, ".config/systemd/user");
  fs.mkdirSync(ud, { recursive: true });
  fs.writeFileSync(path.join(ud, "kun-dispatch.service"), `[Unit]\nDescription=kun dispatch runner\n[Service]\nType=oneshot\nEnvironment=KUN_DIR=${KUN_DIR}\nExecStart=${node} ${runner}\nStandardOutput=append:${log}\nStandardError=append:${log}\n`);
  fs.writeFileSync(path.join(ud, "kun-dispatch.timer"), `[Unit]\nDescription=kun dispatch every ${interval}s\n[Timer]\nOnBootSec=60\nOnUnitActiveSec=${interval}\n[Install]\nWantedBy=timers.target\n`);
  return { file: path.join(ud, "kun-dispatch.timer"), run: "systemctl --user daemon-reload && systemctl --user enable --now kun-dispatch.timer", stop: "systemctl --user disable --now kun-dispatch.timer" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = install();
  console.log(`wrote ${r.file}\nnot loaded. To start it, run:\n  ${r.run}\nTo stop:\n  ${r.stop}`);
}
