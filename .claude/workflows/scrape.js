export const meta = {
  name: "scrape",
  description:
    "Lead acquisition pass — discover → enrich → tier → gap-report against the Twenty CRM, dry-run by default, every truncation logged",
  whenToUse:
    "Invoked by /scrape for a full lane pass. The invocation is the multi-agent opt-in — a plain contact-gap read is one command and belongs in-session, not here. Never runs discovery unless the caller explicitly asked for it: measured yield is +15 rows against a +40 enrichment ceiling and 130 contactable schools already sitting unworked.",
  phases: [
    { title: "Gap", detail: "measure before touching anything — read-only" },
    { title: "Discover", detail: "opt-in only; skipped by default" },
    {
      title: "Enrich",
      detail: "FB About + website extract — ceiling is +40 rows",
    },
    {
      title: "Tier",
      detail: "deterministic rules first, LLM only on the residual",
    },
    {
      title: "Report",
      detail: "re-measure, diff the gap, name what was dropped",
    },
  ],
};

// ── Arguments ────────────────────────────────────────────────────
// { product?: "hogwarts"|"mkan", stages?: string[], apply?: boolean, country?: string }
// A bare string is read as the product.
const a = typeof args === "string" ? { product: args } : args || {};
const product = a.product || "hogwarts";
const country = a.country || null;
const apply = a.apply === true; // DRY-RUN BY DEFAULT — --apply is always a deliberate act
const REPOS = {
  hogwarts: "/Users/abdout/hogwarts",
  mkan: "/Users/abdout/mkan",
};
const repo = REPOS[product];
if (!repo)
  throw new Error(
    `scrape workflow: unknown product "${product}" — resolve it from .claude/memory/repositories.json (hogwarts | mkan)`,
  );

// Discovery is NEVER on by default. The measured marginal yield of a full scrape
// run is 15 contactable rows (505 of the scraper's 817 names were already in the
// CRM); enrichment caps at 40; and 130 tier-A/B schools are contactable and
// unworked today. A workflow that quietly scraped would be optimising the
// cheapest-looking lane instead of the highest-yield one.
const DEFAULT_STAGES = ["gap", "enrich", "tier", "report"];
const stages = new Set(a.stages && a.stages.length ? a.stages : DEFAULT_STAGES);

const env =
  `TWENTY_API_URL=http://localhost:3100 ` + // NEVER 3000 — that is hogwarts' Next dev server
  `TWENTY_API_KEY=$(security find-generic-password -s databayt-twenty -a ${product} -w)`;

// ── Schemas ──────────────────────────────────────────────────────
// `dropped` is required on every stage, not optional. A stage that truncates and
// says nothing reads as full coverage, and that is the single failure mode this
// workflow is built to prevent.
const DROPPED = {
  type: "array",
  items: {
    type: "object",
    properties: {
      what: { type: "string" },
      count: { type: "number" },
      why: {
        type: "string",
        description:
          "top-N cap, sampling, rate limit, checkpoint bail, auth wall, parse failure…",
      },
    },
    required: ["what", "count", "why"],
  },
};

const GAP = {
  type: "object",
  properties: {
    contactable: { type: "number" },
    fbPage: { type: "number" },
    website: { type: "number" },
    mapOnly: { type: "number" },
    workableNow: {
      type: "number",
      description:
        "contactable AND (COLD|PROSPECT) AND tier A|B — the unworked asset",
    },
    total: { type: "number" },
    ran: {
      type: "boolean",
      description: "false if the command could not run at all",
    },
    note: { type: "string" },
  },
  required: [
    "contactable",
    "fbPage",
    "website",
    "mapOnly",
    "workableNow",
    "total",
    "ran",
  ],
};

const STAGE = {
  type: "object",
  properties: {
    stage: { type: "string" },
    applied: {
      type: "boolean",
      description: "true only if it actually wrote to Twenty",
    },
    processed: { type: "number" },
    gained: {
      type: "number",
      description: "rows that became contactable because of this stage",
    },
    dropped: DROPPED,
    findings: { type: "array", items: { type: "string" } },
  },
  required: ["stage", "applied", "processed", "gained", "dropped"],
};

