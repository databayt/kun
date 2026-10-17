#!/usr/bin/env node
// ── Link Abdout's WhatsApp to the Hermes bridge without a TTY ────────────────
//
//   pnpm jobs:whatsapp-pair        opens http://localhost:8790
//
// `hermes whatsapp` refuses to run without an interactive terminal, so it
// cannot be driven from Claude Code (`! hermes whatsapp` fails). This runs the
// same Baileys bridge in --pair-only --pair-json mode and serves the QR on a
// local page that refreshes itself (WhatsApp rotates the code every ~20s).
// He scans it from the Mac screen: WhatsApp → Settings → Linked devices →
// Link a device. A `disconnected 515` right after the scan is success.
//
// Afterwards: WHATSAPP_ENABLED=true in ~/.hermes/.env, then
//   launchctl kickstart -k gui/$(id -u)/ai.hermes.gateway
// and check ~/.hermes/gateway_state.json shows whatsapp "connected".
// Linked 2026-10-05: +249919071294 (session ~/.hermes/whatsapp/session).

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";

const HOME = process.env.HOME;
const BRIDGE = `${HOME}/.hermes/hermes-agent/scripts/whatsapp-bridge`;
const SESSION = `${HOME}/.hermes/whatsapp/session`;
const PORT = 8790;

if (!existsSync(`${BRIDGE}/node_modules`)) {
  console.log("installing the bridge's dependencies …");
  spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: BRIDGE, stdio: "inherit" });
}
const QR = (await import("qrcode")).default; // kun devDependency

let png = null;
let status = "waiting for the QR …";
const page = `<!doctype html><meta charset=utf-8><title>Link WhatsApp</title>
<body style="font:20px system-ui;text-align:center;padding:30px">
<h2>WhatsApp → Settings → Linked devices → Link a device</h2>
<img id=q width=420><p id=s></p>
<script>setInterval(()=>{q.src="/qr.png?"+Date.now();fetch("/status").then(r=>r.text()).then(t=>s.textContent=t)},2000)</script>`;

const server = createServer((req, res) => {
  if (req.url.startsWith("/qr.png") && png) return res.writeHead(200, { "Content-Type": "image/png" }).end(png);
  if (req.url.startsWith("/status")) return res.end(status);
  res.writeHead(200, { "Content-Type": "text/html" }).end(page);
}).listen(PORT, () => spawn("open", [`http://localhost:${PORT}`]));

const bridge = spawn("node", ["bridge.js", "--pair-only", "--pair-json", "--session", SESSION], { cwd: BRIDGE });
let buf = "";
bridge.stdout.on("data", async (d) => {
  buf += d;
  for (let i; (i = buf.indexOf("\n")) > -1; ) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.event === "qr") {
      png = await QR.toBuffer(ev.qr, { width: 420 });
      status = `QR refreshed ${new Date().toLocaleTimeString()} — scan it`;
    } else {
      status = ev.event + (ev.reason ? ` (${ev.reason})` : "");
      console.log(status);
      if (ev.event === "disconnected" && ev.reason === 515) status = "linked ✓ — finishing";
    }
  }
});
bridge.on("close", (code) => {
  const linked = existsSync(`${SESSION}/creds.json`);
  console.log(linked ? `linked ✓ — session in ${SESSION}` : `bridge exited ${code}, not linked`);
  server.close();
  process.exit(linked ? 0 : 1);
});
