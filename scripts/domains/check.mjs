#!/usr/bin/env node
// Domain + email health tracer — reads cf/domains.json, probes the live internet,
// and reports what needs a human. Read-only by construction: it never touches a
// zone, a registrar or a mailbox. Fixing is the `domains` skill's job, with Abdout.
//
//   node scripts/domains/check.mjs                 table to stdout
//   node scripts/domains/check.mjs --json          machine output
//   node scripts/domains/check.mjs --smtp          also RCPT-probe hi@/sales@ (needs outbound :25 — the Mac, not GitHub runners)
//   node scripts/domains/check.mjs --alert         sync one GitHub issue per unhealthy domain (+ Slack if SLACK_WEBHOOK_URL)
//   node scripts/domains/check.mjs --only mkan.sd  one domain
//   node scripts/domains/check.mjs --fixture expired   pretend the first domain expires in 5 days (alert-path test)
//
// Exit code: 0 all ok · 1 warnings · 2 something blocking.
// Docs: content/docs/email.mdx (section "Health tracing").

import { readFileSync } from "node:fs";
import { Resolver } from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const config = JSON.parse(readFileSync(path.join(ROOT, "cf/domains.json"), "utf8"));
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);

const REPO = "databayt/kun";
const LABEL = "domains";
const DAY = 86_400_000;
const RENEW_RECHECK_DAYS = 35;

// Two independent resolvers: one public resolver serving a stale answer must not
// pass as truth (see memory reference_dns_topology — the 24-hour tail).
const resolver = new Resolver({ timeout: 5000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const SEV = { ok: 0, warn: 1, block: 2 };

// ---------- probes ----------

async function q(fn, name) {
  try {
    return await resolver[fn](name);
  } catch (e) {
    if (["ENODATA", "ENOTFOUND"].includes(e.code)) return [];
    throw e;
  }
}
const txt = async (name) => (await q("resolveTxt", name)).map((parts) => parts.join(""));

async function rdapExpiry(domain) {
  const tld = domain.split(".").pop();
  const urls = {
    org: `https://rdap.publicinterestregistry.org/rdap/domain/${domain}`,
    com: `https://rdap.verisign.com/com/v1/domain/${domain}`,
    net: `https://rdap.verisign.com/net/v1/domain/${domain}`,
  };
  if (urls[tld]) {
    const res = await fetch(urls[tld], { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`RDAP HTTP ${res.status}`);
    const d = await res.json();
    const exp = d.events?.find((e) => e.eventAction === "expiration")?.eventDate;
    return { expires: exp, status: d.status ?? [] };
  }
  // No RDAP for .sd — the registry's port-43 whois answers in ICANN format.
  const raw = await whois(domain, `whois.nic.${tld}`);
  const exp = raw.match(/Registry Expiry Date:\s*(\S+)/i)?.[1];
  const status = [...raw.matchAll(/Domain Status:\s*(\S+)/gi)].map((m) => m[1]);
  if (!exp) throw new Error(`whois.nic.${tld} returned no expiry`);
  return { expires: exp, status };
}

function whois(domain, host) {
  return new Promise((resolve, reject) => {
    let out = "";
    const s = net.connect(43, host, () => s.write(`${domain}\r\n`));
    s.setTimeout(15000, () => s.destroy(new Error(`whois ${host} timeout`)));
    s.on("data", (c) => (out += c));
    s.on("end", () => resolve(out));
    s.on("error", reject);
  });
}

function certExpiry(host) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 10000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(new Date(c.valid_to));
    });
    s.on("timeout", () => s.destroy(new Error("TLS timeout")));
    s.on("error", reject);
  });
}

// SMTP RCPT probe — one session per domain: EHLO, MAIL, one RCPT per address, QUIT.
// No DATA, so no message is ever sent. Only a 5xx at RCPT means "this address is
// gone"; a refused or silent connection is a probe problem (providers block home
// IPs that probe too often — Private Email did on 2026-10-03), so it is reported
// as unreachable, never as a dead inbox.
function rcptProbe(mx, addresses) {
  return new Promise((resolve) => {
    const steps = ["EHLO probe.databayt.org", "MAIL FROM:<probe@databayt.org>", ...addresses.map((a) => `RCPT TO:<${a}>`), "QUIT"];
    const replies = {};
    let i = -1;
    let buf = "";
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const s = net.connect({ port: 25, host: mx, family: 4 });
    s.setTimeout(15000, () => { s.destroy(); finish({ reachable: false, reply: "timeout" }); });
    s.on("error", (e) => finish({ reachable: false, reply: e.code ?? e.message }));
    s.on("data", (c) => {
      buf += c;
      if (!/(^|\n)\d{3} [^\n]*\r?\n$/.test(buf)) return; // wait for the last line of a multi-line reply
      const code = buf.match(/(^|\n)(\d{3}) [^\n]*\r?\n$/)[2];
      if (i >= 2 && i < 2 + addresses.length) replies[addresses[i - 2]] = { code, line: buf.trim().split("\n").pop() };
      buf = "";
      i += 1;
      if (i < steps.length) s.write(steps[i] + "\r\n");
    });
    s.on("close", () => finish(Object.keys(replies).length ? { reachable: true, replies } : { reachable: false, reply: "closed before RCPT" }));
  });
}

