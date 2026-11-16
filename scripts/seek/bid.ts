#!/usr/bin/env tsx
// ── Bid: a tender card becomes a bid packet Abdout can submit ────────────────
//
//   pnpm jobs:bid                      every open TENDER / ENGINEERING_CONTRACT card
//   pnpm jobs:bid --limit 3            at most 3 packets
//   pnpm jobs:bid --id <crmId>         one card (regenerates its packet)
//   pnpm jobs:bid --dry-run            write the packet files; leave the board + ledger alone
//
// Contracts lane (Abdout, 2026-11-16): no job applications — Databayt Ltd bids.
// For each open card: triage against the company's registered activities
// (ISIC 6201 / 6202 / 6311 / 8549), read the posting, then ONE headless
// `claude -p` writes proposal.md + meta.json; this script builds README.md
// (eligibility checklist), proposal.html and proposal.pdf, and puts the card on
// HOLD as "bid ready — submit by <deadline> — <packet>". Nothing is ever sent:
// Abdout signs, stamps and submits, then `pnpm jobs:mark <id> applied`.
//
// Exit codes (job-run.sh): 0 ok · 75 defer (board or posting unreachable, retry)
// · 77 needs Abdout (no company block in the profile) · 1 fail.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright-core";

import { BoardRow, ledger, listBoard, noteRow } from "./board";
import { isContractCampaign, kigaliNow } from "./config";
import { postingText, splitName } from "./lib/posting";
import { DATA, DATA_ABS, REPO } from "./lib/paths.mjs";

import { KUN_CLAUDE } from "../lib/kun-claude.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const opt = (f: string): string | undefined =>
  args.indexOf(f) > -1 ? args[args.indexOf(f) + 1] : undefined;
const LIMIT = Number(opt("--limit") ?? 5);
const ONLY_ID = opt("--id");

const BID_CAMPAIGNS = ["TENDER", "ENGINEERING_CONTRACT"];
const OPEN_STATUS = ["TO_APPLY", "HOLD", "QUEUED", "APPROVED"];
const MIN_DAYS = 4;
const BIDS_DIR = `${DATA}/packets/bids`;

// ── triage ───────────────────────────────────────────────────────────────────

// Cards in an engineering lane that are really job postings (LinkedIn, Indeed).
const TENDERISH =
  /tender|expressions? of interest|\beoi\b|request for (proposals?|quotations?)|\brf[pq]\b|terms of reference|\btors?\b|^notice for|invitation for|procurement of|consultanc/i;
const JOB_HOSTS = /linkedin\.com|indeed\.com|glassdoor|ziprecruiter/i;

// Work Databayt's registered activities cover: software and systems, IT
// consultancy, data and AI, digital training.
const IN_STRONG =
  /software|system development|develop(ment|ing)? (of )?(a |an |the )?[\w -]{0,30}(system|platform|portal|application|app\b|website|web)|information (management )?system|management information|\bhris\b|\bmis\b|\bpmis\b|\berp\b|\bportal\b|web ?site|web[- ](based|platform|application)|\bapplications?\b|\bplatform\b|dashboard|mobile app|chatbot|artificial intelligence|\bai\b|machine learning|data (analytics|science|platform|warehouse|management)|e-?learning|digital (transformation|platform|solution|skills|literacy)|\bict (consult|training|strategy|audit|capacity)|capacity building|\btraining\b|technical assistance|\bsaas\b|cyber ?security (assessment|audit|consult)/i;
// Goods, equipment, works and licensed trades — outside 6201/6202/6311/8549.
const OUT_HARD =
  /supply|deliver(y|ing)\b|equipment|hardware|computers?|laptops?|servers?|\bsan\b|generators?|furniture|vehicles?|\bups\b|switch(es)?|cabling|data ?cent(er|re)|solar|transformers?|substation|\bkv\b|\bkva\b|installation|commissioning|construction|\bworks\b|fishponds?|refurbish|rehabilitation|renovation|repair|maintenance of|catering|cleaning|security services|pre-?qualification of supply|geolog|mineral|mining|hydraulic|road|bridge|building|survey|medical|pharmaceutical|printing|insurance|audit(ing)? services|legal services/i;

export interface Triage {
  verdict: "IN" | "OUT";
  why: string;
}

