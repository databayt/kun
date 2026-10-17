#!/usr/bin/env tsx
// ── Google sweep: Kigali electrical + software roles → jobs/inbox ────────────
//
//   pnpm jobs:google              search, write jobs/inbox/<date>-google.json
//   pnpm jobs:google --dry-run    search and print; nothing written
//
// Abdout, 2026-10-17: "focus on Kigali jobs, the ones that come every day in
// Google search — electrical engineer and software engineer". The fetch
// adapters in discover.mjs cover jobinrwanda and greatrwandajobs, but Google
// also surfaces boards that sit behind a bot challenge (jobs.newtimes.co.rw),
// company career pages (Zipline, BK, MTN, IHS, EUCL) and LinkedIn
// reposts. One `claude -p` session with WebSearch reads those once a day.
//
// Truth rules go into the prompt and are re-checked here: a row with no
// sourceUrl, a past deadline or an off-lane campaign never reaches ingest.
// An apply address is taken only when it is printed on the posting — the send
// gate checks that again before anything sends.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const DRY = process.argv.includes("--dry-run");
const ROOT = "/Users/abdout/kun";
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = `jobs/inbox/${TODAY}-google.json`;
const TMP = `jobs/.state/google-${TODAY}.json`;

const LANES = new Set([
  "kigali-electrical-engineer",
  "kigali-protection-engineer",
  "kigali-web-developer",
]);

interface Row {
  title: string;
  company: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  description?: string;
  sourceUrl: string;
  campaign: string;
  deadline?: string;
  applyEmail?: string;
  applyWhatsApp?: string;
}

const prompt = `You are the daily Kigali job sweep for Osman Abdout (Sudanese national resident in Kigali; electrical engineer — protection, substations, marine ETO — and full-stack TypeScript/Next.js software engineer). Today is ${TODAY}.

Use WebSearch (and WebFetch to read postings) to find job postings LOCATED IN RWANDA (Kigali or elsewhere in Rwanda) that are OPEN today, in two families:
1. Electrical: electrical engineer, power/energy engineer, protection/substation/SCADA/commissioning engineer, E&I, electromechanical, maintenance engineer, solar/renewable engineer, instrumentation.
2. Software: software engineer/developer, full-stack/front-end/back-end, web/mobile developer, DevOps, data engineer, AI/ML engineer, systems engineer.

Search the way Google surfaces them daily — run at least 10 searches, e.g. "electrical engineer job Kigali", "software engineer vacancy Rwanda", "site:jobs.newtimes.co.rw engineer", "site:jobinrwanda.com electrical", "site:greatrwandajobs.com software", "site:mucuruzi.com engineer", "site:linkedin.com/jobs Kigali software engineer", "Zipline Kigali careers", "career opportunities Kigali developer ${TODAY.slice(0, 7)}". Prefer the employer's own posting page or the board page over aggregators.

Rules — never break them:
- Only postings whose deadline is ${TODAY} or later, or with no deadline and published within the last 21 days. Read the posting to confirm; drop it if you can't.
- Drop anything restricted to Rwandan (or other) nationals/citizens, teacher/lecturer roles, purely mechanical roles, internships for current students, and tenders/procurement notices.
- applyEmail / applyWhatsApp: ONLY if printed on the posting itself as the way to apply. Never guess or construct an address.
- Never invent a deadline, company or detail. Unknown = omit the field.

Write ${ROOT}/${TMP} as a JSON array (and output nothing else), each item:
{"title": "...", "company": "...", "location": "Kigali, Rwanda", "remoteType": "onsite|hybrid|remote", "employmentType": "full_time|contract|part_time", "description": "<=600 chars from the posting: duties + requirements", "sourceUrl": "<the posting URL>", "campaign": "kigali-electrical-engineer|kigali-protection-engineer|kigali-web-developer", "deadline": "YYYY-MM-DD", "applyEmail": "...", "applyWhatsApp": "+250..."}
Use kigali-protection-engineer for protection/relay/substation/SCADA/commissioning roles. Write [] if nothing qualifies.`;

function main(): void {
  mkdirSync("jobs/.state", { recursive: true });
  rmSync(TMP, { force: true });
  console.log(`google sweep ${TODAY}: claude -p with WebSearch …`);
  const res = spawnSync(
    "claude",
    [
      "-p",
      prompt,
      "--allowedTools",
      "WebSearch",
      "WebFetch",
      "Write",
      "--max-turns",
      "60",
    ],
    { encoding: "utf-8", timeout: 20 * 60_000, cwd: ROOT },
  );
  if (res.status !== 0 || !existsSync(TMP)) {
    console.log(
      `claude -p exited ${res.status}: ${(res.stderr || res.stdout || "").slice(0, 300)}`,
    );
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(TMP, "utf-8")) as Row[];
  const seen = new Set<string>();
  const items = raw
    .filter((r) => r.title && r.sourceUrl && LANES.has(r.campaign))
    .filter(
      (r) =>
        !r.deadline ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.deadline) ||
        r.deadline >= TODAY,
    )
    .filter((r) => !seen.has(r.sourceUrl) && seen.add(r.sourceUrl))
    .map((r) => ({
      title: r.title,
      company: r.company || "Unknown employer",
      location: r.location || "Kigali, Rwanda",
      remoteType: r.remoteType ?? "onsite",
      employmentType: r.employmentType ?? "full_time",
      description: r.description || r.title,
      responsibilities: [],
      requiredSkills: [],
      preferredSkills: [],
      sourceUrl: r.sourceUrl,
      source: "google",
      campaign: r.campaign,
      deadline: r.deadline ?? "rolling",
      applyMethod: r.applyEmail
        ? `email:${r.applyEmail}`
        : r.applyWhatsApp
          ? `whatsapp:${r.applyWhatsApp}`
          : `portal:${r.sourceUrl}`,
      note: r.applyEmail
        ? `Google sweep — the posting asks for applications to ${r.applyEmail}.`
        : r.applyWhatsApp
          ? `Google sweep — the posting asks for CVs on WhatsApp to ${r.applyWhatsApp}.`
          : "Google sweep — read the posting for the exact apply channel and documents.",
    }));
  rmSync(TMP, { force: true });

  for (const i of items)
    console.log(
      `  + [${i.campaign}] ${i.deadline} ${i.title} @ ${i.company} — ${i.applyMethod}`,
    );
  console.log(
    `${items.length} item(s) (${raw.length - items.length} dropped by the checks)`,
  );
  if (DRY) return;
  // A second run the same day adds to the first, never replaces it.
  const prior = existsSync(OUT)
    ? (JSON.parse(readFileSync(OUT, "utf-8")) as typeof items)
    : [];
  const merged = [
    ...prior,
    ...items.filter((i) => !prior.some((p) => p.sourceUrl === i.sourceUrl)),
  ];
  mkdirSync("jobs/inbox", { recursive: true });
  writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
  console.log(
    `${OUT} <- ${merged.length} items (${merged.length - prior.length} new).`,
  );
}

main();
