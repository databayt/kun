#!/usr/bin/env tsx
// ── The ATS lane: prepare and submit hosted application forms ────────────────
//
//   pnpm jobs:ats prepare [--limit n]            answers + cover letter + gate → QUEUED/HOLD
//   pnpm jobs:ats submit                          dry run: fill + screenshot, no submit
//   pnpm jobs:ats submit --apply --limit n        fill + submit (the loop)
//   pnpm jobs:ats submit --apply --id <crm-id> --headed   one card, visible browser
//
// Abdout's decision (2026-09-27): portals may be auto-submitted to reach
// ~100 applications a day. Everything a form says comes from
// jobs/profile.json (ats-answers.ts) or from text the wave wrote and the gate
// checked; a question nothing can answer truthfully holds the card. Greenhouse
// first; Lever and Ashby cards wait for their submitters.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

import {
  answerQuestion,
  AtsProfile,
  AtsQuestion,
  Answer,
} from "@/lib/jobs/ats-answers";
import {
  evaluateSendGate,
  holdReasonFor,
  numbersIn,
} from "@/lib/jobs/send-gate";

import {
  BoardRow,
  getRow,
  ledger,
  listBoard,
  noteRow,
  patchRow,
} from "./board";
import { kigaliNow, killSwitchOn, LANE_BAND, loadConfig, seniorityBand } from "./config";
import {
  fillGreenhouse,
  greenhouseQuestions,
  parseGreenhouse,
  submitGreenhouse,
} from "./ats-greenhouse";
import { ashbyQuestions, fillAshby, parseAshby, submitAshby } from "./ats-ashby";
import { leverQuestions } from "./ats-lever";
import { sentToday } from "./send";
import { pickVariants } from "./variants";
import { contactState, pdfPages, postingText, splitName } from "./wave";

const args = process.argv.slice(2);
const verb = args[0];
const APPLY = args.includes("--apply");
const HEADED = args.includes("--headed");
const NOW = args.includes("--now");
const opt = (f: string) =>
  args.indexOf(f) > -1 ? args[args.indexOf(f) + 1] : undefined;

const profile = JSON.parse(
  readFileSync("jobs/profile.json", "utf-8"),
) as AtsProfile;
const facts = JSON.parse(readFileSync("jobs/facts.json", "utf-8")) as {
  numbers: string[];
};

type Provider = "greenhouse" | "ashby" | "lever";

/// Which hosted form a card's apply URL is. Lever waits for its submitter.
const providerOf = (r: BoardRow): Provider | null =>
  !r.applyUrl
    ? null
    : /greenhouse\.io\/embed\/job_app/.test(r.applyUrl)
      ? "greenhouse"
      : /jobs\.ashbyhq\.com\//.test(r.applyUrl)
        ? "ashby"
        : /jobs\.lever\.co\//.test(r.applyUrl)
          ? "lever"
          : null;
const isGreenhouse = (r: BoardRow) => providerOf(r) !== null;

async function questionsFor(r: BoardRow): Promise<AtsQuestion[] | null> {
  const url = r.applyUrl as string;
  if (providerOf(r) === "greenhouse") {
    const gh = parseGreenhouse(url);
    return gh ? greenhouseQuestions(gh.token, gh.id) : null;
  }
  if (providerOf(r) === "lever") return leverQuestions(url);
  const a = parseAshby(url);
  return a ? ashbyQuestions(a.org, a.id) : null;
}

interface AtsRequest {
  crmId: string;
  role: string;
  company: string;
  postingUrl: string;
  postingText: string;
  template: string;
  cvVariant: string;
  letterVariant: string;
  cvPdf: string;
  prose: string[]; // question labels needing written answers
  out: string;
}

interface AtsLetter {
  body: string; // the cover letter
  answers?: Record<string, string>;
}

// ── prepare ──────────────────────────────────────────────────────────────────

function plan(
  questions: AtsQuestion[],
  ctx: { company: string; role: string },
) {
  const answers = new Map<string, { question: AtsQuestion; answer: Answer }>();
  const missing: string[] = [];
  for (const q of questions) {
    const a = answerQuestion(q, profile, ctx);
    if (a === null) {
      if (q.required) missing.push(q.label.slice(0, 100));
      continue;
    }
    answers.set(q.fields[0]?.name ?? q.label, { question: q, answer: a });
  }
  return { answers, missing };
}

