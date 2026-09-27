#!/usr/bin/env node
// ── Seed the ATS board list: which remote companies post on which ATS ─────────
//
//   node scripts/jobs/ats-seed.mjs <path-to-remoteintech/remote-jobs clone>
//
// Remote software jobs are applied to through applicant-tracking systems, and
// Greenhouse, Lever and Ashby each publish a free, unauthenticated job-board
// API per company. This probes every company in the remote-in-tech list
// (886 remote-first employers) against all three with a few slug guesses,
// and writes the boards that answer to jobs/ats-boards.json. Run it once a
// month; discover's `ats` adapter polls the result daily.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Sources: a remote-in-tech clone (path), or --yc <yc all.json> — the
// yc-oss mirror of the Y Combinator directory (hiring, remote-friendly only).
const args = process.argv.slice(2);
const ycIdx = args.indexOf("--yc");
let companies;
if (ycIdx > -1) {
  const yc = JSON.parse(readFileSync(args[ycIdx + 1], "utf-8"));
  companies = yc
    .filter((c) => c.isHiring && c.status === "Active" && /remote/i.test(String(c.regions ?? "")))
    .map((c) => ({ name: c.name, slug: c.slug, website: c.website, region: String(c.regions ?? "") }));
} else {
  const repo = args[0];
  if (!repo || !existsSync(join(repo, "src/companies"))) {
    console.error("usage: node scripts/jobs/ats-seed.mjs <remote-jobs clone> | --yc <all.json>");
    process.exit(1);
  }
  companies = readdirSync(join(repo, "src/companies"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const fm = readFileSync(join(repo, "src/companies", f), "utf-8").split("---")[1] ?? "";
      const get = (k) => fm.match(new RegExp(`^${k}:\\s*"?([^"\\n]+)"?`, "m"))?.[1]?.trim();
      return { name: get("title"), slug: get("slug"), website: get("website"), region: get("region") ?? "" };
    })
    .filter((c) => c.name && c.slug);
}

// Merge, never replace: boards already known are kept and not re-probed.
const known = existsSync("jobs/ats-boards.json") ? JSON.parse(readFileSync("jobs/ats-boards.json", "utf-8")).boards : [];
const knownNames = new Set(known.map((b) => b.company.toLowerCase()));
companies = companies.filter((c) => !knownNames.has(c.name.toLowerCase()));
console.log(`${companies.length} companies to probe (${known.length} boards already known)`);

const candidates = (c) => {
  const host = (c.website ?? "").replace(/^https?:\/\/(www\.)?/, "").split(/[./]/)[0];
  return [...new Set([c.slug, c.slug.replace(/-/g, ""), host].filter(Boolean).map((s) => s.toLowerCase()))];
};

const PROBES = {
  greenhouse: (t) => `https://boards-api.greenhouse.io/v1/boards/${t}/jobs`,
  lever: (t) => `https://api.lever.co/v0/postings/${t}?mode=json&limit=1`,
  ashby: (t) => `https://api.ashbyhq.com/posting-api/job-board/${t}`,
};

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body) return null;
    // Count open jobs so dead boards can be dropped.
    const n = Array.isArray(body) ? body.length : (body.jobs?.length ?? 0);
    return n;
  } catch {
    return null;
  }
}

const found = [];
let done = 0;
const queue = [...companies];
async function worker() {
  for (;;) {
    const c = queue.shift();
    if (!c) return;
    for (const token of candidates(c)) {
      let hit = false;
      for (const [ats, url] of Object.entries(PROBES)) {
        const n = await probe(url(token));
        if (n !== null) {
          found.push({ company: c.name, ats, token, region: c.region, openJobs: n });
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (++done % 50 === 0) console.log(`  ${done}/${companies.length} probed, ${found.length} boards`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

const live = [...known, ...found.filter((b) => b.openJobs > 0 || b.ats === "lever")];
writeFileSync("jobs/ats-boards.json", JSON.stringify({ generatedAt: new Date().toISOString(), boards: live }, null, 2) + "\n");
const by = live.reduce((m, b) => ((m[b.ats] = (m[b.ats] ?? 0) + 1), m), {});
console.log(`\njobs/ats-boards.json <- ${live.length} boards`, by);
