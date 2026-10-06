#!/usr/bin/env tsx
// ── Prepare today's wave: pick → tailor → gate → QUEUED or HOLD ──────────────
//
//   pnpm jobs:wave                 prepare today's wave (writes the board)
//   pnpm jobs:wave --dry-run       tailor + gate, print verdicts, write nothing to the board
//   pnpm jobs:wave --limit 3       smaller batch
//   pnpm jobs:wave --regate        re-run the gate on existing letters (after a CV/facts edit)
//
// Only EMAIL cards with an applyEmail (and, since 2026-10-04, WHATSAPP cards
// with an applyPhone — same letter, sent as a message + CV) are tailored — portals, platforms and
// tenders stay packets (Abdout's rule). Letters are written by one `claude -p`
// session on the Max subscription, answers passed through files (the
// drain-drafts pattern), then every letter goes through the send gate. A card
// that fails is put on HOLD with the reason; nothing reaches QUEUED ungated.

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

import { similarRole } from "@/lib/jobs/deduplication";
import { evaluateSendGate, holdReasonFor } from "@/lib/jobs/send-gate";

import { BoardRow, ledger, listBoard, patchRow } from "./board";
import { kigaliNow, LANE_BAND, loadConfig, seniorityBand, todaysCap } from "./config";
import { tailorCvs, type TailorResult } from "./tailor";
import { pickVariants } from "./variants";

const TENDER_NOTICE =
  /tender|expression of interest|\beoi\b|request for (proposal|quotation)|\brf[pq]\b|terms of reference|^notice for|supply,? delivery|construction and commissioning|\((works|goods|services)\)|procurement of/i;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REGATE = args.includes("--regate");
const limitArg = args.indexOf("--limit");


export { postingText, splitName } from "./lib/posting";
import { postingText, splitName } from "./lib/posting";

function letterExists(crmId: string): boolean {
  if (!existsSync("jobs/outbox")) return false;
  return readdirSync("jobs/outbox").some((w) => existsSync(join("jobs/outbox", w, `${crmId}.letter.json`)));
}

export function pdfPages(path: string): number {
  if (!existsSync(path)) return 0;
  return (
    readFileSync(path)
      .toString("latin1")
      .match(/\/Type\s*\/Page[^s]/g) ?? []
  ).length;
}

/// Anything sent to the same company or mail domain in the last 30 days.
/// Contact with the same company (or its mail domain) that has already gone
/// out. The same role within 30 days is a repeat — HOLD. A different role at
/// the same company is legitimate but waits a day, so one employer never gets
/// several applications in one sitting.
export function contactState(
  row: BoardRow,
  all: BoardRow[],
  now = Date.now(),
): "repeat" | "wait" | null {
  const { company, role } = splitName(row.name);
  const domain = row.applyEmail?.split("@")[1];
  const freeMail = /gmail|hotmail|outlook|yahoo|qq\.com|icloud/i;
  let state: "repeat" | "wait" | null = null;
  for (const o of all) {
    if (o.id === row.id || !o.appliedAt) continue;
    const age = now - new Date(o.appliedAt).getTime();
    const sameCompany =
      splitName(o.name).company.toLowerCase() === company.toLowerCase() ||
      (!!domain && !freeMail.test(domain) && o.applyEmail?.split("@")[1] === domain);
    if (!sameCompany) continue;
    if (similarRole(splitName(o.name).role, role) && age < 30 * 86_400_000) return "repeat";
    if (age < 86_400_000) state = "wait";
  }
  return state;
}

/// Subjects copied out of a posting can arrive URL-encoded ("Forum+Freelancer").
export function cleanSubject(subject: string): string {
  return subject.replace(/(\w)\+(?=\w)/g, "$1 ").replace(/%20/g, " ").replace(/\s+/g, " ").trim();
}

interface Request {
  crmId: string;
  role: string;
  company: string;
  to: string;
  postingUrl: string;
  postingText: string;
  lane: string;
  template: string;
  cvVariant: string;
  letterVariant: string;
  cvPdf: string;
  /// The tailored CV's content (tailor.ts) — the letter stresses the same points.
  cvJson?: string;
  out: string;
}