/// One claude -p session asked for 17 letters wrote 2 and said DONE
/// (2026-09-28). Batches of 4, three sessions at a time, then one retry pass
/// for whatever is still missing.
async function tailor(dir: string, requests: AtsRequest[]): Promise<void> {
  for (let pass = 1; pass <= 2; pass++) {
    const pending = requests.filter((r) => !existsSync(r.out));
    if (pending.length === 0) return;
    const batches: AtsRequest[][] = [];
    for (let i = 0; i < pending.length; i += 4) batches.push(pending.slice(i, i + 4));
    console.log(`writing ${pending.length} cover letter(s) + answers with claude -p — ${batches.length} batch(es), pass ${pass} …`);
    let next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      for (let b = batches[next++]; b; b = batches[next++]) await tailorBatch(dir, b);
    }));
  }
  const missing = requests.filter((r) => !existsSync(r.out)).length;
  if (missing) console.log(`${missing} letter(s) still missing after two passes`);
}

function tailorBatch(dir: string, pending: AtsRequest[]): Promise<void> {
  const prompt = `You write job applications for Osman Abdout. Work ONLY from files.

For each request file listed below:
1. Read it (JSON: role, company, postingText, template path, prose = form questions needing a written answer).
2. Read the template and /Users/abdout/kun/jobs/facts.json.
3. Write JSON to the request's "out" path:
   {"body": <a cover letter, plain text, 150-300 words, following the template>,
    "answers": {<each prose question, verbatim, as key>: <a direct answer, 40-150 words, plain text>}}

Hard rules — a mechanical gate rejects the file otherwise:
- Every number, year, date and credential must appear in facts.json or the posting text. Never invent experience, clients, results or years.
- No brackets, braces, placeholders or notes to the reader.
- Name the company and the exact role in the cover letter. Where a form allows links, the profile supplies them — do not paste URLs into the letter except github.com/abdout and databayt.org.
- Sign the letter: Osman Abdout.

Request files:
${pending.map((r) => join(dir, `${r.crmId}.ats-request.json`)).join("\n")}

When every "out" file is written, reply DONE.`;
  return new Promise((resolve) => {
    const child = spawn(
      "claude",
      ["-p", prompt, "--allowedTools", "Read", "Write", "Glob", "--max-turns", String(10 * pending.length + 10)],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.stdout.resume();
    const timer = setTimeout(() => child.kill(), 20 * 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) console.log(`claude -p exited ${code}: ${err.slice(0, 300)}`);
      resolve();
    });
  });
}

const PLACEHOLDER = /[[\]{}]|\bTODO\b|\bTBD\b|lorem ipsum/i;