export function triage(title: string, text = ""): Triage {
  const head = title;
  if (IN_STRONG.test(head))
    return {
      verdict: "IN",
      why: "software / digital / training scope in the title",
    };
  if (OUT_HARD.test(head)) {
    const m = head.match(OUT_HARD)?.[0]?.toLowerCase() ?? "goods or works";
    return {
      verdict: "OUT",
      why: `"${m}" — goods, equipment or works, no matching activity code`,
    };
  }
  // The title does not decide it: the body may. A software scope with goods
  // mentioned in passing stays IN; a goods notice with a software word is OUT.
  const body = text.slice(0, 6000);
  const strong = (body.match(new RegExp(IN_STRONG.source, "gi")) ?? []).length;
  const hard = (body.match(new RegExp(OUT_HARD.source, "gi")) ?? []).length;
  if (hard >= 6 && hard > strong * 2)
    return {
      verdict: "OUT",
      why: "the notice reads as supply / works, not a service",
    };
  return {
    verdict: "IN",
    why: "ambiguous title — kept in (read the scope before bidding)",
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface Company {
  legalName: string;
  tin: string;
  registered: string;
  country: string;
  office: string;
  activities: { code: string; label: string }[];
  director: string;
  website: string;
  email: string;
  /// What the proposal may cite as relevant work, one sentence each, exactly as
  /// true today. Nothing beyond this list reaches a bid.
  portfolio?: string[];
}

function loadProfile(): {
  company?: Company;
  identity?: Record<string, unknown>;
} & Record<string, unknown> {
  return JSON.parse(readFileSync(`${DATA}/profile.json`, "utf-8"));
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(
      /\b(open |tender |notice |request for |for |the |of |and |a |an )/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

const daysFromToday = (iso: string, today: string): number =>
  Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/// Packet already written for this card? (README carries "Card: <crmId>".)
function existingPacket(crmId: string): string | null {
  if (!existsSync(BIDS_DIR)) return null;
  for (const d of readdirSync(BIDS_DIR)) {
    const readme = join(BIDS_DIR, d, "README.md");
    if (
      existsSync(readme) &&
      readFileSync(readme, "utf-8").includes(`Card: ${crmId}`)
    )
      return `${BIDS_DIR}/${d}`;
  }
  return null;
}

/// Tender-document / dossier links on the notice page (postingText strips hrefs).
async function dossierLinks(url: string): Promise<string[]> {
  if (!/^https?:\/\//.test(url) || /umucyo/.test(url)) return [];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const out = new Set<string>();
    for (const m of html.matchAll(/href="([^"#]+)"/gi)) {
      const href = m[1];
      if (
        /\.(pdf|docx?|zip|xlsx?)(\?|$)/i.test(href) ||
        (/(tender|bidding|dossier|download|rfp|tor)[-_/]/i.test(href) &&
          !/jobinrwanda\.com\/(jobs|employer|user|node)/i.test(href))
      ) {
        if (/\/sites\/default\/files|\.pdf|\.docx?|dossier|bidding/i.test(href))
          {
            const abs = (href.startsWith("http") ? href : new URL(href, url).toString()).replace(/&amp;/g, "&");
            const wrapped = abs.match(/safelinks\.protection\.outlook\.com\/\?url=([^&]+)/i);
            out.add(wrapped ? decodeURIComponent(wrapped[1]) : abs);
          }
      }
    }
    return [...out].filter((l) => !/safelinks\.protection|outlook\.com/i.test(l)).slice(0, 6);
  } catch {
    return [];
  }
}

/// The tender document itself, when the notice links a PDF: the proposal must
/// answer its scope and evaluation criteria, not just the one-paragraph notice.
function dossierText(links: string[]): string {
  for (const l of links.filter((x) => /\.pdf(\?|$)/i.test(x))) {
    const tmp = join(tmpdir(), `dossier-${process.pid}-${Date.now()}.pdf`);
    const dl = spawnSync("curl", ["-sL", "--max-time", "60", "-A", "Mozilla/5.0", "-o", tmp, l]);
    if (dl.status !== 0) continue;
    const out = spawnSync("pdftotext", ["-layout", tmp, "-"], { encoding: "utf-8", timeout: 60_000, maxBuffer: 20 * 1024 * 1024 });
    rmSync(tmp, { force: true });
    if (out.status === 0 && out.stdout.trim().length > 200) return `\n\n── Linked document: ${l} ──\n${out.stdout.replace(/[ \t]+/g, " ").slice(0, 30000)}`;
  }
  return "";
}

// ── markdown → html → pdf ────────────────────────────────────────────────────

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
}

export function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    const h = l.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(l)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (/^\|.*\|\s*$/.test(l) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const cells = (r: string) =>
        r
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i]))
        rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map(
            (r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody></table>`,
      );
      continue;
    }
    const list = l.match(/^(\s*)([-*]|\d+\.)\s+/);
    if (list) {
      const ordered = /\d/.test(list[2]);
      const items: string[] = [];
      while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
        let t = lines[i++].replace(/^(\s*)([-*]|\d+\.)\s+/, "");
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i]) &&
          !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
        )
          t += " " + lines[i++].trim();
        items.push(`<li>${inline(t)}</li>`);
      }
      out.push(
        `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|---+\s*$|\||\s*([-*]|\d+\.)\s+)/.test(lines[i])
    )
      para.push(lines[i++]);
    out.push(`<p>${para.map(inline).join("<br>")}</p>`);
  }
  return out.join("\n");
}

