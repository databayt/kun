#!/usr/bin/env node
// ── Discover: deterministic board adapters → jobs/inbox ──────────────────────
//
//   pnpm jobs:discover                         every adapter
//   pnpm jobs:discover --source jobinrwanda --limit 1    test one adapter, one row
//   pnpm jobs:discover --dry-run               print, write nothing
//
// Plain fetch + regex, no browser and no connector, so it runs headless from
// launchd (claude.ai connectors — Indeed, Gmail — are absent in `claude -p`;
// those lanes run in-session through the `jobs` skill).
//
// Every adapter returns { items, dropped }. A board that changes its markup
// shows up as zero items AND a dropped line saying so — never as a silent 0.
//
// Not here, on purpose:
//   rwandajob.com, We Work Remotely — block bots; browse by hand.
//   ReliefWeb API — needs an approved appname (403 without one); request at
//     https://apidoc.reliefweb.int/parameters#appname, then add an adapter.

import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (f, d) => (args.indexOf(f) > -1 ? args[args.indexOf(f) + 1] : d);
const ONLY = opt("--source");
const LIMIT = Number(opt("--limit", 40));
const DRY_RUN = args.includes("--dry-run");
const TODAY = new Date().toISOString().slice(0, 10);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
const SPACING_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { json = false } = {}) {
  await sleep(SPACING_MS);
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return json ? res.json() : res.text();
}

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;?/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

// ── lanes ────────────────────────────────────────────────────────────────────
// First match wins, most specific first. Titles only for jobs; titles are what
// the boards get right, descriptions are boilerplate.

const LANES = [
  ["kigali-protection-engineer", /protection|relay|substation|commissioning|\bscada\b|testing engineer/i],
  ["kivu-marine-eto", /marine|vessel|\bship|boat|\beto\b|electro-?technical/i],
  ["kigali-electrical-engineer", /electric|\be&i\b|electromechanical|power (plant|system)|energy engineer|maintenance engineer|biomedical|instrumentation/i],
  ["kigali-web-developer", /software|developer|\bweb\b|full[- ]?stack|front[- ]?end|back[- ]?end|data engineer|\bict\b|programmer|devops|systems? (analyst|administrator|engineer)|digital|it (officer|specialist|support)/i],
];

const TENDER_SOFTWARE =
  /software (development|solution|application)|develop(ment)? of (a|an|the)? ?(web|mobile|digital|online|information|management)|information (management )?system|management information system|\bmis\b|web ?site|web (platform|portal|application)|digital (platform|solution|transformation)|\bict\b|e-?learning|database|online portal|mobile app|dashboard/i;
const TENDER_ENGINEERING = /substation|protection relay|commissioning|testing and commissioning|transformer|metering|electrical (works|installation)/i;

/// Abdout is Sudanese; a nationality gate makes the whole application moot.
const CITIZENS_ONLY =
  /rwandan (nationals?|citizens?) only|only rwandans?|(must|to) be (a )?rwandan\b|be of rwandan nationality|rwandan nationality|open to rwandans|rwandan citizenship|local rwandan (service providers|firms|companies|suppliers)/i;

function laneForJob(title) {
  return LANES.find(([, re]) => re.test(title))?.[0];
}

function laneForTender(title) {
  if (TENDER_SOFTWARE.test(title)) return "rwanda-tenders-databayt";
  if (TENDER_ENGINEERING.test(title)) return "engineering-contracts";
  return undefined;
}

const MONTHS = "january february march april may june july august september october november december".split(" ");