// ── Prompts ──────────────────────────────────────────────────────
const RULES =
  `\nNON-NEGOTIABLE RULES (from .claude/agents/lead.md — read it first):\n` +
  `• Twenty is reached ONLY through its REST API. Never psql into a workspace schema.\n` +
  `• Port 3100, never 3000. Token from the macOS Keychain, never a file.\n` +
  `• Dry-run first. ${apply ? "This run IS --apply: dry-run each command, show the plan, THEN apply." : "This run is DRY-RUN: do not pass --apply to anything."}\n` +
  `• Writes are fill-empty-never-replace-populated. A conflict becomes a dated note, not an overwrite.\n` +
  `• import-to-twenty.js is FORBIDDEN — no dedup key, writes raw SQL into every workspace. Use twenty-upsert.\n` +
  `• Write NO scraper code in kun. The code lives in ${repo}/scripts/crm/ (mkan's copy is canonical).\n` +
  `• Report every truncation in "dropped" — a top-N cap, a sampling limit, a rate-limit stop, a\n` +
  `  checkpoint bail, an auth wall. An empty dropped array must mean you genuinely dropped nothing.\n`;

const gapPrompt = (label) =>
  `Measure the contact gap for ${product} — READ-ONLY, it never writes.\n` +
  `cd ${repo} && ${env} npx tsx scripts/crm/contact-gap.ts${country ? ` --country=${country}` : ""}\n` +
  `Report the four lanes plus "Workable NOW" and the row total from the command's own output ` +
  `(it also writes scripts/crm/.data/contact-gap.json — read that if the console output is truncated).\n` +
  `If the command cannot run (backend down, no token, missing script), set ran=false and say why in ` +
  `note — do NOT substitute remembered numbers. A stale number reported as fresh is the failure ` +
  `this stage exists to prevent. Label: ${label}.` +
  RULES;

const discoverPrompt = () =>
  `Run DISCOVERY for ${product}. The caller asked for this explicitly; it is not a default.\n` +
  `FIRST, state the measured yield out loud: the last full scrape produced 15 new contactable rows ` +
  `(505 of its 817 names were already in the CRM). If a cheaper lane is still unrun, say so.\n` +
  `The scraper entrypoints (tier1-dorker / tier2-osm / tier3-fb-matrix) are being relocated from ` +
  `/Users/abdout/twenty/scripts/sudan-schools-scraper/ to ${repo}/scripts/crm/ — use whichever path ` +
  `exists. The kun scrape-guard hook will BLOCK any Facebook run that would drive the shared session ` +
  `vault Chrome (port 9222 = Abdout's own logged-in profile). If it fires, STOP and report it — do ` +
  `not route around it. A dedicated account needs FB_SCRAPE_PROFILE + FB_SCRAPE_PORT + FB_SCRAPE_DELAY_MS.\n` +
  `Set gained = rows that are new AND contactable, not rows discovered.` +
  RULES;

const enrichPrompt = (gap) =>
  `Enrich the ${product} rows that still carry a signal. The measured ceiling is the FB_PAGE + ` +
  `WEBSITE lanes only${gap && gap.ran ? ` — currently ${gap.fbPage} + ${gap.website} = ${gap.fbPage + gap.website} rows` : ""}. ` +
  `MAP_ONLY rows have a name and a coordinate and no online handle; no scraper closes them, so do ` +
  `not spend a single request on them — they need a human worksheet or a real directory.\n` +
  `FB lane: read the Page's About/Intro tab, NOT the feed — the feed is why the earlier yield was ` +
  `near zero; schools publish phone and WhatsApp on About. Split Pages from Groups; a /groups/ URL ` +
  `is not a school. Reuse the existing phone regex and extractWhatsApp in tier4-enricher.js.\n` +
  `Website lane: fetch the domain and extract from /contact, /about and the footer.\n` +
  `Checkpoint so a stop is resumable, and put whatever the stop skipped in "dropped".\n` +
  `Then normalize: numbers to E.164 via scripts/crm/normalize-contacts.ts, and LABEL mobile vs ` +
  `landline. Only 45 of 175 existing contacts are mobile; a landline in a WhatsApp campaign is a ` +
  `silent non-delivery that reads as disinterest.` +
  RULES;

const tierPrompt = () =>
  `Tier the ${product} leads. Deterministic rules FIRST — private + secondary + high follower count ` +
  `→ Tier A — in the pure, unit-testable shape of mkan's score-trust.ts. Only rows the rules cannot ` +
  `decide go to an LLM, and that residual goes to the Gemini free tier (~20 req/day/model), never ` +
  `per-lead Claude calls: 3,000 rows × any model is waste. If the residual exceeds the free-tier ` +
  `budget, tier what fits and put the rest in "dropped" with the reason — do not silently sample.\n` +
  `Report how many rows the rules settled vs how many needed the model.` +
  RULES;

