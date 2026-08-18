export const meta = {
  name: "funnel",
  description:
    "Conversion pass — gates → segment → ladder → stall against the funnel's own state, dry-run by default, every truncation logged",
  whenToUse:
    "Invoked by /funnel for a full lane pass. The invocation is the multi-agent opt-in — reading one gate's count is a single command and belongs in-session, not here. Never drains the follow-up queue unless the caller explicitly asked: a drain sends messages to real strangers, so it must be something someone typed on purpose.",
  phases: [
    { title: "Gates", detail: "count every gate before touching anything — read-only" },
    { title: "Segment", detail: "recompute the key; it is a pure function, never stored state" },
    { title: "Ladder", detail: "find gate/segment pairs with no asset — a question with no gift" },
    { title: "Stall", detail: "who stopped, where, for how long; the DORMANT sweep" },
    { title: "Drain", detail: "opt-in only; skipped by default — this one sends" },
    { title: "Report", detail: "re-measure, diff the gates, name what was dropped" },
  ],
};

// ── Arguments ────────────────────────────────────────────────────
// { product?: "hogwarts"|"mkan", stages?: string[], apply?: boolean, segment?: string }
// A bare string is read as the product.
const a = typeof args === "string" ? { product: args } : args || {};
const product = a.product || "hogwarts";
const segmentFilter = a.segment || null;
const apply = a.apply === true; // DRY-RUN BY DEFAULT — --apply is always a deliberate act
const REPOS = { hogwarts: "/Users/abdout/hogwarts", mkan: "/Users/abdout/mkan" };
const repo = REPOS[product];
if (!repo)
  throw new Error(
    `funnel workflow: unknown product "${product}" — resolve it from .claude/memory/repositories.json (hogwarts | mkan)`,
  );

// The drain is NEVER on by default. Every other stage reads; this one puts text in
// front of a real school principal. `/scrape` excludes discovery for the same reason
// — the dangerous stage is the one a default must never quietly pick.
const DEFAULT_STAGES = ["gates", "segment", "ladder", "stall", "report"];
const stages = new Set(a.stages && a.stages.length ? a.stages : DEFAULT_STAGES);

const env =
  `TWENTY_API_URL=http://localhost:3100 ` + // NEVER 3000 — that is hogwarts' Next dev server
  `TWENTY_API_KEY=$(security find-generic-password -s databayt-twenty -a ${product} -w)`;

// The non-negotiables, restated inline so a subagent that never read the agent card
// still cannot violate them. Same discipline as scrape.js's RULES block.
const RULES = `
NON-NEGOTIABLE:
- hogwarts Postgres is the source of truth for gate state. Twenty is a MIRRORED KANBAN.
  A human dragging a card is ADVISORY — never write it back silently.
- REST only against ${env}. NEVER psql into a workspace schema. NEVER port 3000.
- The gate ladder is the UNION of existing enums (Prospect.status / Lead.status /
  Twenty opportunity.stage). Do NOT invent a stage name. Twenty options are APPENDED,
  never replaced — COLD/PROSPECT/PILOT/LOST sit on 3,156 live rows.
- COLD and PROSPECT belong to /scrape. This lane starts at WARM — at a reply.
- ZERO tokens per lead. Segmentation and scheduling are deterministic. Never call a
  model once per row; write the rule and run it over all rows for free.
- Report UNMEASURED rather than a remembered or borrowed number. Every conversion
  rate here is currently ZERO and saying so is correct.
- ${apply ? "APPLY MODE: dry-run first, then write, and log every row you skipped." : "DRY RUN: report only. Write NOTHING."}
- Return dropped[] ALWAYS. If you truncated, sampled, or skipped, say what and why.
`;

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
      why: { type: "string" },
    },
    required: ["what", "count", "why"],
  },
};

const GATES = {
  type: "object",
  properties: {
    ran: { type: "boolean" },
    prospect: { type: "number" },
    warm: { type: "number" },
    discovery: { type: "number" },
    demo: { type: "number" },
    trial: { type: "number" },
    pilot: { type: "number" },
    paid: { type: "number" },
    dormant: { type: "number" },
    biggestStallGate: { type: "string" },
    biggestStallCount: { type: "number" },
    measured: { type: "boolean", description: "false ⇒ report UNMEASURED, never a guess" },
    dropped: DROPPED,
  },
  required: [
    "ran", "prospect", "warm", "discovery", "demo", "trial", "pilot",
    "paid", "dormant", "biggestStallGate", "biggestStallCount", "measured", "dropped",
  ],
};

