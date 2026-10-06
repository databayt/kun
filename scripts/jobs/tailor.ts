#!/usr/bin/env tsx
// ── Tailor a CV to one job: scrape → select true facts → ATS PDF → gate ──────
//
//   pnpm jobs:tailor <crmId…>                  tailor these board cards
//   pnpm jobs:tailor --campaign MARINE_ETO --limit 3
//   pnpm jobs:tailor <crmId> --force           rewrite an existing cv.json
//   pnpm jobs:tailor --packets --limit 12      cards Abdout submits himself
//                                              (portal, platform, in person):
//                                              tailor + note the PDF on the card
//
// Abdout, 2026-10-06: every application gets its own CV, built live from the
// posting. The posting is scraped here (postingText, plus its JSON-LD), then
// one `claude -p` session per batch (Max subscription — no API spend) reads it
// together with the verified career record and may look at the company's own
// site, and writes CONTENT ONLY to cv.json. The layout is fixed and
// ATS-safe (src/lib/jobs/cv-tailored.ts) — the model never writes HTML.
//
// The gate then checks every number, employer, vessel and certificate against
// jobs/evidence/career.json + jobs/facts.json, round-trips the PDF through
// pdftotext, and measures coverage of the posting's must-haves on the rendered
// text. A CV that fails is not used: the caller falls back to the lane CV, and
// weak coverage is reported so the card can be held instead of padded.

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import {
  type CareerRecord,
  CV_HEADINGS,
  cvName,
  gateTailoredCv,
  profileForCampaign,
  renderAtsHtml,
  type TailoredCv,
} from "@/lib/jobs/cv-tailored";
import { numbersIn } from "@/lib/jobs/send-gate";

import { type BoardRow, getRow, listBoard, noteRow } from "./board";
import { kigaliNow } from "./config";
import { htmlToPdfs } from "./lib/pdf.mjs";
import { postingText, splitName } from "./lib/posting";

const ROOT = "/Users/abdout/kun";
const CAREER = "jobs/evidence/career.json";
export const MIN_COVERAGE = 60;

export interface TailorResult {
  crmId: string;
  ok: boolean;
  /// Coverage of the posting's must-haves under MIN_COVERAGE: hold the card
  /// for Abdout rather than send a CV that cannot meet the job.
  weakFit: boolean;
  pdf?: string;
  coverage: number;
  missing: string[];
  problems: string[];
}

interface JobFile {
  crmId: string;
  role: string;
  company: string;
  campaign: string | null;
  profile: string;
  location: string | null;
  postingUrl: string;
  postingText: string;
  hiringOrganization: string | null;
  companyWebsite: string | null;
  out: string;
}

/// JSON-LD JobPosting on the posting page: the employer and its website are
/// often only there (Martide's `sameAs`, most ATS pages).
async function jsonLd(
  url: string,
): Promise<{ org: string | null; site: string | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128 Safari/537.36",
      },
      signal: AbortSignal.timeout(20_000),
    });
    const html = await res.text();
    for (const m of html.matchAll(
      /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
    )) {
      try {
        const d = JSON.parse(m[1]) as {
          "@type"?: string;
          hiringOrganization?: { name?: string; sameAs?: string; url?: string };
        };
        if (d["@type"] === "JobPosting")
          return {
            org: d.hiringOrganization?.name ?? null,
            site:
              d.hiringOrganization?.sameAs ?? d.hiringOrganization?.url ?? null,
          };
      } catch {
        // not JSON — next block
      }
    }
  } catch {
    // unreachable posting — the text fetch reports it
  }
  return { org: null, site: null };
}