// ── Run ──────────────────────────────────────────────────────────
log(
  `scrape: product=${product} mode=${apply ? "APPLY" : "dry-run"} stages=[${[...stages].join(", ")}]` +
    (stages.has("discover") ? " — discovery ON by explicit request" : ""),
);

phase("Gap");
const before = stages.has("gap")
  ? await agent(gapPrompt("before"), {
      label: "gap:before",
      phase: "Gap",
      model: "sonnet",
      effort: "low",
      schema: GAP,
    })
  : null;

if (before && before.ran) {
  log(
    `before — contactable ${before.contactable} · fb ${before.fbPage} · web ${before.website} · ` +
      `map-only ${before.mapOnly} · workable-now ${before.workableNow}`,
  );
  const ceiling = before.fbPage + before.website;
  if (before.workableNow > ceiling) {
    log(
      `NOTE: ${before.workableNow} contactable tier-A/B schools are unworked, against an enrichment ` +
        `ceiling of ${ceiling}. Outreach on those outyields this entire workflow — say so in the report.`,
    );
  }
} else if (stages.has("gap")) {
  log(
    "gap stage did not produce a reading — every downstream number is unanchored; the report must say so",
  );
}

// Ordered, not parallel: enrich reads what discover produced, tier reads what
// enrich produced. A barrier here is the real dependency, not a convenience.
const work = [];
if (stages.has("discover")) {
  phase("Discover");
  work.push(
    await agent(discoverPrompt(), {
      label: "discover",
      phase: "Discover",
      model: "sonnet",
      schema: STAGE,
    }),
  );
}
if (stages.has("enrich")) {
  phase("Enrich");
  work.push(
    await agent(enrichPrompt(before), {
      label: "enrich",
      phase: "Enrich",
      model: "sonnet",
      schema: STAGE,
    }),
  );
}
if (stages.has("tier")) {
  phase("Tier");
  work.push(
    await agent(tierPrompt(), {
      label: "tier",
      phase: "Tier",
      model: "sonnet",
      schema: STAGE,
    }),
  );
}

const ran = work.filter(Boolean);
if (ran.length < work.length)
  log(
    `${work.length - ran.length} stage(s) returned nothing (skipped or errored) — treat their lanes as unrun, not as clean`,
  );

// No-silent-caps: every truncation any stage reported is surfaced here, before
// the summary, so a reader meets the holes before meeting the headline number.
const dropped = ran.flatMap((r) =>
  (r.dropped || []).map((d) => ({ ...d, stage: r.stage })),
);
if (dropped.length) {
  for (const d of dropped)
    log(`dropped [${d.stage}] ${d.count} × ${d.what} — ${d.why}`);
} else if (ran.length) {
  log("no stage reported a truncation — coverage is claimed complete");
}

phase("Report");
const after =
  stages.has("report") && ran.some((r) => r.applied)
    ? await agent(gapPrompt("after"), {
        label: "gap:after",
        phase: "Report",
        model: "sonnet",
        effort: "low",
        schema: GAP,
      })
    : null;

const delta =
  before && before.ran && after && after.ran
    ? {
        contactable: after.contactable - before.contactable,
        fbPage: after.fbPage - before.fbPage,
        website: after.website - before.website,
        mapOnly: after.mapOnly - before.mapOnly,
        workableNow: after.workableNow - before.workableNow,
      }
    : null;

if (delta)
  log(
    `measured yield: ${delta.contactable >= 0 ? "+" : ""}${delta.contactable} contactable`,
  );
else if (!apply)
  log("dry run — nothing was written, so there is no yield to measure");
else
  log(
    "yield UNMEASURED — re-run contact-gap.ts to anchor it; do not report a number without it",
  );

return {
  product,
  mode: apply ? "apply" : "dry-run",
  stages: [...stages],
  before,
  after,
  delta,
  stageResults: ran,
  dropped,
  // The recommendation is part of the return value on purpose: a lead pass that
  // reports counts without naming the next move is how "scrape more" wins by default.
  recommendation:
    before && before.ran && before.workableNow > 0
      ? `Work the ${before.workableNow} contactable tier-A/B schools — outreach needs no further enrichment. ` +
        `Enrichment's remaining ceiling is ${before.fbPage + before.website} rows; discovery adds ~15.`
      : "Run the gap stage before recommending anything — an unmeasured funnel has no highest-yield move.",
};