// ---------- checks ----------

function spell(d, verb) {
  return `say \`domains ${verb} ${d}\``;
}

async function checkDomain(entry) {
  const d = entry.name;
  const out = [];
  const add = (check, sev, detail, action) => out.push({ domain: d, check, sev, detail, action });
  const guard = async (check, fn) => {
    try {
      await fn();
    } catch (e) {
      add(check, "warn", `probe failed: ${e.message}`, "re-run; if it persists, the registry or resolver is down");
    }
  };

  await guard("expiry", async () => {
    let { expires, status } = await rdapExpiry(d);
    if (flag("--fixture") && opt("--fixture") === "expired" && entry === config.domains[0]) {
      expires = new Date(Date.now() + 5 * DAY).toISOString();
    }
    const days = Math.floor((new Date(expires) - Date.now()) / DAY);
    const date = expires.slice(0, 10);
    if (days <= 30) add("expiry", "block", `expires ${date} — ${days} days left`, spell(d, "renew"));
    else if (days <= 90) add("expiry", "warn", `expires ${date} — ${days} days left`, spell(d, "renew"));
    else add("expiry", "ok", `expires ${date} (${days}d)`);
    const flat = status.join(" ").toLowerCase().replace(/\s+/g, "");
    if (/hold|redemption|pendingdelete/.test(flat)) add("status", "block", `registry status: ${status.join(", ")}`, spell(d, "renew"));
    else if (entry.registrar !== "sdnic (Sudan Internet Society)" && !flat.includes("transferprohibited"))
      add("status", "warn", `registrar lock is OFF (${status.join(", ") || "no status"})`, spell(d, "lock"));
  });

  const r = entry.renewal ?? {};
  const verified = r.autoRenewVerifiedAt ? Math.floor((Date.now() - new Date(r.autoRenewVerifiedAt)) / DAY) : null;
  if (r.autoRenew !== "on" || verified === null)
    add("auto-renew", "warn", `auto-renew not verified at ${entry.registrar} (${r.where})`, spell(d, "verify-renew"));
  else if (verified > RENEW_RECHECK_DAYS)
    add("auto-renew", "warn", `auto-renew last verified ${verified} days ago`, spell(d, "verify-renew"));
  else add("auto-renew", "ok", `auto-renew on, verified ${r.autoRenewVerifiedAt}`);

  await guard("nameservers", async () => {
    const ns = (await q("resolveNs", d)).map((n) => n.toLowerCase().replace(/\.$/, "")).sort();
    const want = [...config.nameservers].sort();
    if (JSON.stringify(ns) !== JSON.stringify(want))
      add("nameservers", "block", `NS is ${ns.join(", ") || "EMPTY"} — expected ${want.join(", ")}`, spell(d, "restore"));
    else add("nameservers", "ok", "Cloudflare pair");
  });

  const mail = entry.mail;
  if (mail === "skip") {
    // watched for expiry only
  } else if (mail === null) {
    // A domain that sends no mail should say so, or anyone can send as it.
    await guard("anti-spoof", async () => {
      const spf = (await txt(d)).find((t) => t.startsWith("v=spf1"));
      const dmarc = (await txt(`_dmarc.${d}`)).find((t) => t.startsWith("v=DMARC1"));
      const strict = spf === "v=spf1 -all" && /p=reject/.test(dmarc ?? "");
      if (strict) add("anti-spoof", "ok", "SPF -all + DMARC reject");
      else add("anti-spoof", "warn", `no mail, but not locked: SPF=${spf ?? "none"} DMARC=${dmarc ?? "none"} — anyone can spoof @${d}`, spell(d, "lock-mail"));
    });
  } else {
    await guard("mx", async () => {
      const mx = (await q("resolveMx", d)).map((m) => m.exchange.toLowerCase().replace(/\.$/, "")).sort();
      const missing = mail.mx.filter((h) => !mx.includes(h));
      const extra = mx.filter((h) => !mail.mx.includes(h));
      if (mx.length === 0) add("mx", "block", "NO MX — inbound mail to this domain is bouncing", spell(d, "restore"));
      else if (missing.length || extra.length)
        add("mx", "block", `MX drift — missing: ${missing.join(", ") || "-"}; unexpected: ${extra.join(", ") || "-"}`, spell(d, "restore"));
      else add("mx", "ok", `${mx.length} hosts (${mail.provider})`);
    });
    await guard("spf", async () => {
      const spfs = (await txt(d)).filter((t) => t.startsWith("v=spf1"));
      if (spfs.length !== 1) return add("spf", "block", `${spfs.length} SPF records (must be exactly 1)`, spell(d, "restore"));
      const missing = mail.spfIncludes.filter((i) => !spfs[0].includes(`include:${i}`));
      if (missing.length) add("spf", "block", `SPF lost include:${missing.join(", include:")}`, spell(d, "restore"));
      else if (/\+all|\?all/.test(spfs[0])) add("spf", "warn", `SPF too permissive: ${spfs[0]}`, spell(d, "harden"));
      else add("spf", "ok", spfs[0]);
    });
    await guard("dkim", async () => {
      const bad = [];
      for (const s of mail.dkimSelectors) {
        const rec = (await txt(`${s}._domainkey.${d}`)).join("");
        if (!/p=[A-Za-z0-9+/]{40,}/.test(rec)) bad.push(s);
      }
      if (bad.length) add("dkim", "block", `DKIM key missing for selector ${bad.join(", ")}`, spell(d, "restore"));
      else add("dkim", "ok", `selectors ${mail.dkimSelectors.join(", ")}`);
    });
    await guard("dmarc", async () => {
      const recs = (await txt(`_dmarc.${d}`)).filter((t) => t.startsWith("v=DMARC1"));
      if (recs.length !== 1) return add("dmarc", "block", `${recs.length} DMARC records`, spell(d, "harden"));
      const p = recs[0].match(/p=(\w+)/)?.[1] ?? "none";
      const rank = { none: 0, quarantine: 1, reject: 2 };
      if (rank[p] < rank[mail.dmarcMin]) add("dmarc", "block", `DMARC weakened to p=${p} (baseline ${mail.dmarcMin})`, spell(d, "restore"));
      else if (p === "none") add("dmarc", "warn", `DMARC p=none — monitoring only, spoofed mail still delivered`, spell(d, "harden"));
      else if (!/rua=/.test(recs[0])) add("dmarc", "warn", `DMARC p=${p} but no rua= — nobody sees abuse reports`, spell(d, "harden"));
      else add("dmarc", "ok", recs[0]);
    });
    if (flag("--smtp") && mail.rcpt?.length) {
      await guard("inbox", async () => {
        const res = await rcptProbe(mail.mx[0], mail.rcpt.map((l) => `${l}@${d}`));
        if (!res.reachable) return add("inbox", "warn", `couldn't reach ${mail.mx[0]}:25 (${res.reply}) — probe blocked, not proof of a dead inbox`, "re-run from another network");
        const dead = Object.entries(res.replies).filter(([, r]) => r.code.startsWith("5"));
        const soft = Object.entries(res.replies).filter(([, r]) => r.code.startsWith("4"));
        if (dead.length) add("inbox", "block", `REJECTED: ${dead.map(([a, r]) => `${a} → ${r.line}`).join("; ")}`, spell(d, "restore"));
        else if (soft.length) add("inbox", "warn", `deferred: ${soft.map(([a, r]) => `${a} → ${r.line}`).join("; ")}`, "re-run later");
        else add("inbox", "ok", `${mail.rcpt.map((l) => `${l}@`).join(" ")} accepted`);
      });
    }
  }

  if (entry.web) {
    await guard("tls", async () => {
      const exp = await certExpiry(d);
      const days = Math.floor((exp - Date.now()) / DAY);
      if (days <= 7) add("tls", "block", `HTTPS cert expires in ${days}d`, spell(d, "restore"));
      else if (days <= 14) add("tls", "warn", `HTTPS cert expires in ${days}d`, spell(d, "restore"));
      else add("tls", "ok", `cert ${days}d`);
    });
  }
  return out;
}