async function prepare(): Promise<void> {
  const cfg = loadConfig();
  const { date } = kigaliNow();
  const dir = `jobs/outbox/${date}`;
  mkdirSync(dir, { recursive: true });
  const board = await listBoard();
  const limit = Number(opt("--limit") ?? 60);

  const cards = board
    .filter(
      (r) =>
        r.applicationStatus === "TO_APPLY" &&
        r.channel === "ATS" &&
        isGreenhouse(r),
    )
    .filter((r) => !cfg.pausedLanes.includes(r.campaign ?? ""))
    .sort(
      (a, b) =>
        (LANE_BAND[a.campaign ?? ""] ?? 9) -
          (LANE_BAND[b.campaign ?? ""] ?? 9) ||
        seniorityBand(a.name) - seniorityBand(b.name) ||
        (b.engineScore ?? 0) - (a.engineScore ?? 0),
    )
    .slice(0, limit);
  console.log(`ATS prepare ${date}: ${cards.length} ATS card(s) (Greenhouse + Ashby)\n`);

  const requests: AtsRequest[] = [];
  const plans = new Map<string, ReturnType<typeof plan>>();
  const texts = new Map<string, string | null>();
  for (const row of cards) {
    const { role, company } = splitName(row.name);
    const questions = await questionsFor(row);
    if (!questions) {
      await patchRow(row.id, {
        applicationStatus: "HOLD",
        holdReason: "ATS: job no longer on the board (closed?)",
      });
      console.log(`  ✗ HOLD  ${row.name.slice(0, 60)} — closed`);
      continue;
    }
    const p = plan(questions, { company, role });
    // Packet providers (Ashby, Lever) are submitted by Abdout: an unanswerable
    // question is flagged in the packet for him, not a reason to stop.
    if (p.missing.length && providerOf(row) === "greenhouse") {
      const reason = `ATS form asks what the profile can't answer truthfully: ${p.missing.map((m) => `"${m}"`).join("; ")}`;
      await patchRow(row.id, {
        applicationStatus: "HOLD",
        holdReason: reason.slice(0, 480),
      });
      ledger({
        kind: "hold",
        crmId: row.id,
        name: row.name,
        campaign: row.campaign,
        detail: reason,
      });
      console.log(
        `  ✗ HOLD  ${row.name.slice(0, 60)}\n          ${reason.slice(0, 160)}`,
      );
      continue;
    }
    plans.set(row.id, p);
    const text = await postingText(row.jobUrl?.primaryLinkUrl);
    texts.set(row.id, text);
    const { cv, letter } = pickVariants(row.campaign, role, row.source);
    if (!cv?.pdf || !letter?.template) continue;
    const req: AtsRequest = {
      crmId: row.id,
      role,
      company,
      postingUrl: row.jobUrl?.primaryLinkUrl ?? "",
      postingText: (text ?? "").slice(0, 8000),
      template: join("/Users/abdout/kun", letter.template),
      cvVariant: cv.id,
      letterVariant: letter.id,
      cvPdf: cv.pdf,
      prose: [...p.answers.values()]
        .filter((x) => x.answer.kind === "prose")
        .map((x) => x.question.label),
      out: join("/Users/abdout/kun", dir, `${row.id}.ats-letter.json`),
    };
    writeFileSync(
      join(dir, `${row.id}.ats-request.json`),
      JSON.stringify(req, null, 2),
    );
    requests.push(req);
  }

  await tailor(dir, requests);

  let queued = 0;
  for (const req of requests) {
    const row = cards.find((r) => r.id === req.crmId) as BoardRow;
    let reason = "";
    if (!existsSync(req.out)) reason = "no cover letter was written";
    else {
      const l = JSON.parse(readFileSync(req.out, "utf-8")) as AtsLetter;
      const v = evaluateSendGate({
        channel: "ats",
        letter: { to: "", subject: "", body: l.body },
        company: req.company,
        role: req.role,
        postingText: texts.get(req.crmId) ?? null,
        today: date,
        recentlyContacted: contactState(row, board) === "repeat",
        allowedNumbers: facts.numbers,
        attachment: {
          exists: existsSync(req.cvPdf),
          pages: pdfPages(req.cvPdf),
        },
      });
      const problems = [...v.hard, ...v.needs.map((n) => `needs ${n}`)];
      // The written answers face the same two checks that matter for them.
      const allowed = new Set([
        ...facts.numbers,
        ...numbersIn(texts.get(req.crmId) ?? ""),
      ]);
      for (const q of req.prose) {
        const a = l.answers?.[q];
        if (!a) problems.push(`no answer written for "${q.slice(0, 60)}"`);
        else if (PLACEHOLDER.test(a))
          problems.push(`placeholder in answer to "${q.slice(0, 60)}"`);
        else {
          const bad = numbersIn(a.replace(/250\s?780\s?984\s?777/, "")).filter(
            (n) => !allowed.has(n),
          );
          if (bad.length)
            problems.push(`unbacked numbers in an answer: ${bad.join(", ")}`);
        }
      }
      reason = problems.join("; ");
    }
    const variant = `${req.cvVariant} ${req.letterVariant}`;
    if (reason) {
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
        detail: reason,
      });
      console.log(
        `  ✗ HOLD  ${row.name.slice(0, 60)}\n          ${reason.slice(0, 160)}`,
      );
    } else if (providerOf(row) !== "greenhouse") {
      // Packet providers never auto-submit: hand Abdout the packet today
      // instead of queueing a card the submitter would bounce two hours later.
      // A failed form fetch must not stop the run: queue the card instead, and
      // the submitter writes the packet on its next tick.
      const found = findAts(row.id);
      let held = false;
      if (found) {
        try {
          await packetHold({ ...row, variant, waveId: date } as BoardRow, found, true);
          held = true;
        } catch (err) {
          console.log(`  · packet deferred ${row.name.slice(0, 50)} — ${(err as Error).message.slice(0, 60)}`);
        }
      }
      await patchRow(row.id, { variant, waveId: date, ...(held ? {} : { applicationStatus: "QUEUED", holdReason: "" }) });
      if (!held) ledger({ kind: "queued", crmId: row.id, name: row.name, campaign: row.campaign, variant, waveId: date });
    } else {
      await patchRow(row.id, {
        applicationStatus: "QUEUED",
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
      console.log(`  ✓ QUEUED ${row.name.slice(0, 60)}`);
      queued++;
    }
  }
  console.log(`\nATS prepare: ${queued} queued`);
}