const STAGE = {
  type: "object",
  properties: {
    stage: { type: "string" },
    applied: { type: "boolean" },
    examined: { type: "number" },
    changed: { type: "number" },
    findings: { type: "array", items: { type: "string" } },
    dropped: DROPPED,
  },
  required: ["stage", "applied", "examined", "changed", "findings", "dropped"],
};

// ── Prompts ──────────────────────────────────────────────────────
const gatesPrompt = (when) => `
Count every funnel gate for ${product}, ${when} any other stage ran.
${RULES}
Read state from hogwarts Postgres (the source of truth) and cross-check Twenty via REST.
The ladder (MEASURED live 2026-08-18, already present in the workspace):
COLD -> PROSPECT -> WARM -> DISCOVERY -> DEMO -> TRIAL -> PILOT -> PAID, plus DORMANT and LOST.
WARM=replied, DISCOVERY=qualified, DEMO=proposal shown, TRIAL=self-serve sandbox,
PILOT=committed free 3-month engagement, PAID=the north-star state.
Map through the EXISTING enums: Prospect.status (replied|promoted|dead) and Lead.status
(NEW|QUALIFIED|PROPOSAL|NEGOTIATION|CLOSED_WON|ARCHIVED|CLOSED_LOST).
Do NOT invent a stage name: five of the workspace's nine stage options were already unused
on 2026-08-18, so an apparently-missing state probably already has a slot.
Name the gate holding the most leads past their stall timer — that is biggestStallGate.
If the funnel tables do not exist yet, set measured=false and ran=true and report zeros honestly;
that is the correct answer today, not a failure.`;

const segmentPrompt = (gates) => `
Recompute the segment key for every lead at or past WARM for ${product}.
${RULES}
hogwarts key: <authority>-<band>-<rail>-<term>. mkan key: <units>-<airbnb>-<wave>-<photos>.
Bands come from pricing/config.ts, not taste: 100 = free-tier ceiling, 20 = minimumMonthly 30 / $1.50
floor, 1000 = enterprise. Rail: sd | gulf | eg | other, and it sets the CHANNEL — sd is WhatsApp-first,
gulf/eg is EMAIL-first because 119 of 176 contactables carry an email and only 45 are mobile.
Segment is a PURE FUNCTION of fields already collected. It is never a gate and never stored state
that can go stale against its own inputs. Write it to tags[] as seg:<key>.
${segmentFilter ? `Filter to segment "${segmentFilter}" only.` : "Report the full distribution."}
Current gate counts for context: ${JSON.stringify(gates)}`;

const ladderPrompt = (gates) => `
Audit the value-asset registry for ${product}.
${RULES}
For every (gate, segment) pair that has leads in it, resolve the asset that gate gives.
REPORT EVERY PAIR THAT RESOLVES TO NOTHING — each one is a question asked with no gift attached,
which is the exact failure this lane exists to prevent.
Assets are produced by /carousel, /draft and /higgs and referenced BY URL — never generated at
runtime, because that is what holds the per-lead cost at zero. The strongest gives are already
built and cost nothing marginal: hogwarts' sandbox carrying the school's own name, and mkan's
pre-built listing plus a single-use HostClaimToken.
Gate counts: ${JSON.stringify(gates)}`;

const stallPrompt = () => `
Find every ${product} lead past its stall timer, and run the DORMANT sweep.
${RULES}
Four touches then DORMANT — never infinite. DORMANT is Lead.status=ARCHIVED plus
nextFollowUpAt = now + 90d and a dormant:<gate> tag; at +90d it re-enters AT THE GATE IT STALLED AT,
touch 1, with one asset it has never received. Nothing is ever deleted — a deleted row is an
outreach history nobody can audit.
Report, per gate: how many are past the timer, and the median days silent.
Do NOT send anything. Sending is the drain stage and it is opt-in.`;

const drainPrompt = () => `
Drain the follow-up queue for ${product}.
${RULES}
EXTRA, AND ABSOLUTE:
- Templated touches (1-2) may send unattended. DRAFTED touches (3+) require a recorded human yes.
  If no approval exists, queue it and stop — do not send.
- Every touch must carry an asset that segment has NOT received. No unsent asset ⇒ do not send;
  open a human task instead.
- Never WhatsApp a number not verified as mobile. Only 45 of 175 contacts are mobile.
- Stop-on-reply is absolute: a reply freezes the cadence and hands to a human.
Report what you queued, what you sent, and what you refused to send and why.`;