// ---------- alerting ----------

function gh(argv, input) {
  return execFileSync("gh", argv, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] }).trim();
}

const ICON = { ok: "✅", warn: "⚠️", block: "🛑" };

function issueBody(domain, rows) {
  const bad = rows.filter((r) => r.sev !== "ok");
  const lines = [
    `Automated by \`scripts/domains/check.mjs\` (${new Date().toISOString().slice(0, 16)}Z). This issue is rewritten on every run and closes itself when ${domain} is green.`,
    "",
    "| | check | detail | to fix |",
    "|---|---|---|---|",
    ...bad.map((r) => `| ${ICON[r.sev]} | ${r.check} | ${r.detail} | ${r.action ?? ""} |`),
    "",
    `<details><summary>healthy checks</summary>\n\n${rows.filter((r) => r.sev === "ok").map((r) => `- ${r.check}: ${r.detail}`).join("\n")}\n</details>`,
    "",
    "Playbook: `.claude/skills/domains/SKILL.md` · Docs: https://kun.databayt.org/en/docs/email",
  ];
  return lines.join("\n");
}

async function syncIssues(all) {
  try { gh(["label", "create", LABEL, "--repo", REPO, "--color", "5319E7", "--description", "Domain + email health tracer", "--force"]); } catch {}
  const open = JSON.parse(gh(["issue", "list", "--repo", REPO, "--label", LABEL, "--state", "open", "--json", "number,title,labels", "--limit", "50"]));
  const byDomain = Object.groupBy(all, (r) => r.domain);
  const slack = [];

  for (const [domain, rows] of Object.entries(byDomain)) {
    const worst = Math.max(...rows.map((r) => SEV[r.sev]));
    const title = `domains: ${domain} needs action`;
    const existing = open.find((i) => i.title === title);
    if (worst === 0) {
      if (existing) {
        gh(["issue", "close", String(existing.number), "--repo", REPO, "--reason", "completed", "--comment", `All checks green on ${new Date().toISOString().slice(0, 10)}.`]);
        slack.push(`✅ ${domain} healthy again (#${existing.number} closed)`);
      }
      continue;
    }
    const prio = worst === 2 ? "priority/p0" : "priority/p1";
    const body = issueBody(domain, rows);
    const headline = rows.filter((r) => SEV[r.sev] === worst).map((r) => `${r.check}: ${r.detail} → ${r.action}`).join("\n");
    if (!existing) {
      const url = gh(["issue", "create", "--repo", REPO, "--title", title, "--label", `${LABEL},${prio}`, "--assignee", "abdout", "--body-file", "-"], body);
      slack.push(`${ICON[worst === 2 ? "block" : "warn"]} ${domain}\n${headline}\n${url}`);
      continue;
    }
    const wasBlock = existing.labels.some((l) => l.name === "priority/p0");
    gh(["issue", "edit", String(existing.number), "--repo", REPO, "--body-file", "-", "--add-label", prio, "--remove-label", worst === 2 ? "priority/p1" : "priority/p0"], body);
    // A comment mentioning @abdout is what reaches his phone: escalations always,
    // blocking items once a day (the workflow runs daily, so every run).
    if (worst === 2) {
      gh(["issue", "comment", String(existing.number), "--repo", REPO, "--body-file", "-"], `@abdout 🛑 ${wasBlock ? "still blocking" : "escalated to blocking"}:\n\n${headline}`);
      slack.push(`🛑 ${domain}\n${headline}\nhttps://github.com/${REPO}/issues/${existing.number}`);
    }
  }

  if (slack.length && process.env.SLACK_WEBHOOK_URL) {
    const { sendSlackMessage } = await import("../lib/slack.mjs");
    const res = await sendSlackMessage(slack.join("\n\n"), "Domains & mail");
    if (!res.ok) console.error(`slack: ${res.error}`);
  }
}

// ---------- main ----------

const targets = config.domains.filter((e) => !opt("--only") || e.name === opt("--only"));
const all = (await Promise.all(targets.map(checkDomain))).flat();
const worst = Math.max(0, ...all.map((r) => SEV[r.sev]));

if (flag("--json")) console.log(JSON.stringify({ at: new Date().toISOString(), worst: Object.keys(SEV)[worst], results: all }, null, 2));
else {
  for (const e of targets) {
    console.log(`\n${e.name}  (${e.role} · ${e.registrar})`);
    for (const r of all.filter((x) => x.domain === e.name))
      console.log(`  ${ICON[r.sev]} ${r.check.padEnd(12)} ${r.detail}${r.action ? `\n     → ${r.action}` : ""}`);
  }
}

if (flag("--alert")) await syncIssues(all);
process.exit(worst);