// ── submit ───────────────────────────────────────────────────────────────────

async function coverLetterPdf(
  body: string,
  out: string,
  browser: Awaited<ReturnType<typeof chromium.launch>>,
): Promise<void> {
  const page = await browser.newPage();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  await page.setContent(
    `<html><body style="font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.5;margin:48pt">${body
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("")}</body></html>`,
  );
  writeFileSync(out, await page.pdf({ format: "A4" }));
  await page.close();
}

/// Ashby's reCAPTCHA flags automated submissions as spam and Lever runs
/// hCaptcha (2026-09-27); the rule is CAPTCHA/bot block → HOLD, never evade.
/// Leave a paste-ready packet so Abdout submits in two minutes.
async function packetHold(
  row: BoardRow,
  found: { dir: string; req: AtsRequest; letter: AtsLetter },
  apply: boolean,
): Promise<void> {
  const { role, company } = splitName(row.name);
  const qs = await questionsFor(row);
  const lines = [
    `# ${row.name}`,
    "",
    `Form: ${row.applyUrl}`,
    `CV: ${found.req.cvPdf}  ·  Cover letter below (paste, or attach ${join(found.dir, row.id, "Osman_Abdout_Cover_Letter.pdf")} after a dry run)`,
    "",
    "## Answers, field by field",
  ];
  for (const q of qs ?? []) {
    const a = answerQuestion(q, profile, { company, role });
    const v =
      !a ? "⚠ decide yourself" :
      a.kind === "text" ? a.value :
      a.kind === "select" ? a.option :
      a.kind === "multi" ? a.options.join(", ") :
      a.kind === "check" ? (a.value ? "Yes" : "No") :
      a.kind === "file" ? (a.which === "resume" ? "attach the CV" : "attach the cover letter") :
      a.kind === "prose" ? (found.letter.answers?.[q.label] ?? "⚠ not written") :
      "(skip)";
    lines.push("", `**${q.label}**${q.required ? " *" : ""}`, "", v);
  }
  lines.push("", "## Cover letter", "", found.letter.body);
  mkdirSync("jobs/packets/ats", { recursive: true });
  const packet = `jobs/packets/ats/${row.id}.md`;
  writeFileSync(packet, lines.join("\n") + "\n");
  if (apply) {
    await patchRow(row.id, {
      applicationStatus: "HOLD",
      holdReason: `${providerOf(row) === "lever" ? "Lever (hCaptcha)" : "Ashby (spam filter)"} blocks automated submission — paste-ready packet: ${packet}`,
    });
    ledger({ kind: "hold", crmId: row.id, name: row.name, detail: "ashby packet" });
  }
  console.log(`  ▣ ${row.name.slice(0, 60)} — packet ${packet}`);
}

function findAts(
  crmId: string,
): { dir: string; req: AtsRequest; letter: AtsLetter } | null {
  if (!existsSync("jobs/outbox")) return null;
  for (const wave of spawnSync("ls", ["-1r", "jobs/outbox"], {
    encoding: "utf-8",
  })
    .stdout.split("\n")
    .filter(Boolean)) {
    const dir = join("jobs/outbox", wave);
    const rp = join(dir, `${crmId}.ats-request.json`);
    const lp = join(dir, `${crmId}.ats-letter.json`);
    if (existsSync(rp) && existsSync(lp)) {
      return {
        dir,
        req: JSON.parse(readFileSync(rp, "utf-8")),
        letter: JSON.parse(readFileSync(lp, "utf-8")),
      };
    }
  }
  return null;
}