// ── Run ──────────────────────────────────────────────────────────
// Ordered, not parallel, and the ordering is a real dependency rather than a
// convenience: segment reads the gate census, ladder reads the segment distribution
// to know which pairs actually have leads in them, and drain must never run before
// ladder has proved the gate it is about to fire has a gift attached.
phase("Gates");
const before = stages.has("gates")
  ? await agent(gatesPrompt("before"), {
      label: "gates:before",
      phase: "Gates",
      model: "sonnet",
      effort: "low",
      schema: GATES,
    })
  : null;

if (before && before.measured === false)
  log("gates UNMEASURED — the funnel tables do not exist yet; every rate below is zero by construction");
else if (before)
  log(`biggest stall: ${before.biggestStallGate} (${before.biggestStallCount} leads)`);

const ran = [];

if (stages.has("segment")) {
  phase("Segment");
  const r = await agent(segmentPrompt(before), {
    label: "segment",
    phase: "Segment",
    model: "sonnet",
    effort: "medium",
    schema: STAGE,
  });
  if (r) ran.push(r);
}

if (stages.has("ladder")) {
  phase("Ladder");
  const r = await agent(ladderPrompt(before), {
    label: "ladder",
    phase: "Ladder",
    model: "sonnet",
    effort: "medium",
    schema: STAGE,
  });
  if (r) ran.push(r);
}

if (stages.has("stall")) {
  phase("Stall");
  const r = await agent(stallPrompt(), {
    label: "stall",
    phase: "Stall",
    model: "opus",
    effort: "high", // judgment about what a human should read next
    schema: STAGE,
  });
  if (r) ran.push(r);
}

if (stages.has("drain")) {
  phase("Drain");
  log("drain stage requested explicitly — this stage sends messages to real people");
  const r = await agent(drainPrompt(), {
    label: "drain",
    phase: "Drain",
    model: "opus",
    effort: "high",
    schema: STAGE,
  });
  if (r) ran.push(r);
}

const dropped = ran.flatMap((r) => (r.dropped || []).map((d) => ({ ...d, stage: r.stage })));
if (dropped.length)
  log(`${dropped.length} truncation(s) reported — coverage is NOT complete, see dropped[]`);
else if (ran.length) log("no stage reported a truncation — coverage is claimed complete");

phase("Report");
const after =
  stages.has("report") && ran.some((r) => r.applied)
    ? await agent(gatesPrompt("after"), {
        label: "gates:after",
        phase: "Report",
        model: "sonnet",
        effort: "low",
        schema: GATES,
      })
    : null;

const GATE_KEYS = ["prospect", "warm", "discovery", "demo", "trial", "pilot", "paid", "dormant"];
const delta =
  before && before.ran && before.measured && after && after.ran && after.measured
    ? Object.fromEntries(GATE_KEYS.map((k) => [k, after[k] - before[k]]))
    : null;

if (delta) log(`measured movement: ${delta.paid >= 0 ? "+" : ""}${delta.paid} paid`);
else if (!apply) log("dry run — nothing was written, so there is no movement to measure");
else
  log("movement UNMEASURED — re-run the gates stage to anchor it; do not report a number without it");

return {
  product,
  mode: apply ? "apply" : "dry-run",
  stages: [...stages],
  segmentFilter,
  before,
  after,
  delta,
  stageResults: ran,
  dropped,
  // The recommendation is part of the return value on purpose: a funnel pass that
  // reports counts without naming a gate and a stall count is how "send more
  // messages" wins by default.
  recommendation:
    before && before.ran && before.measured === false
      ? "Nothing is instrumented yet. The next move is capture — the chatbot exists and writes to no table, so every gate past WARM is structurally empty rather than genuinely empty."
      : before && before.ran && before.biggestStallCount > 0
        ? `Work the ${before.biggestStallCount} leads stalled at ${before.biggestStallGate}. ` +
          `Send only where that segment has an unsent asset; where it has none, open a human task instead.`
        : "Run the gates stage before recommending anything — an unmeasured funnel has no biggest stall.",
};
