export const meta = {
  name: "jobs",
  description:
    "Income pass — scan every lane in parallel, ingest to the sales.databayt.org board, write packets for the portal/platform top N; email sends belong to the jobs loop",
  whenToUse:
    "Invoked by the `jobs` skill for a full cycle across lanes. The invocation is the multi-agent opt-in — a single verb (queue, mark, one draft) belongs in-session. Drafts only: Abdout presses send.",
  phases: [
    {
      title: "Scan",
      detail:
        "one agent per lane, parallel, each writes jobs/inbox/<date>-<lane>.json",
    },
    {
      title: "Ingest",
      detail: "discover.mjs + ingest dry-run, then live unless dryRun",
    },
    {
      title: "Tailor",
      detail: "top N from the queue → Gmail drafts + jobs/packets, parallel",
    },
    { title: "Report", detail: "what is waiting on Abdout, by deadline" },
  ],
};

// ── Arguments ────────────────────────────────────────────────────
// { lanes?: string[], top?: number, dryRun?: boolean }
// Default: all lanes, tailor the top 5, ingest live (the board is the point).
const a = typeof args === "string" ? { lanes: [args] } : args || {};
const TOP = a.top ?? 5;
const DRY_RUN = a.dryRun === true;
const TODAY = new Date().toISOString().slice(0, 10);
const KUN = "/Users/abdout/kun";

const PROFILE = `Candidate: Osman Abdout, in Kigali (UTC+2), Sudanese national. BSc Electrical Engineering 2013.
Founder & full-stack engineer at Databayt since Dec 2024 (Next.js, TypeScript, Postgres/Neon, Cloudflare, Claude agents + MCP; live multi-tenant school SaaS).
Protection & testing engineer, 33/13.8 kV substations (SEC/SWCC/EEIC), Feb 2022–present (OMICRON, Megger).
Marine Electro-Technical Officer 2014–2021. Arabic native, English fluent.
Facts only from ${KUN}/jobs/cv/*.html and ${KUN}/src/lib/jobs/cv-evidence.ts — never invent a credential, date or number.`;

const INBOX_SHAPE = `A JSON array. Each item: title, company, location, remoteType (remote|hybrid|onsite),
employmentType (full_time|part_time|contract|freelance), salary?, description (2-4 sentences),
responsibilities[], requiredSkills[], preferredSkills[], sourceUrl, source, campaign, deadline
(YYYY-MM-DD|rolling), applyMethod (email:<addr>|portal:<url>|in-person|tender-portal:<url>), note,
and for remote work rwandaEligible (true|"unverified"; omit false), payoutMethod, timeToFirstPay.`;

const LANES = {
  rwanda: {
    campaigns:
      "kigali-protection-engineer, kigali-electrical-engineer, kivu-marine-eto, kigali-web-developer",
    brief:
      "Open Kigali/Rwanda roles on norrsken jobs, UNGM Rwanda, Umucyo individual consultancies, and employer career pages named in jobs/KIGALI-TARGETS.md. jobinrwanda, greatrwandajobs, REG and RemoteOK are covered by discover.mjs — skip them. Drop anything reserved for Rwandan nationals.",
  },
  tenders: {
    campaigns: "rwanda-tenders-databayt",
    brief:
      "Open software / web / ICT / e-learning / school-management tenders and RFPs in Rwanda that a small software agency can bid on (Umucyo, UNGM, NGO procurement pages). Skip anything restricted to local Rwandan firms or tied to one vendor's product.",
  },
  remote: {
    campaigns: "remote-web-developer-worldwide, freelance-contracts",
    brief:
      "Remote Next.js/React/TypeScript roles and freelance contracts open to Africa/worldwide: Indeed connector (ToolSearch 'Indeed'), Remote4Africa, Arc.dev, Andela, Proxify, Contra. Drop anything needing US/EU work authorisation.",
  },
  ai: {
    campaigns: "ai-training-gigs",
    brief:
      "Open AI-training/evaluation roles (Arabic writer/evaluator, TypeScript coding expert, electrical-engineering expert) on Mindrift, Outlier, DataAnnotation, Alignerr, Mercor, Micro1, Turing. Record pay, Rwanda eligibility evidence and payout method.",
  },
  contracts: {
    campaigns: "engineering-contracts",
    brief:
      "Protection / relay testing / substation commissioning contracts in East Africa and the Gulf open to international candidates: Indeed connector, bayt.com, EPC contractor career pages.",
  },
};

const lanes = (a.lanes && a.lanes.length ? a.lanes : Object.keys(LANES)).filter(
  (l) => LANES[l],
);