// ── Greenhouse security codes, read from hotmail (Abdout's choice) ──────────
function mailIds(): Set<string> {
  const r = spawnSync("osascript", ["scripts/jobs/mail-read.applescript", profile.identity.email, "2"], { encoding: "utf-8", timeout: 120_000 });
  return new Set(
    (r.stdout ?? "").split("\x1e").map((m) => m.split("\x1f").slice(0, 3).join("|")).filter((x) => x.length > 2),
  );
}

function codeFetcher(company: string, before: Set<string>): () => Promise<string | null> {
  return async () => {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 10_000));
      spawnSync("osascript", ["-e", 'tell application "Mail" to check for new mail']);
      const r = spawnSync("osascript", ["scripts/jobs/mail-read.applescript", profile.identity.email, "2"], { encoding: "utf-8", timeout: 120_000 });
      for (const m of (r.stdout ?? "").split("\x1e")) {
        const [from, subject, date, body] = m.split("\x1f");
        if (!from || before.has(`${from}|${subject}|${date}`)) continue;
        if (!/greenhouse/i.test(from) || !/security code/i.test(subject ?? "")) continue;
        if (company && !(subject ?? "").toLowerCase().includes(company.toLowerCase().slice(0, 12))) continue;
        const code = body?.match(/application:\s*([A-Za-z0-9]{8})\b/)?.[1];
        if (code) return code;
      }
    }
    return null;
  };
}

