// Regression test for bench-dispatch.js — runs the whole workflow with stubbed
// agents so the control flow and the pure scoring math are exercised for real,
// without spending a token. Run: node .claude/scripts/test-bench-dispatch.mjs
// pure scoring math are exercised for real, without spending a token.
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../workflows/bench-dispatch.js", import.meta.url), "utf8").replace(
  /^export const meta/m,
  "const meta"
);

function makeRunner(src) {
  return new Function(
    "args",
    "agent",
    "phase",
    "log",
    "pipeline",
    "parallel",
    `return (async () => { ${src} })()`
  );
}

// A tiny synthetic corpus with known-correct answers so every metric is hand-checkable.
const LABELS = [
  { id: "c1", label: "ship", tags: [], split: "train" },
  { id: "c2", label: "ship", tags: ["trivial"], split: "train" },
  { id: "c3", label: "publish", tags: [], split: "holdout" },
  { id: "c4", label: "publish", tags: [], split: "train" },
  { id: "c5", label: "none", tags: [], split: "train" },
  { id: "c6", label: "none", tags: ["destructive"], split: "train" },
  { id: "c7", label: "check", tags: [], split: "holdout" },
  { id: "c8", label: "check", tags: [], split: "train" },
  { id: "f1", label: "deploy", tags: ["real"], split: "fidelity" },
];

function stubPipeline(items, ...stages) {
  return Promise.all(
    items.map(async (item, i) => {
      let v = item;
      for (const st of stages) v = await st(v, item, i);
      return v;
    })
  );
}

async function run({ answers, adjudicatorDies = false, guardError = "", audit = false }) {
  const calls = [];
  const agent = async (prompt, opts) => {
    calls.push(opts.label);
    if (opts.label === "extract")
      return {
        count: LABELS.length,
        skills_listed: 66,
        listing_chars: 25647,
        corpus_hash: "fnv1a:test",
        guard_error: guardError,
        labels: LABELS,
      };
    if (opts.label.startsWith("dispatch"))
      return { results: LABELS.map((l) => answers[l.id]).filter(Boolean) };
    if (opts.label.startsWith("adjudicate")) return adjudicatorDies ? null : { verdicts: [] };
    return "persisted";
  };
  return makeRunner(SRC)({ audit, batch: 100 }, agent, () => {}, () => {}, stubPipeline, null).then(
    (r) => ({ r, calls })
  );
}

const perfect = {
  f1: { case_id: "f1", fired: true, top: ["ship", "deploy", "quick"] }, // proxy disagrees with the live loop — fidelity signal, not a miss
  c1: { case_id: "c1", fired: true, top: ["ship", "deploy", "release"] },
  c2: { case_id: "c2", fired: true, top: ["ship", "deploy", "release"] },
  c3: { case_id: "c3", fired: true, top: ["publish", "approve", "draft"] },
  c4: { case_id: "c4", fired: true, top: ["publish", "approve", "draft"] },
  c5: { case_id: "c5", fired: false, top: ["none", "table", "form"] },
  c6: { case_id: "c6", fired: false, top: ["none", "qa", "check"] },
  c7: { case_id: "c7", fired: true, top: ["check", "build", "watch"] },
  c8: { case_id: "c8", fired: true, top: ["check", "build", "watch"] },
};

const ok = [];
const bad = [];
const t = (name, cond, detail = "") => (cond ? ok : bad).push(`${name}${detail ? " — " + detail : ""}`);

// 1. Perfect answers
{
  const { r, calls } = await run({ answers: perfect, audit: true });
  t("perfect: top1_hard=1", r.top1_hard === 1, `got ${r.top1_hard}`);
  t("perfect: top1=1", r.top1 === 1, `got ${r.top1}`);
  t("perfect: fp_rate=0", r.fp_rate === 0, `got ${r.fp_rate}`);
  t("perfect: destructive_fp=0", r.destructive_fp === 0, `got ${r.destructive_fp}`);
  t("perfect: mrr=1", r.mrr === 1, `got ${r.mrr}`);
  t("perfect: not degraded", r.degraded === false);
  t("perfect: no adjudicator called", !calls.some((c) => c.startsWith("adjudicate")), calls.join(","));
  t("audit: no persist", !calls.includes("persist"), calls.join(","));
  t("perfect: macro_f1=1", r.macro_f1 === 1, `got ${r.macro_f1}`);
}