const DROPPED = { type: "array", items: { type: "string" } };
const SCAN_SCHEMA = {
  type: "object",
  properties: {
    file: { type: "string" },
    count: { type: "number" },
    top: { type: "array", items: { type: "string" } },
    dropped: DROPPED,
  },
  required: ["file", "count", "dropped"],
};
const TAILOR_SCHEMA = {
  type: "object",
  properties: {
    crmId: { type: "string" },
    name: { type: "string" },
    deadline: { type: "string" },
    artifact: {
      type: "string",
      description: "gmail draft id, or jobs/packets/<file>.md",
    },
    humanStep: {
      type: "string",
      description: "the one thing Abdout must do to send it",
    },
    skipped: {
      type: "string",
      description:
        "set instead of artifact when the posting is not worth applying to, with the reason",
    },
  },
  required: ["crmId", "name", "humanStep"],
};

// ── Scan ─────────────────────────────────────────────────────────
phase("Scan");
const scans = await parallel(
  lanes.map(
    (lane) => () =>
      agent(
        `RESEARCH ONLY — never apply, register, email or submit. ${PROFILE}

Lane "${lane}" (campaign ids: ${LANES[lane].campaigns}). ${LANES[lane].brief}
Only postings open on or after ${TODAY}. Quality over volume: 3-15 items, each read on its detail page.
Tools: curl -sL, \`scrapling extract get|fetch <url> out.md\`, ToolSearch for WebFetch/WebSearch/Indeed.

Write ${KUN}/jobs/inbox/${TODAY}-${lane}.json — ${INBOX_SHAPE}
Return the file path, the item count, the top 3 as one line each, and every source you could not reach in dropped[].`,
        { label: `scan:${lane}`, phase: "Scan", schema: SCAN_SCHEMA },
      ),
  ),
);

// ── Ingest ───────────────────────────────────────────────────────
phase("Ingest");
const ingest = await agent(
  `In ${KUN}: run \`pnpm jobs:discover\`, then \`pnpm jobs:ingest --dry-run\`. ${
    DRY_RUN
      ? "Stop there — dry run."
      : "If the dry run shows no errors, run `pnpm jobs:ingest`."
  } The CRM API is localhost:3100 (Docker on the Mac); a 401 means the Keychain key needs re-signing — report it, do not mint a new key.
Return how many rows were created, pushed and dropped, with the dropped lines.`,
  {
    label: "ingest",
    phase: "Ingest",
    schema: {
      type: "object",
      properties: {
        created: { type: "number" },
        pushed: { type: "number" },
        dropped: DROPPED,
      },
      required: ["created", "pushed", "dropped"],
    },
  },
);

// ── Tailor ───────────────────────────────────────────────────────
phase("Tailor");
const queueOut = await agent(
  `In ${KUN} run \`node scripts/jobs/queue.mjs --limit ${TOP} --json\` and return the parsed array unchanged.`,
  {
    label: "queue",
    phase: "Tailor",
    schema: {
      type: "object",
      properties: { rows: { type: "array", items: { type: "object" } } },
      required: ["rows"],
    },
  },
);

const tailored = await parallel(
  (queueOut.rows || []).map(
    (row) => () =>
      agent(
        `DRAFT ONLY — never send an email, submit a form or register an account. ${PROFILE}

Opportunity on the board: ${JSON.stringify(row)}
1. Read the posting (url). If it is closed, reserved for Rwandan nationals, or clearly out of reach, set skipped with the reason and stop.
2. CV by lane: protection/electrical/marine/engineering-contract → Osman_Abdout_Protection_Engineer.pdf; everything else → Osman_Abdout_Web_Developer.pdf (both in ${KUN}/jobs/cv/).
3. email: apply method → SKIP with skipped="email — the send loop (pnpm jobs:wave / jobs:send) tailors, gates and sends these; never draft them here".
   portal:/tender-portal:/in-person → write ${KUN}/jobs/packets/${row.id}.md: deadline, link, documents, the letter, answers to the portal's questions.
   AI-training platforms / vetted networks → the packet is the profile text, the role to pick, and the test to prepare for.
4. Do not change the board status — Abdout marks it applied after he sends.
Return the artifact and the one human step.`,
        {
          label: `tailor:${(row.name || "").slice(0, 30)}`,
          phase: "Tailor",
          schema: TAILOR_SCHEMA,
        },
      ),
  ),
);

// ── Report ───────────────────────────────────────────────────────
phase("Report");
const ready = tailored.filter((t) => t && !t.skipped);
const skipped = tailored.filter((t) => t && t.skipped);
ready.sort((x, y) =>
  String(x.deadline || "9999").localeCompare(String(y.deadline || "9999")),
);

return {
  scanned: scans.map((s, i) => ({
    lane: lanes[i],
    count: s?.count ?? 0,
    top: s?.top ?? [],
    dropped: s?.dropped ?? [],
  })),
  ingest,
  waitingOnAbdout: ready.map(
    (t) =>
      `${t.deadline || "rolling"} · ${t.name} → ${t.humanStep} (${t.artifact})`,
  ),
  skipped: skipped.map((t) => `${t.name}: ${t.skipped}`),
  next: "After sending each one: pnpm jobs:mark <crm-id> applied",
};
