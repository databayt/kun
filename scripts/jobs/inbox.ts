#!/usr/bin/env tsx
// ── Read replies: hotmail (Mail.app) → classify → move the card ──────────────
//
//   pnpm jobs:inbox              read since the last run, apply
//   pnpm jobs:inbox --dry-run    classify and print, change nothing
//   pnpm jobs:inbox --hours 72   look further back
//
// A message is matched to a card by the recipient we wrote to (exact address,
// or its company domain when that is not a free-mail domain) or by the subject
// of what we sent. Funnel rule: any real reply freezes the follow-up clock
// (the card leaves APPLIED) and goes to a human — INTERVIEW, OFFER and plain
// human questions ping Abdout immediately; ambiguous ones are never guessed.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { classifyReply, REPLY_STATUS } from "@/lib/jobs/reply-classifier";
import { crmStatusFor } from "@/lib/jobs/twenty-crm";

import { BoardRow, boardUrl, ledger, listBoard, noteRow } from "./board";
import { loadConfig } from "./config";
import { openDb } from "./engine";
import { notify, whatsappBrief } from "./notify";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const hoursArg = args.indexOf("--hours");
const STATE = "jobs/.state";
const FREE_MAIL =
  /(^|\.)(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|qq|163|proton(mail)?)\./i;

interface Mail {
  from: string;
  subject: string;
  date: string;
  body: string;
}