const CSS = `@page{size:A4;margin:16mm 16mm 16mm}body{font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:10pt;line-height:1.5;color:#111;background:#fff}
h1{font-size:17pt;line-height:1.2;margin:0 0 4mm}h2{font-size:12pt;margin:6mm 0 2mm;border-bottom:1px solid #ddd;padding-bottom:1mm}h3{font-size:10.5pt;margin:4mm 0 1mm}
p{margin:0 0 2.5mm}ul,ol{margin:0 0 3mm;padding-left:5mm}li{margin-bottom:1mm}table{border-collapse:collapse;width:100%;margin:2mm 0 4mm;font-size:9pt}
th,td{border:1px solid #ddd;padding:1.5mm 2mm;text-align:left;vertical-align:top}th{background:#f5f5f4}hr{border:0;border-top:1px solid #111;margin:4mm 0}code{font-size:9pt}a{color:#111}`;

async function writePdf(html: string, out: string): Promise<number> {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    writeFileSync(out, pdf);
    return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  } finally {
    await browser.close();
  }
}

// ── eligibility ──────────────────────────────────────────────────────────────

interface Req {
  item: string;
  status: "held" | "missing" | "unclear";
  evidence?: string;
}
interface Meta {
  buyer?: string;
  tenderNo?: string;
  submitHow?: string;
  dossierLink?: string;
  eligibility?: Req[];
  unknowns?: string[];
}

/// The model reads the notice; what Databayt holds is decided here, so a
/// hallucinated "held" can never reach the checklist.
function settle(r: Req, tin: string): Req {
  const t = r.item.toLowerCase();
  if (
    /tax clearance|rra|tax compliance|rssb|social security|bid (security|bond|guarantee)|tender (security|guarantee)|performance (security|guarantee)|audited|financial statements|turnover|umucyo|e-?procurement|(similar|past|previous) (contracts?|assignments?|projects?|experience)|references? (letters?|from)|years? of (experience|existence)|at least \d+ years/.test(
      t,
    )
  )
    return { ...r, status: "missing" };
  if (
    /\brdb\b|certificate of (incorporation|registration)|company registration|business registration|legal (status|registration)|commercial regist/.test(
      t,
    )
  )
    return {
      ...r,
      status: "held",
      evidence: "RDB certificate — jobs/packets/rdb/certificate.pdf",
    };
  if (/\btin\b|tax identification/.test(t))
    return { ...r, status: "held", evidence: `TIN ${tin}` };
  return r;
}
const MARK = {
  held: "✅ held",
  missing: "❌ missing",
  unclear: "❓ unclear",
} as const;