const CONTRACT = `You tailor Osman's CV to ONE job posting. Work ONLY from files (and, if useful, the company's own website).

For each job file listed below:
1. Read it (JSON: role, company, profile, postingText, hiringOrganization, companyWebsite, out).
2. Read ${ROOT}/${CAREER} — the verified career record. It is the ONLY source of facts.
3. Optionally WebFetch the companyWebsite (one or two pages) to learn what the company does, its fleet/vessel types, plants or products. Use it only to choose emphasis and wording — never to invent experience.
4. Write JSON to the job's "out" path with exactly these keys:
{
  "profile": <the job file's profile: "maritime" | "engineering" | "software">,
  "headline": <the posting's job title, or the closest true title Osman can hold, e.g. "Electro-Technical Officer (ETO)">,
  "summary": <3-4 sentences, 60-110 words: years and domain that match THIS posting, the 2-3 strongest matching facts, the company's own context (vessel type, plant, product) where it truly connects>,
  "skills": [<12-22 items, most relevant to the posting first; use the posting's own terms when the record supports them>],
  "experience": [{"role","org","place","dates","bullets":[<2-6 bullets>]}],
  "seaService": [{"vessel","type","company","dates","detail"}],   // maritime profile: every vessel in the record, newest first; other profiles: []
  "education": [{"degree","school","date"}],
  "certifications": [<names exactly as in the record; maritime: STCW and seafarer documents first>],
  "mustHave": [<5-12 REQUIREMENTS the posting places on the candidate — skills, certificates, experience, systems — in its own short words, e.g. "high voltage", "PLC", "STCW A-III/6", "DP vessels". Not vessel particulars (DWT, flag, vessel name), not contract terms>],
  "keywordsCovered": [<mustHave items the CV truthfully covers>],
  "keywordsMissing": [<mustHave items Osman does not have>]
}

Hard rules — a mechanical gate rejects the CV otherwise:
- Every employer, vessel, school, certificate, number, date and tool comes from the career record. Reword and reorder; NEVER invent experience, certificates, vessel types, voltages, tonnages, years or results. If the posting wants something he lacks, list it in keywordsMissing — do not hint at it in the CV.
- Spotlight: put the experience that matches the posting first and give it the most bullets; drop bullets that are irrelevant to this job; mirror the posting's vocabulary where the record supports it (an ATS matches words).
- Profiles:
  * maritime — experience: the "sea" entry first (role "Electro-Technical Officer"), then "lady-moon", then "alfalgi" framed as shore-side HV/protection work, then "paf". Include seaService (all 5 rows) and the seafarer certifications. The seafarer medical is EXPIRED: never call it valid; list it only as "Seafarer medical certificate (MLC 2006) — renewal on joining" if the posting asks for a medical.
  * engineering — "alfalgi" first, then "sea" as Electro-Technical Officer, then "lady-moon"/"paf"/"rakta" only if relevant. seaService: [].
  * software — "databayt" first, then "alfalgi" and "sea" condensed to 1-2 bullets each, framed as Electrical & Control Engineer work (PLC, SCADA, relay programming). seaService: [].
- ALFALGI dates are "Feb 2022 – 2026". Never write "Present" for ALFALGI.
- Voltage vocabulary: the ALFALGI work at 33 kV, 13.8 kV and 4.16 kV IS high-voltage / medium-voltage (HV/MV) switchgear work — say "HV/MV" or "high-voltage" when the posting does. MCC = motor control centres. Never claim a voltage level above 33 kV.
- STCW: the record holds "Crowd management — STCW Reg. A-V/2.4" (a passenger-ship training certificate). It is NOT an ETO certificate of competency (A-III/6): never write "STCW A-III/6", "STCW-certified ETO" or attach a regulation to the CoC number.
- Name equipment exactly as the record does (e.g. "hydraulic cargo pumps", not "motor-driven pumps"; "deck crane", not "cranes and winches"). Rewording may change the order and the verbs, never what the equipment was.
- No markdown, no brackets or placeholders inside values, no first person ("I").
- English. Two pages at most: keep bullets to one line where possible.

Job files:
`;

function runBatch(files: string[]): Promise<void> {
  const prompt = `${CONTRACT}${files.join("\n")}\n\nWhen every "out" file is written, reply DONE.`;
  return new Promise((resolve) => {
    const child = spawn(
      "claude",
      [
        "-p",
        prompt,
        "--allowedTools",
        "Read",
        "Write",
        "Glob",
        "WebFetch",
        "--max-turns",
        String(14 * files.length + 10),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.stdout.resume();
    const timer = setTimeout(() => child.kill(), 25 * 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0)
        console.log(`claude -p exited ${code}: ${err.slice(0, 300)}`);
      resolve();
    });
  });
}

