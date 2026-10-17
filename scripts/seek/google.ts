#!/usr/bin/env tsx
// ── Google sweep: the profile's search brief → <data>/inbox ─────────────────
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
import { ME, SWEEP } from "./lib/identity";
import { DATA, REPO } from "./lib/paths.mjs";

const DRY = process.argv.includes("--dry-run");
const ROOT = REPO;
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = `${DATA}/inbox/${TODAY}-google.json`;
const TMP = `${DATA}/.state/google-${TODAY}.json`;


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

// Who, where and what to search comes from profile.json → seek.sweep; the
// truth rules and the output contract stay here. {today} and {month} in the
// brief are filled in at run time.
const brief = (SWEEP?.brief ?? "")
  .replaceAll("{today}", TODAY)
  .replaceAll("{month}", TODAY.slice(0, 7));
const CAMPAIGNS = SWEEP?.campaigns ?? [];
const LOCATION = SWEEP?.location ?? "";
const BIDS = new Set(SWEEP?.bidCampaigns ?? []);

const prompt = `You are the daily opportunity sweep for ${ME.name}${ME.bio ? ` (${ME.bio})` : ""}. Today is ${TODAY}.

${brief}

Rules — never break them:
- Only postings whose deadline is ${TODAY} or later, or with no deadline and published within the last 21 days. Read the posting to confirm; drop it if you can't.
- applyEmail / applyWhatsApp: ONLY if printed on the posting itself as the way to apply. Never guess or construct an address.
- Never invent a deadline, company or detail. Unknown = omit the field.

Write ${ROOT}/${TMP} as a JSON array (and output nothing else), each item:
{"title": "...", "company": "...", "location": "${LOCATION || "City, Country"}", "remoteType": "onsite|hybrid|remote", "employmentType": "full_time|contract|part_time", "description": "<=600 chars from the posting: duties + requirements", "sourceUrl": "<the posting URL>", "campaign": "${CAMPAIGNS.join("|")}", "deadline": "YYYY-MM-DD", "applyEmail": "...", "applyWhatsApp": "+..."}
${SWEEP?.campaignGuide ?? ""} Write [] if nothing qualifies.`;

function main(): void {
  if (!SWEEP?.brief || CAMPAIGNS.length === 0) {
    console.log("google sweep: no seek.sweep brief/campaigns in profile.json — skipped.");
    return;
  }
  mkdirSync(`${DATA}/.state`, { recursive: true });
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
    .filter((r) => r.title && r.sourceUrl && CAMPAIGNS.includes(r.campaign))
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
      location: r.location || LOCATION,
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
      // A tender wants a bid packet, never a cover letter by email.
      applyMethod:
        BIDS.has(r.campaign)
          ? `portal:${r.sourceUrl}`
          : r.applyEmail
            ? `email:${r.applyEmail}`
            : r.applyWhatsApp
              ? `whatsapp:${r.applyWhatsApp}`
              : `portal:${r.sourceUrl}`,
      note:
        BIDS.has(r.campaign)
          ? `Google sweep — a bid, not an application${r.applyEmail ? `; submissions to ${r.applyEmail}` : ""}. Prepare a proposal packet.`
          : r.applyEmail
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
  mkdirSync(`${DATA}/inbox`, { recursive: true });
  writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
  console.log(
    `${OUT} <- ${merged.length} items (${merged.length - prior.length} new).`,
  );
}

main();