// 2. A cluster confusion both ways + a false fire on a destructive case
{
  const a = structuredClone(perfect);
  a.c1 = { case_id: "c1", fired: true, top: ["publish", "ship", "release"] }; // ship->publish
  a.c3 = { case_id: "c3", fired: true, top: ["ship", "publish", "approve"] }; // publish->ship
  a.c6 = { case_id: "c6", fired: true, top: ["qa", "check", "report"] }; // fired on rm -rf
  const { r, calls } = await run({ answers: a, audit: true });
  t("confusion: top1 = 5/8", r.top1 === 0.625, `got ${r.top1}`);
  t("confusion: top1_hard = 4/7", r.top1_hard === Number((4 / 7).toFixed(4)), `got ${r.top1_hard}`);
  t("confusion: destructive_fp=1", r.destructive_fp === 1, `got ${r.destructive_fp}`);
  t("confusion: fp_rate=0.5", r.fp_rate === 0.5, `got ${r.fp_rate}`);
  t(
    "confusion: merge candidate ship|publish found",
    r.merge_candidates.some((c) => c.pair.join() === "publish,ship"),
    JSON.stringify(r.merge_candidates)
  );
  t("confusion: adjudicator ran", calls.some((c) => c.startsWith("adjudicate")));
  // c1 and c3 land at rank 2 so they still count for top3, but c6 is a none-case
  // that FIRED — rank 0, never a hit at any depth. 7/8.
  t("confusion: top3 = 7/8 (fired none-case is no hit)", r.top3 === 0.875, `got ${r.top3}`);
  t(
    "confusion: mrr = (5*1 + 2*0.5 + 0)/8",
    r.mrr === Number(((5 * 1 + 2 * 0.5) / 8).toFixed(4)),
    `got ${r.mrr}`
  );
}

// 3. Adjudicator death must NOT read as "refuted"
{
  const a = structuredClone(perfect);
  a.c1 = { case_id: "c1", fired: true, top: ["publish", "ship", "release"] };
  const { r } = await run({ answers: a, adjudicatorDies: true, audit: true });
  t("death: degraded=true", r.degraded === true);
  t("death: unadjudicated=1", r.unadjudicated === 1, `got ${r.unadjudicated}`);
  t("death: miss still counts", r.top1 === 0.875, `got ${r.top1}`);
  t("death: nothing adjudicated away", r.adjudicated_away === 0, `got ${r.adjudicated_away}`);
}

// 4. Abstention on a positive is never a hit
{
  const a = structuredClone(perfect);
  a.c1 = { case_id: "c1", fired: false, top: ["none", "ship", "deploy"] };
  const { r } = await run({ answers: a, audit: true });
  t("abstain: not a hit", r.top1 === 0.875, `got ${r.top1}`);
  t("abstain: abstain_error=1/6", r.abstain_error === Number((1 / 6).toFixed(4)), `got ${r.abstain_error}`);
  t("abstain: not counted in top3 either", r.top3 === 0.875, `got ${r.top3}`);
}

// 5. Guard #1 must abort the run, not publish an incomparable number
{
  try {
    await run({ answers: perfect, guardError: "corpus_hash moved (a → b)", audit: true });
    t("guard: aborts on corpus_hash move", false, "did not throw");
  } catch (e) {
    t("guard: aborts on corpus_hash move", /refusing to score/.test(e.message), e.message);
  }
}

// 6. Holdout gap
{
  const a = structuredClone(perfect);
  a.c3 = { case_id: "c3", fired: true, top: ["ship", "publish", "approve"] }; // holdout miss
  const { r } = await run({ answers: a, audit: true });
  t("holdout: train=1", r.train_top1_hard === 1, `got ${r.train_top1_hard}`);
  t("holdout: holdout=0.5", r.holdout_top1_hard === 0.5, `got ${r.holdout_top1_hard}`);
  t("holdout: gap=0.5", r.train_holdout_gap === 0.5, `got ${r.train_holdout_gap}`);
}

// 7. Fidelity stratum: wrong fidelity answer must not dent any headline metric,
//    must surface as proxy_fidelity, and must never reach the adjudicator.
{
  const { r, calls } = await run({ answers: perfect, audit: true });
  t("fidelity: headline top1 unaffected", r.top1 === 1, `got ${r.top1}`);
  t("fidelity: proxy_fidelity = 0 (1 wrong of 1)", r.proxy_fidelity === 0, `got ${r.proxy_fidelity}`);
  t("fidelity: n_fidelity = 1", r.n_fidelity === 1, `got ${r.n_fidelity}`);
  t("fidelity: adjudicator NOT called for a fidelity miss", !calls.some((c) => c.startsWith("adjudicate")), calls.join(","));
  t("fidelity: excluded from scored count", r.counts.scored === 8 && r.counts.fidelity === 1, JSON.stringify(r.counts));
}

console.log(`PASS ${ok.length}`);
ok.forEach((s) => console.log("  ✓ " + s));
if (bad.length) {
  console.log(`\nFAIL ${bad.length}`);
  bad.forEach((s) => console.log("  ✗ " + s));
  process.exit(1);
}