function readMail(account: string, hours: number): Mail[] | string {
  const res = spawnSync(
    "osascript",
    ["scripts/jobs/mail-read.applescript", account, String(hours)],
    {
      encoding: "utf-8",
      timeout: 180_000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  // A timeout kills osascript silently: name it, or the log reads "not read:".
  if (res.error) return `osascript ${res.error.message} (try fewer --hours)`;
  if (res.status !== 0) return (res.stderr || res.stdout).trim();
  return res.stdout
    .split("\x1e")
    .map((r) => r.split("\x1f"))
    .filter((f) => f.length >= 4)
    .map(([from, subject, date, body]) => ({
      from: from.trim(),
      subject: subject.trim(),
      date: date.trim(),
      body,
    }));
}

const BOUNCE_SUBJECT =
  /^\s*(undeliverable|undelivered mail returned to sender|delivery status notification( \(failure\))?|mail delivery (failed|failure)[^:]*|returned mail[^:]*|failure notice)\s*:?\s*/i;

const addressOf = (from: string): string =>
  (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
const stripRe = (s: string): string =>
  s
    .replace(/^((re|fwd?|aw|sv)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();

async function main(): Promise<void> {
  const cfg = loadConfig();
  mkdirSync(STATE, { recursive: true });
  const lastFile = `${STATE}/inbox.last`;
  const seenFile = `${STATE}/inbox-seen.json`;
  const last = existsSync(lastFile)
    ? new Date(readFileSync(lastFile, "utf-8").trim())
    : null;
  const hours =
    hoursArg > -1
      ? Number(args[hoursArg + 1])
      : last
        ? Math.min(72, Math.ceil((Date.now() - last.getTime()) / 3_600_000) + 1)
        : 72;
  const seen = new Set<string>(
    existsSync(seenFile)
      ? (JSON.parse(readFileSync(seenFile, "utf-8")) as string[])
      : [],
  );

  const mail = readMail(cfg.fromAccount, hours);
  if (typeof mail === "string") {
    console.log(`inbox not read: ${mail}`);
    return;
  }

  // What we sent, from the ledger: address + subject → card.
  const sent = existsSync("jobs/ledger.jsonl")
    ? readFileSync("jobs/ledger.jsonl", "utf-8")
        .split("\n")
        .filter(Boolean)
        .map(
          (l) =>
            JSON.parse(l) as {
              kind: string;
              crmId: string;
              to?: string;
              subject?: string;
            },
        )
        .filter((e) => (e.kind === "sent" || e.kind === "followup") && e.to)
    : [];
  const board = await listBoard();
  const byId = new Map(board.map((r) => [r.id, r]));
  const byAddress = new Map<string, string>();
  const byDomain = new Map<string, string>();
  const bySubject = new Map<string, string>();
  // ATS applications have no recipient address: match by company name.
  const byCompany = new Map<string, string>();
  for (const e of sent) {
    const to = (e.to as string).toLowerCase();
    if (to.startsWith("ats:")) {
      const company = to.slice(4).trim();
      if (company.length >= 4) byCompany.set(company, e.crmId);
      continue;
    }
    byAddress.set(to, e.crmId);
    const domain = to.split("@")[1];
    if (domain && !FREE_MAIL.test(`${domain}.`)) byDomain.set(domain, e.crmId);
    if (e.subject) bySubject.set(stripRe(e.subject), e.crmId);
  }

  console.log(
    `${DRY_RUN ? "DRY RUN — " : ""}${mail.length} message(s) in the last ${hours}h, ${sent.length} sent to match against\n`,
  );
  let matched = 0;

  for (const m of mail) {
    const id = `${m.from}|${m.subject}|${m.date}`;
    if (seen.has(id)) continue;
    const addr = addressOf(m.from);
    if (addr === cfg.fromAccount.toLowerCase()) continue;
    // Greenhouse's security-code emails are part of submitting, not a reply.
    if (/security code/i.test(m.subject) && /greenhouse/i.test(m.from)) continue;
    // A bounce is not a reply: the card goes to HOLD so no follow-up chases a
    // dead address (BBOXX's info@ bounced unseen on 2026-09-27).
    if (/mailer-daemon|postmaster/i.test(addr) || BOUNCE_SUBJECT.test(m.subject)) {
      const original = stripRe(m.subject.replace(BOUNCE_SUBJECT, ""));
      const dead = [...byAddress.keys()].find((a) => m.body.toLowerCase().includes(a));
      const bouncedId = bySubject.get(original) ?? (dead ? byAddress.get(dead) : undefined);
      if (!bouncedId || !byId.has(bouncedId)) continue;
      const row = byId.get(bouncedId) as BoardRow;
      matched++;
      console.log(`  bounce     ${row.name.slice(0, 55)}  ← ${dead ?? addr}`);
      if (DRY_RUN) continue;
      await noteRow(bouncedId, `bounced: ${dead ?? "the address"} did not accept the email — "${m.subject}"`, {
        applicationStatus: "HOLD",
        holdReason: `bounced: ${dead ?? "recipient"} does not exist — find a working address, then move to APPROVED`,
      });
      ledger({ kind: "error", crmId: bouncedId, name: row.name, campaign: row.campaign, detail: `bounce: ${dead ?? addr}` });
      seen.add(id);
      continue;
    }
    const crmId =
      byAddress.get(addr) ??
      byDomain.get(addr.split("@")[1] ?? "") ??
      bySubject.get(stripRe(m.subject)) ??
      // Whole words only, and never from GitHub/CI: a dependabot "bump axios"
      // thread matched the Axios application four times on 2026-10-04.
      (/@(github\.com|.*\.github\.com)$|dependabot/i.test(addr)
        ? undefined
        : [...byCompany.entries()].find(([c]) =>
            new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(`${m.subject} ${m.from}`.toLowerCase()),
          )?.[1]);
    if (!crmId || !byId.has(crmId)) continue;
    const row = byId.get(crmId) as BoardRow;
    const kind = classifyReply({
      from: m.from,
      subject: m.subject,
      body: m.body,
    });
    const status = REPLY_STATUS[kind];
    matched++;
    console.log(
      `  ${kind.padEnd(10)} ${row.name.slice(0, 55)}  ← ${addr} "${m.subject.slice(0, 50)}"`,
    );
    if (DRY_RUN) continue;

    const excerpt = m.body.replace(/\s+/g, " ").slice(0, 280);
    const crm = status ? crmStatusFor(status) : undefined;
    await noteRow(
      crmId,
      `reply (${kind}) from ${addr}: "${m.subject}" — ${excerpt}`,
      {
        ...(crm
          ? { applicationStatus: crm, responseAt: new Date().toISOString() }
          : {}),
      },
    );
    ledger({
      kind: "reply",
      crmId,
      name: row.name,
      campaign: row.campaign,
      variant: row.variant,
      detail: `${kind}: ${m.subject}`,
    });
    if (status && ["interview", "offer", "rejected"].includes(status)) {
      try {
        const db = openDb();
        await db.jobOpportunity.updateMany({
          where: { twentyOpportunityId: crmId },
          data: { status: status as "interview" | "offer" | "rejected" },
        });
        await db.$disconnect();
      } catch {
        // Neon is secondary; the board moved.
      }
    }
    if (
      kind === "interview" ||
      kind === "offer" ||
      kind === "response" ||
      kind === "ambiguous"
    ) {
      const head = {
        interview: "🎯 Interview",
        offer: "🏆 OFFER",
        response: "💬 Reply",
        ambiguous: "❓ Needs a read",
      }[kind];
      notify(
        `${head}: ${row.name}\nFrom ${addr} — "${m.subject}"\n${excerpt}\n${boardUrl(crmId)}`,
        `Jobs — ${head}`,
      );
      // Abdout, 2026-10-05: WhatsApp only for an acceptance — interview or
      // offer. Other replies stay on Slack and the board.
      if (kind === "interview" || kind === "offer")
        whatsappBrief(`${head}: ${row.name}\n"${m.subject}"\n${boardUrl(crmId)}`);
    }
    seen.add(id);
  }

  if (!DRY_RUN) {
    writeFileSync(lastFile, new Date().toISOString());
    writeFileSync(seenFile, JSON.stringify([...seen].slice(-2000)));
  }
  console.log(`\n${matched} matched reply(ies)${DRY_RUN ? " (dry run)" : ""}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