function readme(
  card: BoardRow,
  meta: Meta,
  dir: string,
  deadline: string | undefined,
  links: string[],
  tri: Triage,
  tin: string,
): string {
  const { role, company } = splitName(card.name);
  const reqs = (meta.eligibility ?? []).map((r) => settle(r, tin));
  const gates = reqs.filter((r) => r.status !== "held").length;
  const dossier =
    meta.dossierLink ||
    links[0] ||
    "not found — open the notice and download it";
  return `# Bid: ${role}

Card: ${card.id}
Packet: ${dir}

| | |
|---|---|
| Notice | ${card.jobUrl?.primaryLinkUrl ?? "n/a"} |
| Buyer | ${meta.buyer || company} |
| Tender no | ${meta.tenderNo || "[to confirm]"} |
| Deadline | **${deadline ?? "no date on the card, read the notice"}** |
| How to submit | ${meta.submitHow || "[read the notice]"} |
| Tender document / dossier | ${dossier} |
| Other links on the notice | ${links.length ? links.join(" · ") : "none"} |
| Triage | ${tri.verdict} — ${tri.why} |

## Eligibility checklist (from the notice)

| Requirement | Status | Evidence / what to do |
|---|---|---|
${reqs.length ? reqs.map((r) => `| ${r.item.replace(/\|/g, "/")} | ${MARK[r.status]} | ${(r.evidence ?? (r.status === "missing" ? "Databayt does not hold this yet" : "check the notice")).replace(/\|/g, "/")} |`).join("\n") : "| (the notice lists no requirements the model could extract; read it) | ❓ unclear | |"}

${gates ? `**${gates} item(s) need attention before this bid can be submitted.**` : "Every extracted requirement is held."}

Held: RDB certificate (\`jobs/packets/rdb/certificate.pdf\`), TIN ${tin}. Not yet held: RRA tax clearance, RSSB clearance, bid security, Umucyo bidder registration, audited accounts, past contracts of this size.

## Before you submit

1. Read \`proposal.md\` and check every claim. Every \`[to confirm]\` is a fact or a price only you can give.
2. Fill the financial proposal: the skeleton has no final prices.
3. Check the checklist above; a missing item may disqualify the bid.
4. Sign and stamp, then submit by the route above. The loop never sends bids.
5. Afterwards: \`pnpm jobs:mark ${card.id} applied\`.
${meta.unknowns?.length ? `\n## Unknowns the proposal marks [to confirm]\n\n${meta.unknowns.map((u) => `- ${u}`).join("\n")}\n` : ""}`;
}

// ── the one claude -p run per card ───────────────────────────────────────────