async function submit(): Promise<void> {
  const cfg = loadConfig();
  const { date } = kigaliNow();
  if (APPLY && killSwitchOn()) {
    console.log("kill switch on — nothing submitted");
    return;
  }
  const board = await listBoard();
  const only = opt("--id");
  const total = cfg.dailyTotalCap - sentToday("sent", date, "any");
  const limit = Math.min(
    Number(opt("--limit") ?? 20),
    NOW ? 999 : Math.max(0, total),
  );
  const queuedAt = new Map<string, number>();
  if (existsSync("jobs/ledger.jsonl")) {
    for (const l of readFileSync("jobs/ledger.jsonl", "utf-8")
      .split("\n")
      .filter(Boolean)) {
      const e = JSON.parse(l) as { kind: string; crmId: string; ts: string };
      if (e.kind === "queued") queuedAt.set(e.crmId, new Date(e.ts).getTime());
    }
  }
  const ready = board
    .filter((r) => r.channel === "ATS" && isGreenhouse(r))
    .filter((r) =>
      only
        ? r.id === only
        : r.applicationStatus === "QUEUED" ||
          r.applicationStatus === "APPROVED",
    );
  console.log(
    `${APPLY ? "" : "DRY RUN (fill + screenshot) — "}${ready.length} ready · ${limit} allowed now\n`,
  );

  const browser = await chromium.launch({
    channel: "chrome",
    headless: !HEADED,
  });
  let done = 0;
  // One application per company per day, across email and ATS (a second
  // role at the same employer waits a day) — plus this run's own sends.
  const companiesThisRun = new Set<string>();
  try {
    for (const row of ready) {
      if (done >= limit) break;
      const companyKey = splitName(row.name).company.toLowerCase();
      if (!only && (companiesThisRun.has(companyKey) || contactState(row, board) === "wait")) continue;
      const fresh = await getRow(row.id);
      if (
        !only &&
        fresh.applicationStatus !== "QUEUED" &&
        fresh.applicationStatus !== "APPROVED"
      )
        continue;
      const t = queuedAt.get(row.id);
      if (
        !NOW &&
        !only &&
        fresh.applicationStatus === "QUEUED" &&
        t &&
        Date.now() - t < cfg.vetoHours * 3_600_000
      )
        continue;
      const found = findAts(row.id);
      if (found && providerOf(row) !== "greenhouse" && !args.includes("--try-ashby")) {
        await packetHold(row, found, APPLY);
        continue;
      }
      if (!found) {
        console.log(`  · ${row.name.slice(0, 60)} — not prepared`);
        continue;
      }
      const { role, company } = splitName(row.name);
      const questions = await questionsFor(row);
      if (!questions) {
        await patchRow(row.id, {
          applicationStatus: "HOLD",
          holdReason: "ATS: job closed before submission",
        });
        continue;
      }
      const p = plan(questions, { company, role });
      if (p.missing.length) {
        await patchRow(row.id, {
          applicationStatus: "HOLD",
          holdReason: `ATS form changed: ${p.missing.join("; ")}`.slice(0, 480),
        });
        continue;
      }
      // Employers see the filename: give it his name, one folder per card.
      mkdirSync(join(found.dir, row.id), { recursive: true });
      const coverPath = join(found.dir, row.id, "Osman_Abdout_Cover_Letter.pdf");
      await coverLetterPdf(found.letter.body, coverPath, browser);

      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      await page.goto(row.applyUrl as string, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      const provider = providerOf(row);
      const fill = provider === "ashby" ? fillAshby : fillGreenhouse;
      const failed = await fill(page, {
        answers: p.answers,
        prose: found.letter.answers ?? {},
        resumePath: found.req.cvPdf,
        coverLetterPath: coverPath,
        city: `${profile.identity.city}, ${profile.identity.country}`,
      });
      // With Greenhouse's country picker set to Rwanda, the phone field wants
      // the national number; the full +250 form would double the code.
      if (await page.locator('[id="country"]').count()) {
        await page.locator('[id="phone"]').fill(profile.identity.phone.replace(/^\+250/, "")).catch(() => undefined);
      }
      await page.screenshot({
        path: join(found.dir, `${row.id}.ats-filled.png`),
        fullPage: true,
      });
      console.log(
        `  ${failed.length ? "!" : "→"} ${row.name.slice(0, 64)}${failed.length ? `\n      could not fill: ${failed.join(" | ")}` : ""}`,
      );

      if (!APPLY) {
        await page.close();
        done++;
        continue;
      }
      if (failed.length) {
        await patchRow(row.id, {
          applicationStatus: "HOLD",
          holdReason: `ATS fill failed: ${failed.join("; ")}`.slice(0, 480),
        });
        ledger({
          kind: "hold",
          crmId: row.id,
          name: row.name,
          detail: failed.join("; "),
        });
        await page.close();
        continue;
      }
      const outcome =
        provider === "ashby" ? await submitAshby(page) : await submitGreenhouse(page, codeFetcher(company, mailIds()));
      await page.screenshot({
        path: join(found.dir, `${row.id}.ats-result.png`),
        fullPage: true,
      });
      await page.close();
      if (!outcome.ok) {
        await patchRow(row.id, {
          applicationStatus: "HOLD",
          holdReason: `ATS submit: ${outcome.reason}`,
        });
        ledger({
          kind: "error",
          crmId: row.id,
          name: row.name,
          detail: `ats submit: ${outcome.reason}`,
        });
        console.log(`      ✗ ${outcome.reason}`);
        continue;
      }
      const now = new Date().toISOString();
      const variant = `${found.req.cvVariant} ${found.req.letterVariant}`;
      await noteRow(row.id, `submitted via Greenhouse form (${variant})`, {
        applicationStatus: "APPLIED",
        appliedAt: now,
        lastTouchAt: now,
        touchNumber: 1,
        holdReason: "",
      });
      ledger({
        kind: "sent",
        crmId: row.id,
        name: row.name,
        campaign: row.campaign,
        variant,
        waveId: fresh.waveId ?? date,
        subject: `ATS: ${company}`,
        to: `ats:${company}`,
      });
      console.log("      ✓ submitted");
      companiesThisRun.add(companyKey);
      done++;
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${APPLY ? `submitted ${done}` : `filled ${done} (dry run)`}`);
}

if (verb === "prepare")
  prepare().catch((e: unknown) => (console.error(e), process.exit(1)));
else if (verb === "submit")
  submit().catch((e: unknown) => (console.error(e), process.exit(1)));
else {
  console.error(
    "usage: pnpm jobs:ats prepare|submit [--apply] [--limit n] [--id <crm-id>] [--headed] [--now]",
  );
  process.exit(1);
}