function tailor(dir: string, requests: Request[]): void {
  const pending = requests.filter((r) => !existsSync(r.out));
  if (pending.length === 0) return;
  const prompt = `You write job application emails for Osman Abdout. Work ONLY from files.

For each request file listed below:
1. Read it (JSON: role, company, to, postingText, template path, lane, cvJson). If cvJson is set, read it too: it is the CV tailored to this posting and attached to the email — the letter must stress the same two or three points, never repeat the CV line by line.
2. Read the template it names and /Users/abdout/kun/jobs/facts.json.
3. Write the letter to the path in its "out" field as JSON:
   {"to": <the request's "to">, "subject": <a subject line: use the exact subject the posting asks for if it states one, else "Application – <role> – Osman Abdout">, "body": <plain-text email body>}

Hard rules — a mechanical gate rejects the letter otherwise:
- Every number, year, date and credential you write must appear in facts.json or in the posting text. Never invent experience, years, certificates or results.
- No brackets, braces, placeholders, TODO, or notes to the reader. 120-350 words.
- Name the company and the exact role. Match the posting's language (Arabic posting → Arabic letter).
- If the posting asks for something only Osman can supply (salary expectation, certified copies, a form), still write the letter without it — do not invent it.
- Plain text, no markdown. Sign: Osman Abdout, +250 780 984 777, osmanabdout@hotmail.com

Request files:
${pending.map((r) => join(dir, `${r.crmId}.request.json`)).join("\n")}

When every "out" file is written, reply DONE.`;
  console.log(`tailoring ${pending.length} letter(s) with claude -p …`);
  const res = spawnSync(
    "claude",
    [
      "-p",
      prompt,
      "--allowedTools",
      "Read",
      "Write",
      "Glob",
      "--max-turns",
      String(12 * pending.length + 10),
    ],
    {
      encoding: "utf-8",
      timeout: 20 * 60_000,
    },
  );
  if (res.status !== 0)
    console.log(
      `claude -p exited ${res.status}: ${(res.stderr || res.stdout).slice(0, 300)}`,
    );
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const { date } = kigaliNow();
  const dir = `jobs/outbox/${date}`;
  mkdirSync(dir, { recursive: true });

  const facts = JSON.parse(readFileSync("jobs/facts.json", "utf-8")) as {
    numbers: string[];
  };
  const board = await listBoard();
  const limit =
    limitArg > -1 ? Number(args[limitArg + 1]) : todaysCap(cfg, date) * 2;

  const candidates = board
    .filter((r) =>
      REGATE
        ? r.applicationStatus === "QUEUED"
        : r.applicationStatus === "TO_APPLY" ||
          // Abdout approved a held card that never got a letter (e.g. a
          // speculative send to a general inbox): write it now.
          (r.applicationStatus === "APPROVED" && !existsSync(join(dir, `${r.id}.letter.json`)) && !letterExists(r.id)),
    )
    .filter((r) => (r.channel === "EMAIL" && r.applyEmail) || (r.channel === "WHATSAPP" && r.applyPhone))
    // A tender wants a bid, not a cover letter — even when it names an address.
    .filter((r) => r.applicationStatus === "APPROVED" || !TENDER_NOTICE.test(r.name))
    .filter((r) => r.applicationStatus === "APPROVED" || !cfg.pausedLanes.includes(r.campaign ?? ""))
    .filter((r) => !r.deadline || r.deadline.slice(0, 10) >= date)
    .sort(
      (a, b) =>
        (LANE_BAND[a.campaign ?? ""] ?? 9) - (LANE_BAND[b.campaign ?? ""] ?? 9) ||
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
        seniorityBand(a.name) - seniorityBand(b.name) ||
        (b.engineScore ?? 0) - (a.engineScore ?? 0),
    )
    .slice(0, limit);

  console.log(
    `${DRY_RUN ? "DRY RUN — " : ""}wave ${date}: ${candidates.length} email/WhatsApp card(s) to prepare\n`,
  );
  if (candidates.length === 0) return;

  const requests: Request[] = [];
  const texts = new Map<string, string | null>();
  for (const row of candidates) {
    const { role, company } = splitName(row.name);
    const { lane, cv, letter } = pickVariants(row.campaign, role, row.source);
    const url = row.jobUrl?.primaryLinkUrl ?? "";
    const text = await postingText(url);
    texts.set(row.id, text);
    if (!cv?.pdf || !letter?.template) {
      console.log(`  ! no active variant for ${lane} — ${row.name}`);
      continue;
    }
    const req: Request = {
      crmId: row.id,
      role,
      company,
      to: (row.channel === "WHATSAPP" ? row.applyPhone : row.applyEmail) as string,
      postingUrl: url,
      postingText: (text ?? "").slice(0, 8000),
      lane,
      template: join("/Users/abdout/kun", letter.template),
      cvVariant: cv.id,
      letterVariant: letter.id,
      cvPdf: cv.pdf,
      out: join("/Users/abdout/kun", dir, `${row.id}.letter.json`),
    };
    writeFileSync(
      join(dir, `${row.id}.request.json`),
      JSON.stringify(req, null, 2),
    );
    requests.push(req);
  }

  // A CV tailored to each posting (Abdout, 2026-10-06). A CV that fails its
  // fact gate falls back to the lane CV; one that covers too little of the
  // posting holds the card below.
  const cvs: Map<string, TailorResult> = await tailorCvs(
    requests.map((r) => candidates.find((c) => c.id === r.crmId) as BoardRow),
    { dir, texts },
  );
  for (const req of requests) {
    const t = cvs.get(req.crmId);
    if (t?.ok && t.pdf) {
      req.cvPdf = t.pdf;
      req.cvVariant = `cv:tailored@${req.crmId}`;
      req.cvJson = join("/Users/abdout/kun", dir, req.crmId, "cv.json");
      writeFileSync(join(dir, `${req.crmId}.request.json`), JSON.stringify(req, null, 2));
    } else if (t) {
      console.log(`  · lane CV for ${req.company} — tailored CV failed: ${t.problems.join("; ").slice(0, 200)}`);
    }
  }

  tailor(dir, requests);

  let queued = 0;
  let held = 0;
  for (const req of requests) {
    const row = candidates.find((r) => r.id === req.crmId) as BoardRow;
    let verdict;
    if (!existsSync(req.out)) {
      verdict = {
        pass: false,
        hard: ["no letter was written"],
        needs: [] as string[],
      };
    } else {
      const letter = JSON.parse(readFileSync(req.out, "utf-8")) as {
        to: string;
        subject: string;
        body: string;
      };
      if (cleanSubject(letter.subject) !== letter.subject) {
        letter.subject = cleanSubject(letter.subject);
        writeFileSync(req.out, JSON.stringify(letter, null, 2));
      }
      verdict = evaluateSendGate({
        channel: row.channel === "WHATSAPP" ? "whatsapp" : "email",
        letter,
        company: req.company,
        role: req.role,
        postingText: texts.get(req.crmId) ?? null,
        deadline: row.deadline?.slice(0, 10) ?? null,
        today: date,
        recentlyContacted: contactState(row, board) === "repeat",
        allowedNumbers: facts.numbers,
        attachment: {
          exists: existsSync(req.cvPdf),
          pages: pdfPages(req.cvPdf),
        },
      });
    }
    const fit = cvs.get(req.crmId);
    if (verdict.pass && fit?.ok && fit.weakFit)
      verdict = {
        pass: false,
        hard: [`weak fit (${fit.coverage}% of the posting's must-haves): missing ${fit.missing.join(", ")}`],
        needs: [] as string[],
      };
    const variant = `${req.cvVariant} ${req.letterVariant}`;
    const reason = holdReasonFor(verdict);
    console.log(
      `  ${verdict.pass ? (row.applicationStatus === "APPROVED" ? "✓ APPROVED" : "✓ QUEUED") : "✗ HOLD  "}  ${row.name.slice(0, 60)}${verdict.pass ? "" : `\n              ${reason}`}`,
    );
    if (DRY_RUN) continue;
    if (verdict.pass) {
      await patchRow(row.id, {
        applicationStatus: row.applicationStatus === "APPROVED" ? "APPROVED" : "QUEUED",
        variant,
        waveId: date,
        holdReason: "",
      });
      ledger({
        kind: "queued",
        crmId: row.id,
        name: row.name,
        campaign: row.campaign,
        variant,
        waveId: date,
      });
      queued++;
    } else {
      await patchRow(row.id, {
        applicationStatus: "HOLD",
        variant,
        waveId: date,
        holdReason: reason.slice(0, 480),
      });
      ledger({
        kind: "hold",
        crmId: row.id,
        name: row.name,
        campaign: row.campaign,
        variant,
        waveId: date,
        detail: reason,
      });
      held++;
    }
  }
  console.log(
    DRY_RUN
      ? "\nDRY RUN — board untouched."
      : `\nwave ${date}: ${queued} queued, ${held} on hold. Letters in ${dir}/`,
  );
}

if (process.argv[1]?.endsWith("wave.ts")) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