function writeProposal(
  card: BoardRow,
  dir: string,
  company: Company,
  deadline: string | undefined,
): { ok: boolean; error?: string } {
  const abs = join(REPO, dir);
  const prompt = `You are drafting a bid for ${company.legalName} (Rwanda, TIN ${company.tin}), a software company. Write the technical proposal for ONE tender.

Read these files first:
- ${abs}/posting.txt — the tender notice (and, where short, the card's own notes). This is the ONLY source for what the buyer wants.
- ${DATA_ABS}/profile.json — "company" (legal facts) and "identity"; the only source for facts about the company and its director.
- ${DATA_ABS}/evidence/career.json if present — the verified career record of the director.
- ${DATA_ABS}/packets/2026-11-04-seefar-chatbot/proposal.md — a proposal Abdout already approved: mirror its tone, structure, plain sentences and its "relevant work" paragraphs (those claims are vetted; reuse them).

${company.legalName}'s registered activities (ISIC): ${company.activities.map((a) => `${a.code} ${a.label}`).join(", ")}. Registered in ${company.country} on ${company.registered}. Director: ${company.director}.
Work you may cite, and nothing beyond it (profile.json → company.portfolio): ${(company.portfolio ?? []).join("; ") || "[to confirm]"}. Websites: ${company.website}.

TRUTH RULE (absolute): never invent clients, contract values, certifications, staff names, headcount, years in business, awards or past contracts. Use only what the files above state. The company is a new entity (registered ${company.registered}); do not claim a company track record, describe the products as built by the company's team and the director's own work. Every unknown (team members beyond the director, prices, day rates, references, bid validity if the notice does not say) becomes the literal text [to confirm]. Never write a final price: the financial proposal is a skeleton whose amounts are all [to confirm].

Write TWO files with the Write tool, nothing else:

1. ${abs}/proposal.md — in plain English, no em dashes, no hype. Sections: a title line "# Technical proposal: <tender name>"; a header block (To: buyer, From: ${company.legalName} with TIN and office, Date: [to confirm], Valid for: [to confirm or what the notice states]); 1. Cover letter (short, from the company, signed by the director); 2. The firm (legal facts, activities, TIN, what we build, relevant work from the products above); 3. Our understanding of the assignment (from the notice, specific); 4. Approach and methodology (deliverable by deliverable, concrete); 5. Workplan and timeline (a table; durations marked [to confirm] where the notice gives none); 6. Team (the director; every other role [to confirm]); 7. Relevant experience (products above, honest that the company is newly registered); 8. Financial proposal skeleton (a table of lines with every amount [to confirm], currency and tax treatment per the notice); 9. Declarations the notice asks for (as [to sign] lines). Keep it under about 4 pages.

2. ${abs}/meta.json — exactly this JSON, read from the notice:
{"buyer":"<procuring entity>","tenderNo":"<tender reference or empty>","submitHow":"<how and where to submit: email address / Umucyo portal / physical address and the format, as the notice says>","dossierLink":"<URL of the tender document if the notice names one, else empty>","eligibility":[{"item":"<one requirement the notice sets for bidders: registration, tax clearance, RSSB, bid security, experience, turnover, staff, site visit, etc.>","status":"held|missing|unclear","evidence":"<short>"}],"unknowns":["<each [to confirm] the director must fill, most important first>"]}
Mark "held" only for: RDB / company registration certificate and TIN. Mark "missing" for: RRA tax clearance, RSSB clearance, bid security or guarantee, Umucyo bidder registration, audited accounts, past contracts of a stated size or number of years. Everything else the notice requires: "unclear" unless it is plainly met by the facts above. If the notice states no requirements, give an empty list.
Output nothing else.`;
  const res = spawnSync(
    KUN_CLAUDE,
    [
      "-p",
      prompt,
      "--allowedTools",
      "Read",
      "Write",
      "Glob",
      "Grep",
      "--max-turns",
      "30",
    ],
    { encoding: "utf-8", timeout: 20 * 60_000, cwd: REPO },
  );
  if (res.status !== 0 || !existsSync(`${abs}/proposal.md`))
    return {
      ok: false,
      error: `claude -p exited ${res.status}: ${(res.stderr || res.stdout || "").slice(0, 200)}`,
    };
  void deadline;
  return { ok: true };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const profile = loadProfile();
  const company = profile.company;
  if (!company?.legalName || !company.tin) {
    console.error(
      "profile.json has no company block (legalName, tin) — add it, see profile.example.json",
    );
    return 77;
  }
  const { date: today } = kigaliNow();

  let board: BoardRow[];
  try {
    board = await listBoard();
  } catch (err) {
    console.error(
      `board unreachable: ${err instanceof Error ? err.message : err}`,
    );
    return 75;
  }

  const open = board
    .filter((r) =>
      ONLY_ID
        ? r.id === ONLY_ID
        : BID_CAMPAIGNS.includes(r.campaign ?? "") &&
          isContractCampaign(r.campaign),
    )
    .filter((r) => ONLY_ID || OPEN_STATUS.includes(r.applicationStatus ?? ""))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));

  type Row = { card: string; verdict: string; why: string; packet: string };
  const table: Row[] = [];
  let made = 0;
  let failed = 0;
  let deferred = 0;
  let outCount = 0;

  for (const card of open) {
    const name = splitName(card.name).role.replace(/\s+/g, " ").slice(0, 58);
    const deadline = card.deadline?.slice(0, 10);
    const reason = card.holdReason ?? "";

    if (!ONLY_ID) {
      if (/^bid ready/i.test(reason)) continue;
      if (/^outside databayt/i.test(reason)) {
        outCount++;
        continue;
      }
      if (deadline && daysFromToday(deadline, today) < MIN_DAYS) continue;
    }

    const url = card.jobUrl?.primaryLinkUrl ?? "";
    const title = card.name;

    // A job posting filed under an engineering lane is not a tender.
    if (
      card.campaign === "ENGINEERING_CONTRACT" &&
      (JOB_HOSTS.test(url) || !TENDERISH.test(title))
    ) {
      const t: Triage = { verdict: "OUT", why: "a job posting, not a tender" };
      table.push({ card: name, verdict: "OUT", why: t.why, packet: "-" });
      outCount++;
      if (!DRY)
        await hold(card, `outside Databayt's registered activities — ${t.why}`);
      continue;
    }

    let text = await postingText(url && !/umucyo/.test(url) ? url : undefined);
    const own = [card.name, card.assessment?.markdown ?? ""].join("\n");
    const tri = triage(title, text ?? own);
    if (tri.verdict === "OUT") {
      table.push({ card: name, verdict: "OUT", why: tri.why, packet: "-" });
      outCount++;
      if (!DRY)
        await hold(
          card,
          `outside Databayt's registered activities — ${tri.why}`,
        );
      continue;
    }

    if (made >= LIMIT) {
      table.push({
        card: name,
        verdict: "IN",
        why: "over --limit, next run",
        packet: "-",
      });
      continue;
    }
    const have = existingPacket(card.id);
    if (have && !ONLY_ID) {
      table.push({
        card: name,
        verdict: "IN",
        why: "packet already exists",
        packet: have,
      });
      continue;
    }

    if (!text || text.length < 200) text = own.length > 120 ? own : null;
    if (!text) {
      table.push({
        card: name,
        verdict: "IN",
        why: "posting unreachable — retry next run",
        packet: "-",
      });
      deferred++;
      continue;
    }

    const dir =
      have ??
      `${BIDS_DIR}/${deadline ?? "nodate"}-${slugify(splitName(card.name).role) || card.id.slice(0, 8)}`;
    mkdirSync(join(REPO, dir), { recursive: true });
    const links = await dossierLinks(url);
    writeFileSync(
      join(REPO, dir, "posting.txt"),
      `${card.name}\nNotice: ${url}\nDeadline on the card: ${deadline ?? "none"}\n${links.length ? `Links on the notice: ${links.join(" ")}\n` : ""}\n${text.slice(0, 20000)}\n${dossierText(links)}`,
    );

    console.log(`  drafting  ${name} …`);
    const run = writeProposal(card, dir, company, deadline);
    if (!run.ok) {
      failed++;
      table.push({
        card: name,
        verdict: "IN",
        why: `draft failed: ${run.error}`,
        packet: dir,
      });
      if (!DRY)
        ledger({
          kind: "error",
          crmId: card.id,
          name: card.name,
          campaign: card.campaign,
          detail: `bid draft: ${run.error}`,
        });
      continue;
    }

    let meta: Meta = {};
    try {
      meta = JSON.parse(
        readFileSync(join(REPO, dir, "meta.json"), "utf-8"),
      ) as Meta;
    } catch {
      meta = {};
    }
    const md = readFileSync(join(REPO, dir, "proposal.md"), "utf-8");
    const title1 = md.match(/^#\s+(.*)/m)?.[1] ?? "Technical proposal";
    const html = `<!doctype html><html lang=en><head><meta charset=utf-8><title>${esc(title1)}</title><style>${CSS}</style></head><body>${mdToHtml(md)}</body></html>`;
    writeFileSync(join(REPO, dir, "proposal.html"), html);
    const pages = await writePdf(html, join(REPO, dir, "proposal.pdf"));
    writeFileSync(
      join(REPO, dir, "README.md"),
      readme(card, meta, dir, deadline, links, tri, company.tin),
    );
    console.log(`  packet    ${dir} (${pages} pages)`);

    made++;
    table.push({ card: name, verdict: "IN", why: tri.why, packet: dir });
    if (!DRY) {
      const reasonText = `bid ready — submit by ${deadline ?? "the date in the notice"} — ${dir}`;
      await noteRow(
        card.id,
        `bid packet written: ${dir}. Review, sign, submit; then jobs:mark applied.`,
        {
          applicationStatus: "HOLD",
          holdReason: reasonText,
        },
      );
      ledger({
        kind: "hold",
        crmId: card.id,
        name: card.name,
        campaign: card.campaign,
        detail: reasonText,
      });
    }
  }

  console.log(
    `\nbid ${DRY ? "(dry run) " : ""}— ${made} packet(s), ${outCount} out of scope, ${deferred} deferred, ${failed} failed\n`,
  );
  for (const r of table)
    console.log(
      `${r.verdict.padEnd(4)} ${r.card.padEnd(60)} ${r.why.slice(0, 70).padEnd(72)} ${r.packet}`,
    );
  if (failed) return 1;
  if (deferred && !made) return 75;
  return 0;
}

async function hold(card: BoardRow, reason: string): Promise<void> {
  await noteRow(card.id, `bid triage: ${reason}`, {
    applicationStatus: "HOLD",
    holdReason: reason,
  });
  ledger({
    kind: "hold",
    crmId: card.id,
    name: card.name,
    campaign: card.campaign,
    detail: reason,
  });
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