/// pdftotext round-trip: what an ATS will actually read.
function atsReadback(
  pdf: string,
  cv: TailoredCv,
  name: string,
  career: CareerRecord,
): string[] {
  const out = spawnSync("pdftotext", ["-layout", pdf, "-"], {
    encoding: "utf-8",
  });
  if (out.status !== 0) return ["pdftotext could not read the PDF"];
  const t = out.stdout;
  const problems: string[] = [];
  for (const need of [name, career.identity.email, career.identity.phone])
    if (!t.includes(need)) problems.push(`ATS readback lost "${need}"`);
  const headings = [
    CV_HEADINGS.summary,
    CV_HEADINGS.skills,
    CV_HEADINGS.experience,
    CV_HEADINGS.education,
  ].map((h) => h.toUpperCase());
  for (const h of headings)
    if (!t.toUpperCase().includes(h))
      problems.push(`ATS readback lost heading ${h}`);
  const firstOrg = cv.experience[0]?.org.split(/[,(—]/)[0].trim();
  if (firstOrg && !t.includes(firstOrg))
    problems.push(`ATS readback lost "${firstOrg}"`);
  return problems;
}

const fileSafe = (s: string) =>
  s
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);

/// Tailor CVs for these cards. Idempotent per card: an existing cv.json is
/// re-rendered and re-gated, not rewritten (unless force).
export async function tailorCvs(
  rows: BoardRow[],
  opts: {
    dir?: string;
    force?: boolean;
    texts?: Map<string, string | null>;
  } = {},
): Promise<Map<string, TailorResult>> {
  const career = JSON.parse(readFileSync(CAREER, "utf-8")) as CareerRecord;
  const facts = JSON.parse(readFileSync("jobs/facts.json", "utf-8")) as {
    numbers: string[];
  };
  const dir = opts.dir ?? `jobs/outbox/${kigaliNow().date}`;
  const results = new Map<string, TailorResult>();
  const jobs: JobFile[] = [];

  for (const row of rows) {
    const { role, company } = splitName(row.name);
    const url = row.jobUrl?.primaryLinkUrl ?? "";
    const cardDir = join(dir, row.id);
    mkdirSync(cardDir, { recursive: true });
    const text = opts.texts?.has(row.id)
      ? opts.texts.get(row.id)
      : await postingText(url);
    const ld = url ? await jsonLd(url) : { org: null, site: null };
    const job: JobFile = {
      crmId: row.id,
      role,
      company,
      campaign: row.campaign,
      profile: profileForCampaign(row.campaign),
      location: row.location ?? null,
      postingUrl: url,
      // The board's assessment carries the description the scanner saw — a
      // fallback when the live posting has gone or blocks the fetch.
      postingText: (text || row.assessment?.markdown || row.name).slice(
        0,
        12_000,
      ),
      hiringOrganization: ld.org,
      companyWebsite: ld.site,
      out: join(ROOT, cardDir, "cv.json"),
    };
    writeFileSync(join(cardDir, "job.json"), JSON.stringify(job, null, 2));
    if (opts.force) rmSync(job.out, { force: true });
    jobs.push(job);
  }

  // Write cv.json — batches of 3, three sessions at a time, one retry pass.
  for (let pass = 1; pass <= 2; pass++) {
    const pending = jobs.filter((j) => !existsSync(j.out));
    if (pending.length === 0) break;
    const batches: JobFile[][] = [];
    for (let i = 0; i < pending.length; i += 3)
      batches.push(pending.slice(i, i + 3));
    console.log(
      `tailoring ${pending.length} CV(s) with claude -p — ${batches.length} batch(es), pass ${pass} …`,
    );
    let next = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        for (let b = batches[next++]; b; b = batches[next++])
          await runBatch(b.map((j) => join(ROOT, dir, j.crmId, "job.json")));
      }),
    );
  }

  // Render + gate.
  const toRender: {
    job: JobFile;
    cv: TailoredCv;
    html: string;
    out: string;
  }[] = [];
  for (const job of jobs) {
    if (!existsSync(job.out)) {
      results.set(job.crmId, {
        crmId: job.crmId,
        ok: false,
        weakFit: false,
        coverage: 0,
        missing: [],
        problems: ["no cv.json was written"],
      });
      continue;
    }
    let cv: TailoredCv;
    try {
      cv = JSON.parse(readFileSync(job.out, "utf-8")) as TailoredCv;
    } catch {
      results.set(job.crmId, {
        crmId: job.crmId,
        ok: false,
        weakFit: false,
        coverage: 0,
        missing: [],
        problems: ["cv.json is not valid JSON"],
      });
      continue;
    }
    cv.profile = profileForCampaign(job.campaign);
    const who =
      cv.profile === "maritime" ? "Osman_Mohamed_Elamin" : "Osman_Abdout";
    const out = join(dir, job.crmId, `${who}_CV_${fileSafe(job.company)}.pdf`);
    toRender.push({ job, cv, html: renderAtsHtml(cv, career), out });
  }
  const rendered = toRender.length
    ? await htmlToPdfs(toRender.map((r) => ({ html: r.html, out: r.out })))
    : [];

  for (const [i, r] of toRender.entries()) {
    const pdf = rendered[i] as { ok: boolean; pages: number; error?: string };
    const verdict = gateTailoredCv(r.cv, career, {
      factNumbers: facts.numbers,
      postingText: r.job.postingText,
      numbersIn,
    });
    const problems = [...verdict.problems];
    if (!pdf.ok) problems.push(`PDF ${pdf.error}`);
    else
      problems.push(...atsReadback(r.out, r.cv, cvName(r.cv, career), career));
    const ok = problems.length === 0;
    results.set(r.job.crmId, {
      crmId: r.job.crmId,
      ok,
      weakFit: verdict.coverage < MIN_COVERAGE,
      pdf: pdf.ok ? join(ROOT, r.out) : undefined,
      coverage: verdict.coverage,
      missing: verdict.missing,
      problems,
    });
  }
  return results;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (f: string) =>
    args.indexOf(f) > -1 ? args[args.indexOf(f) + 1] : undefined;
  const force = args.includes("--force");
  const packets = args.includes("--packets");
  const ids = args.filter(
    (a, i) =>
      !a.startsWith("--") &&
      !["--campaign", "--limit"].includes(args[i - 1] ?? ""),
  );
  let rows: BoardRow[];
  if (packets) {
    // Cards no machine submits: the CV is what he uploads, so it is tailored
    // ahead and its path written on the card. Once per card, ever.
    const done = (id: string) =>
      existsSync("jobs/outbox") && readdirSync("jobs/outbox").some((d) => existsSync(join("jobs/outbox", d, id, "cv.json")));
    rows = (await listBoard())
      .filter(
        (r) =>
          ["TO_APPLY", "APPROVED"].includes(r.applicationStatus ?? "") &&
          ["PORTAL", "PLATFORM", "IN_PERSON"].includes(r.channel ?? "") &&
          !done(r.id),
      )
      .sort((a, b) => (b.engineScore ?? 0) - (a.engineScore ?? 0))
      .slice(0, Number(opt("--limit") ?? 12));
  } else if (ids.length) {
    rows = [];
    for (const id of ids) rows.push(await getRow(id));
  } else {
    const campaign = opt("--campaign");
    const limit = Number(opt("--limit") ?? 3);
    rows = (await listBoard())
      .filter(
        (r) =>
          r.applicationStatus === "TO_APPLY" &&
          (!campaign || r.campaign === campaign),
      )
      .sort((a, b) => (b.engineScore ?? 0) - (a.engineScore ?? 0))
      .slice(0, limit);
  }
  if (rows.length === 0) {
    console.log("no cards to tailor");
    return;
  }
  const results = await tailorCvs(rows, { force });
  if (packets)
    for (const row of rows) {
      const r = results.get(row.id);
      if (!r?.ok || !r.pdf) continue;
      await noteRow(
        row.id,
        `Tailored CV ready (${r.coverage}% of the posting's must-haves${r.missing.length ? `; missing ${r.missing.join(", ")}` : ""}): ${r.pdf}`,
        { variant: `cv:tailored@${row.id}` },
      );
    }
  for (const row of rows) {
    const r = results.get(row.id);
    if (!r) continue;
    console.log(
      `${r.ok ? (r.weakFit ? "~" : "✓") : "✗"} ${String(r.coverage).padStart(3)}%  ${row.name.slice(0, 70)}` +
        (r.pdf ? `\n      ${r.pdf}` : "") +
        (r.missing.length ? `\n      missing: ${r.missing.join(", ")}` : "") +
        (r.problems.length ? `\n      ${r.problems.join("\n      ")}` : ""),
    );
  }
}

if (process.argv[1]?.endsWith("tailor.ts")) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