/// "Friday, October 2 2026", "02-10-2026", "2 October 2026", "October 2, 2026" → YYYY-MM-DD
function parseDate(s) {
  if (!s) return undefined;
  let m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS.includes(m[1].toLowerCase()))
    return `${m[3]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = s.match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/);
  if (m && MONTHS.includes(m[2].toLowerCase()))
    return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

function item({ title, company, location, url, source, campaign, deadline, description, employmentType, remoteType, salary, skills = [] }) {
  return {
    title,
    company: company || "Unknown employer",
    location: location || "Kigali, Rwanda",
    remoteType: remoteType ?? "onsite",
    employmentType: employmentType ?? (campaign?.includes("tender") || campaign === "engineering-contracts" ? "contract" : "full_time"),
    ...(salary ? { salary } : {}),
    description: description || title,
    responsibilities: [],
    requiredSkills: skills,
    preferredSkills: [],
    sourceUrl: url,
    source,
    campaign,
    deadline: deadline ?? "rolling",
    applyMethod: `portal:${url}`,
    note: "Auto-discovered — read the posting for the exact apply channel and documents.",
  };
}

// ── adapters ─────────────────────────────────────────────────────────────────

const ADAPTERS = {
  /// Drupal teaser cards; deadline and body live on the detail page, fetched
  /// only for rows that match a lane.
  async jobinrwanda() {
    const items = [];
    const dropped = [];
    const pages = [
      ["https://www.jobinrwanda.com/jobs/all", "job"],
      ["https://www.jobinrwanda.com/jobs/consultancy", "job"],
      ["https://www.jobinrwanda.com/jobs/tender", "tender"],
    ];
    const seen = new Set();
    for (const [page, kind] of pages) {
      const html = await get(page);
      const cards = [...html.matchAll(/<article[\s\S]*?<\/article>/g)].map((m) => m[0]);
      if (cards.length === 0) dropped.push(`jobinrwanda: 0 cards on ${page} — markup changed?`);
      for (const card of cards) {
        const href = card.match(/href="(\/job\/[^"]+)"/)?.[1];
        const title = text(card.match(/field--name-title[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "");
        if (!href || !title || seen.has(href)) continue;
        seen.add(href);
        const company = text(card.match(/href="\/employer\/[^"]*">([\s\S]*?)<\/a>/)?.[1] ?? "");
        const campaign = kind === "tender" ? laneForTender(title) : laneForJob(title) ?? laneForTender(title);
        if (!campaign) continue;
        if (items.length >= LIMIT) break;

        const url = `https://www.jobinrwanda.com${href}`;
        let deadline;
        let description = title;
        try {
          const body = text(await get(url));
          // The structured field ("Deadline: Monday, 05/10/2026 23:59") comes
          // before "Similar jobs", whose cards carry other postings' deadlines.
          const main = body.split(/Similar jobs/i)[0];
          deadline =
            parseDate(main.match(/Deadline:\s*(?:[A-Za-z]+,\s*)?(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1]) ??
            parseDate(main.match(/Deadline[^0-9A-Za-z]{0,20}([^|]{0,40})/i)?.[1]?.replace(/(\d)(st|nd|rd|th)\b/g, "$1"));
          const start = body.search(/(Job description|Background|Description|Overview|About)/i);
          description = body.slice(start > -1 ? start : 0, (start > -1 ? start : 0) + 700);
          if (CITIZENS_ONLY.test(main)) description += " [Rwandan nationals only]";
        } catch (err) {
          dropped.push(`jobinrwanda detail ${url}: ${err.message}`);
        }
        if (deadline && deadline < TODAY) {
          dropped.push(`expired ${deadline}: ${title}`);
          continue;
        }
        if (CITIZENS_ONLY.test(`${title} ${description}`)) {
          dropped.push(`Rwandan nationals only: ${title} @ ${company}`);
          continue;
        }
        items.push(item({ title, company, url, source: "jobinrwanda", campaign, deadline, description }));
      }
    }
    return { items, dropped };
  },

  /// Joomla jsjobs listing; the deadline is on the card, so no detail fetch.
  async greatrwandajobs() {
    const items = [];
    const dropped = [];
    const pages = [
      ["https://www.greatrwandajobs.com/employers/newest-jobs", "job"],
      ["https://www.greatrwandajobs.com/job-categories/newest-jobs/category-tenders-in-rwanda-72", "tender"],
    ];
    for (const [page, kind] of pages) {
      const html = await get(page);
      const cards = html.split('class="jobtitle"').slice(1);
      if (cards.length === 0) dropped.push(`greatrwandajobs: 0 cards on ${page} — markup changed?`);
      for (const card of cards) {
        const href = card.match(/href="([^"]+)"/)?.[1];
        const raw = text(card.match(/>([\s\S]*?)<\/a>/)?.[1] ?? "");
        const [title, company] = raw.split(/ (?:job|tender) at /i);
        if (!href || !title) continue;
        const campaign = kind === "tender" ? laneForTender(title) : laneForJob(title) ?? laneForTender(title);
        if (!campaign) continue;
        const deadline = parseDate(text(card.match(/Deadline of this Job:[\s\S]*?get-text">([\s\S]*?)<\/span>/)?.[1] ?? ""));
        const station = text(card.match(/Duty Station:[\s\S]*?get-text">([\s\S]*?)<\/span>/)?.[1] ?? "");
        if (deadline && deadline < TODAY) continue;
        if (items.length >= LIMIT) break;
        items.push(
          item({
            title: title.trim(),
            company: company?.trim(),
            location: station || undefined,
            remoteType: /remote/i.test(station) ? "remote" : "onsite",
            url: href.startsWith("http") ? href : `https://www.greatrwandajobs.com${href}`,
            source: "greatrwandajobs",
            campaign,
            deadline,
          }),
        );
      }
    }
    return { items, dropped };
  },

  /// REG posts recruitment cycles under /jobs/vacancies and tenders under
  /// /tenders. An empty vacancies page is the normal state between cycles.
  async reg() {
    const items = [];
    const dropped = [];
    for (const page of [
      "https://www.reg.rw/public-information/jobs/vacancies/",
      "https://www.reg.rw/public-information/tenders/",
    ]) {
      const html = await get(page);
      const links = [...html.matchAll(/<a[^>]+href="([^"]*(?:details|news)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
      for (const [, href, inner] of links) {
        const title = text(inner);
        if (!title || title.length < 12) continue;
        const isTender = /tender|consult|supply|procure/i.test(title) || href.includes("tender");
        const campaign = isTender ? laneForTender(title) : laneForJob(title) ?? "kigali-electrical-engineer";
        if (!campaign) continue;
        if (items.length >= LIMIT) break;
        items.push(
          item({
            title,
            company: "Rwanda Energy Group (REG / EUCL / EDCL)",
            url: href.startsWith("http") ? href : `https://www.reg.rw${href}`,
            source: "reg",
            campaign,
          }),
        );
      }
    }
    if (items.length === 0) dropped.push("reg: no open vacancy cycle or matching tender today (normal between cycles)");
    return { items, dropped };
  },

  /// Public JSON API; first element is the legal notice. Keep only roles that
  /// say worldwide/Africa/EMEA or name no region — US-only is unreachable.
  async remoteok() {
    const items = [];
    const dropped = [];
    const data = await get("https://remoteok.com/api", { json: true });
    const rows = Array.isArray(data) ? data.slice(1) : [];
    if (rows.length === 0) dropped.push("remoteok: empty API response");
    const STACK = /react|next\.?js|typescript|javascript|full[- ]?stack|frontend|node/i;
    const OFF_STACK = /\.net|\bc#|\bjava\b|php|ruby|golang|\bgo\b|python|rust|ios|android|salesforce/i;
    const seen = new Set();
    const BLOCKED = /\b(us|usa|united states|north america|canada|uk only|latam|americas)\b/i;
    for (const r of rows) {
      const tags = (r.tags ?? []).join(" ");
      if (!STACK.test(`${r.position} ${tags}`) || OFF_STACK.test(r.position ?? "")) continue;
      const key = `${r.company}|${r.position}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const loc = String(r.location ?? "");
      if (loc && BLOCKED.test(loc) && !/worldwide|anywhere|global|africa|emea/i.test(loc)) {
        dropped.push(`region ${loc}: ${r.position} @ ${r.company}`);
        continue;
      }
      if (items.length >= LIMIT) break;
      const salary = r.salary_min ? `$${r.salary_min}–${r.salary_max ?? "?"}/yr` : undefined;
      items.push({
        ...item({
          title: r.position,
          company: r.company,
          location: loc || "Remote (worldwide)",
          remoteType: "remote",
          employmentType: "full_time",
          url: r.url,
          source: "remoteok",
          campaign: "remote-web-developer-worldwide",
          description: text(r.description ?? "").slice(0, 700),
          salary,
          skills: r.tags ?? [],
        }),
        rwandaEligible: loc ? "unverified" : "unverified",
      });
    }
    return { items, dropped };
  },
};

// ── run ──────────────────────────────────────────────────────────────────────

const selected = ONLY ? { [ONLY]: ADAPTERS[ONLY] } : ADAPTERS;
if (ONLY && !ADAPTERS[ONLY]) {
  console.error(`unknown source "${ONLY}" — one of: ${Object.keys(ADAPTERS).join(", ")}`);
  process.exit(1);
}

const all = [];
for (const [name, adapter] of Object.entries(selected)) {
  try {
    const { items, dropped } = await adapter();
    console.log(`${name.padEnd(16)} ${String(items.length).padStart(3)} items   ${dropped.length} dropped`);
    for (const d of dropped.slice(0, 8)) console.log(`   · ${d}`);
    for (const i of items.slice(0, ONLY ? LIMIT : 3)) console.log(`   + [${i.campaign}] ${i.deadline} ${i.title} @ ${i.company}`);
    all.push(...items);
  } catch (err) {
    console.log(`${name.padEnd(16)}   ✗ ${err.message}`);
  }
}

if (DRY_RUN || ONLY) {
  console.log(`\n${DRY_RUN ? "DRY RUN" : "single-source test"} — nothing written. ${all.length} items.`);
} else {
  mkdirSync("jobs/inbox", { recursive: true });
  const out = `jobs/inbox/${TODAY}-discover.json`;
  writeFileSync(out, JSON.stringify(all, null, 2) + "\n");
  console.log(`\n${out} <- ${all.length} items. Next: pnpm jobs:ingest --dry-run`);
}
