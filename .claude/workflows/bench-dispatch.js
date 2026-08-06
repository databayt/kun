export const meta = {
  name: "bench-dispatch",
  description:
    "L1 dispatch benchmark — deterministically extract labeled cases from the skill fleet, measure top-3 selection against the verbatim frontmatter listing, adversarially adjudicate every miss, persist the longitudinal score.",
  whenToUse:
    "Invoked by /bench (dispatch layer). Measures skill SELECTION only — not skill execution (that is /qa) and not config file/count parity (that is /health). The command invocation is the multi-agent opt-in.",
  phases: [
    {
      title: "Extract",
      detail:
        "run extract-dispatch-cases.mjs — deterministic node, zero LLM judgment",
    },
    {
      title: "Dispatch",
      detail:
        "batched agents answer cases against the verbatim fleet listing, on the session model",
    },
    {
      title: "Adjudicate",
      detail:
        "adversarial review of every MISS before it may count against the engine",
    },
    {
      title: "Score",
      detail:
        "pure JS: per-skill P/R/F1, cluster confusion, fp_rate, holdout gap — no LLM",
    },
    {
      title: "Persist",
      detail: "write .claude/memory/skill-scores.json — the ONLY writing phase",
    },
  ],
};

// args: undefined | "audit" | { audit, batch }
const _a =
  args && typeof args === "object"
    ? args
    : typeof args === "string"
      ? args === "audit"
        ? { audit: true }
        : {}
      : {};
const AUDIT = !!_a.audit; // extract + dispatch + adjudicate + score, but never write
const BATCH = _a.batch ?? 40; // >50 and the model starts truncating the results array
const CASES_PATH = ".claude/evals/cases/dispatch.json"; // full, labelled — NEVER shown to a grader
const GRADER_PATH = ".claude/evals/cases/dispatch-prompts.json"; // redacted grader view
const SCORES_PATH = ".claude/memory/skill-scores.json";

// ── Schemas ─────────────────────────────────────────────────────────────────

// Top-3 + a binary `fired` flag, not top-1 and not a confidence score.
// Top-1 alone cannot separate "adjacent-cluster confusion" (a cheap boundary
// edit) from "concept absent" (a real coverage gap) — opposite fixes. Confidence
// is not calibrated at this sample size and would invite optimizing a mean.
// `fired` is the one extra bit that makes the none-of-the-above class scorable
// without needing calibration.
const DISPATCH_BATCH = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          fired: {
            type: "boolean",
            description:
              "true if you would actually invoke a skill for this prompt; false if no listed skill applies",
          },
          top: {
            type: "array",
            items: { type: "string" },
            description:
              'exactly 3 lowercase-hyphenated skill directory names, best first. If fired=false, top[0] MUST be the literal "none" and top[1..2] are the closest skills you considered and rejected.',
          },
          why: {
            type: "string",
            description:
              "one clause quoting the SPECIFIC frontmatter text that decided it",
          },
        },
        required: ["case_id", "fired", "top"],
      },
    },
  },
  required: ["results"],
};

// The honesty engine, same contract as qa.js's RECHECK_BATCH: a miss is presumed
// REAL until actively refuted. The adjudicator answers a labeling question only —
// "is the extracted label genuinely right for this prompt?" — never "was the
// model's answer reasonable", which would let every miss argue itself away.
const ADJUDICATE_BATCH = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          labelIsCorrect: {
            type: "boolean",
            description:
              "false ONLY if the extracted label is genuinely wrong — the prompt legitimately routes elsewhere, or is truly ambiguous between two skills. Default true when uncertain.",
          },
          alsoValid: {
            type: "array",
            items: { type: "string" },
            description:
              "other skills that would be defensible for this prompt",
          },
          reason: { type: "string" },
        },
        required: ["case_id", "labelIsCorrect"],
      },
    },
  },
  required: ["verdicts"],
};

const EXTRACT = {
  type: "object",
  properties: {
    count: { type: "number" },
    skills_listed: { type: "number" },
    listing_chars: { type: "number" },
    corpus_hash: { type: "string" },
    guard_error: {
      type: "string",
      description: "the --check error text if the guards failed, else empty",
    },
    labels: {
      type: "array",
      description:
        "one entry per case, in file order — id, label, tags, split. Prompts are NOT included: they stay in the file so dispatch agents read them cold.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          split: { type: "string" },
        },
        required: ["id", "label", "split"],
      },
    },
  },
  required: ["count", "corpus_hash", "labels"],
};

// ── Pure helpers (no filesystem — the Workflow sandbox forbids it) ──────────

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
const isTrivial = (c) => (c.tags || []).includes("trivial");
const isDestructive = (c) => (c.tags || []).includes("destructive");
const pct = (n, d) => (d ? Number((n / d).toFixed(4)) : null);

// Deterministic interleave. A model shown 40 prompts at once will spread its
// answers to avoid repeating itself; ordering by hash means no two adjacent
// cases share a label, so that bias cannot align with the label sequence.
// (It mitigates, it does not remove — recorded in known_biases.)
function batches(labels, size) {
  const ordered = labels
    .map((l) => ({ l, h: fnv1a(l.id) }))
    .sort((a, b) => a.h - b.h || a.l.id.localeCompare(b.l.id))
    .map((x) => x.l);
  const out = [];
  for (let i = 0; i < ordered.length; i += size)
    out.push(ordered.slice(i, i + size));
  return out;
}

function score(cases, answers) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const rows = [];
  for (const [id, a] of answers) {
    const c = byId.get(id);
    if (!c) continue;
    const top = (a.top || []).map(norm);
    const label = norm(c.label);
    const fired = a.fired !== false;
    // A none-case is correct exactly when the model declined to fire. A positive
    // case is correct when rank-1 matches — an unfired positive is never correct,
    // it is an abstention.
    const rank =
      label === "none" ? (fired ? 0 : 1) : fired ? top.indexOf(label) + 1 : 0;
    rows.push({
      id,
      label,
      predicted: top[0] || "none",
      top,
      fired,
      rank,
      hit1: rank === 1,
      hit3: rank >= 1 && rank <= 3,
      trivial: isTrivial(c),
      lexical: (c.tags || []).includes("lexical"),
      destructive: isDestructive(c),
      split: c.split,
      adjudicatedAway: false,
    });
  }
  return rows;
}

function metrics(rows) {
  const pos = rows.filter((r) => r.label !== "none");
  const none = rows.filter((r) => r.label === "none");
  const hard = rows.filter((r) => !r.trivial);
  // The honest difficulty floor: positives whose prompt does not contain the skill
  // name at all. Everything above this stratum is partly measuring string overlap.
  const lexFree = rows.filter(
    (r) => !r.trivial && !r.lexical && r.label !== "none",
  );
  const holdout = hard.filter((r) => r.split === "holdout");
  const train = hard.filter((r) => r.split === "train");

  const acc = (set) => pct(set.filter((r) => r.hit1).length, set.length);
  const mrr = rows.length
    ? Number(
        (
          rows.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / rows.length
        ).toFixed(4),
      )
    : null;

  // Per-skill precision/recall from the implicit matrix: every case is a negative
  // for the 65 skills it is not labeled with, so FP falls out at zero extra cost.
  const skills = [
    ...new Set(rows.map((r) => r.label).filter((l) => l !== "none")),
  ];
  const perSkill = {};
  for (const s of skills) {
    const tp = rows.filter((r) => r.label === s && r.predicted === s).length;
    const fp = rows.filter((r) => r.label !== s && r.predicted === s).length;
    const fn = rows.filter((r) => r.label === s && r.predicted !== s).length;
    const p = tp + fp ? tp / (tp + fp) : null;
    const rc = tp + fn ? tp / (tp + fn) : null;
    perSkill[s] = {
      support: tp + fn,
      precision: p === null ? null : Number(p.toFixed(4)),
      recall: rc === null ? null : Number(rc.toFixed(4)),
      f1: p && rc ? Number(((2 * p * rc) / (p + rc)).toFixed(4)) : 0,
      fp,
      top3: pct(rows.filter((r) => r.label === s && r.hit3).length, tp + fn),
    };
  }
  const f1s = Object.values(perSkill).map((v) => v.f1 || 0);
  const macro = f1s.length
    ? Number((f1s.reduce((a, b) => a + b, 0) / f1s.length).toFixed(4))
    : null;
  const weighted = (() => {
    const tot = Object.values(perSkill).reduce((s, v) => s + v.support, 0);
    if (!tot) return null;
    return Number(
      (
        Object.values(perSkill).reduce(
          (s, v) => s + (v.f1 || 0) * v.support,
          0,
        ) / tot
      ).toFixed(4),
    );
  })();

  // Ordered confusion pairs, and the subset that is BIDIRECTIONAL — two skills
  // each stealing the other's cases is the signal that they may be one skill.
  const conf = new Map();
  for (const r of rows) {
    if (r.hit1 || r.label === "none" || r.predicted === "none") continue;
    const k = `${r.predicted}|${r.label}`;
    conf.set(k, (conf.get(k) || 0) + 1);
  }
  const topConfusions = [...conf]
    .map(([k, n]) => {
      const [predicted, actual] = k.split("|");
      return { predicted, actual, count: n };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const mergeCandidates = topConfusions
    .filter((c) => conf.has(`${c.actual}|${c.predicted}`))
    .map((c) => ({
      pair: [c.predicted, c.actual].sort(),
      bidirectional: c.count + conf.get(`${c.actual}|${c.predicted}`),
      note: "bidirectional confusion — evidence for a /decide, never an auto-merge",
    }))
    .filter(
      (c, i, arr) =>
        arr.findIndex((x) => x.pair.join() === c.pair.join()) === i,
    );

  const holdoutAcc = acc(holdout);
  const trainAcc = acc(train);
  return {
    top1: acc(rows),
    top1_hard: acc(hard),
    top1_lexical_free: acc(lexFree),
    n_lexical_free: lexFree.length,
    top3: pct(rows.filter((r) => r.hit3).length, rows.length),
    mrr,
    // The number that matters most: a false fire has side effects, a miss does not.
    fp_rate: pct(none.filter((r) => r.fired).length, none.length),
    destructive_fp: rows.filter((r) => r.destructive && r.fired).length,
    abstain_error: pct(pos.filter((r) => !r.fired).length, pos.length),
    macro_f1: macro,
    weighted_f1: weighted,
    holdout_top1_hard: holdoutAcc,
    train_top1_hard: trainAcc,
    train_holdout_gap:
      trainAcc !== null && holdoutAcc !== null
        ? Number((trainAcc - holdoutAcc).toFixed(4))
        : null,
    per_skill: perSkill,
    top_confusions: topConfusions,
    merge_candidates: mergeCandidates,
    counts: {
      scored: rows.length,
      positive: pos.length,
      none: none.length,
      hard: hard.length,
    },
  };
}

// ── Extract ─────────────────────────────────────────────────────────────────
phase("Extract");

const extracted = await agent(
  `Run the deterministic dispatch-case extractor for the kun engine and report what it produced. Do NOT parse or judge anything yourself — the script is the only source of truth, and an LLM doing this parsing would make the case set irreproducible.\n\n` +
    `1. \`mkdir -p .claude/evals/cases\`\n` +
    `2. \`node .claude/scripts/extract-dispatch-cases.mjs --json > ${CASES_PATH}\`\n` +
    `3. \`node .claude/scripts/extract-dispatch-cases.mjs --redacted > ${GRADER_PATH}\`\n` +
    `4. Confirm the redaction held: \`grep -c '"label"' ${GRADER_PATH}\` MUST print 0. If it prints anything else, put that in guard_error and stop — a grader file carrying labels invalidates the whole run.\n` +
    `5. \`node .claude/scripts/extract-dispatch-cases.mjs --check\` — capture its output. If it EXITS NONZERO, put the full error text in guard_error and still return the rest.\n` +
    `6. Re-read ${CASES_PATH} AFTER writing it — not from anything you saw earlier in this session — and return: count (corpus.cases_total), skills_listed, listing_chars, corpus_hash, and \`labels\`.\n` +
    `   \`labels\` must be EXACTLY the rows of that file, in file order, one per case, carrying ONLY id, label, tags, split. Its length must equal count. Do not merge, dedupe, reorder or carry over ids from a previous corpus — the workflow rejects the run if the counts disagree.\n\n` +
    `Do NOT include case prompts in your answer. They stay in the redacted file so the dispatch agents meet them cold.`,
  {
    label: "extract",
    phase: "Extract",
    model: "sonnet",
    effort: "low",
    schema: EXTRACT,
  },
);

if (
  !extracted ||
  !Array.isArray(extracted.labels) ||
  !extracted.labels.length
) {
  throw new Error(
    "extract phase returned no cases — cannot score an empty corpus",
  );
}
// The extractor is deterministic, but its output reaches this script through an
// LLM — and a 477-row structured relay is exactly the mechanical transcription
// task models drift on. Run wf_805b6baf-8e6 relayed 483 rows: the real 477 plus
// 6 stale ids from a previous corpus, which were then dispatched with no prompt
// behind them. Making the parsing deterministic is worthless if the handoff is
// not checked; the integrity guarantee has to survive the script boundary.
{
  const ids = new Set(extracted.labels.map((l) => l.id));
  if (
    extracted.labels.length !== extracted.count ||
    ids.size !== extracted.count
  ) {
    throw new Error(
      `extract relay is unfaithful: ${extracted.labels.length} rows (${ids.size} unique) for a corpus of ${extracted.count}. ` +
        `Scoring a corpus that does not match the case file produces a number about nothing. Re-run the extract phase.`,
    );
  }
}

if (extracted.guard_error) {
  // Guard #1: if the trigger phrases moved, scores are not comparable to the
  // stored baseline. Refuse rather than quietly publish an incomparable number.
  throw new Error(
    `dispatch guards failed, refusing to score:\n${extracted.guard_error}\n` +
      `If the corpus change was deliberate, reset the baseline explicitly and note it in weekly_history.`,
  );
}

log(
  `corpus ${extracted.count} cases over ${extracted.skills_listed} skills · listing ${extracted.listing_chars} chars · ${extracted.corpus_hash}`,
);

const groups = batches(extracted.labels, BATCH);
log(`dispatching ${groups.length} batches of ≤${BATCH} on the session model`);

// ── Dispatch → Adjudicate (pipelined) ───────────────────────────────────────
// No barrier: a batch's misses go to adjudication the moment that batch lands,
// while other batches are still dispatching.
const answers = new Map();
const adjudications = new Map();
let unadjudicated = 0;

const dispatchPrompt = (ids, i) =>
  `You are measuring skill DISPATCH for the kun engine. Read ${GRADER_PATH} — and ONLY that file.\n\n` +
  `**This is a blind measurement.** ${GRADER_PATH} is redacted: it holds the fleet listing and the case prompts, ` +
  `and nothing else, because it is self-sufficient. Every other source in this repo carries the answer key — ` +
  `${CASES_PATH} has a \`label\` per case, and each \`.claude/skills/<name>/SKILL.md\` contains its own trigger ` +
  `phrases verbatim beside its own name. Reading any of them, or re-running the extractor, does not help you: it ` +
  `destroys the measurement and the run has to be thrown away. Do NOT read SKILL.md files, the full case set, ` +
  `vocabulary.json, or CLAUDE.md. Do not grep the repo for a prompt's text. Everything you need is in the one file.\n\n` +
  `Its \`listing\` array is the complete set of skills available — treat it as the ONLY skills that exist. ` +
  `For each case id below, find that case's \`prompt\` in the file's \`cases\` array and decide, from the listing's ` +
  `\`description\` and \`when_to_use\` alone, which single skill you would invoke if a user typed that prompt.\n\n` +
  `Rules:\n` +
  `- Answer every id. Return exactly 3 names in \`top\`, best first, using the \`skill\` field (lowercase directory name).\n` +
  `- If a case id is NOT present in the file, OMIT it from results entirely. Never invent an answer for a prompt you cannot see — a guessed row scores as if it were a measurement.\n` +
  `- If NO listed skill genuinely applies, set fired=false and make top[0] the literal "none", with top[1..2] the nearest skills you rejected.\n` +
  `- The cases are INDEPENDENT and were shuffled. Repeated answers across cases are expected and correct — do NOT spread your answers to avoid repetition.\n` +
  `- Judge only from the listing text and your own reading of the prompt.\n` +
  `- \`why\` must quote the specific frontmatter phrase that decided it.\n\n` +
  `Case ids (batch ${i + 1}/${groups.length}):\n${ids.map((l) => l.id).join("\n")}`;

const adjudicatePrompt = (misses) =>
  `Adversarially review these dispatch MISSES for the kun engine. Read ${CASES_PATH} for each case's prompt.\n\n` +
  `A miss means the model's rank-1 answer differed from the label extracted from the skill's own "Triggers on:" list ` +
  `or from vocabulary.json. Your ONLY question is whether the LABEL is right — not whether the model's answer was reasonable. ` +
  `Return labelIsCorrect=false ONLY when the label is genuinely wrong: the prompt legitimately routes elsewhere, or it is ` +
  `truly ambiguous between two skills. When uncertain, return true — a miss is presumed real until actively refuted, ` +
  `because the alternative is letting every failure argue itself away.\n\n` +
  misses
    .map((m) => `- ${m.id}  label=${m.label}  model_answered=${m.predicted}`)
    .join("\n");

await pipeline(
  groups,
  // stage 1 — dispatch. NO opts.model: it inherits the session model on purpose.
  // Running this on sonnet would measure Sonnet's routing, not the engine's, and
  // a number produced on the wrong model is worse than none because it is trusted.
  (ids, _orig, i) =>
    agent(dispatchPrompt(ids, i), {
      label: `dispatch:${i + 1}`,
      phase: "Dispatch",
      schema: DISPATCH_BATCH,
    }),

  // stage 2 — adjudicate this batch's misses only
  (res, ids, i) => {
    if (!res || !Array.isArray(res.results)) {
      log(
        `batch ${i + 1} returned nothing — its ${ids.length} cases are unscored`,
      );
      return null;
    }
    for (const r of res.results) answers.set(r.case_id, r);

    const labelById = new Map(ids.map((l) => [l.id, l]));
    const misses = res.results
      .map((r) => {
        const l = labelById.get(r.case_id);
        if (!l) return null;
        const top = (r.top || []).map(norm);
        const label = norm(l.label);
        const fired = r.fired !== false;
        const hit = label === "none" ? !fired : fired && top[0] === label;
        return hit
          ? null
          : {
              id: r.case_id,
              label,
              predicted: fired ? top[0] || "none" : "none",
            };
      })
      .filter(Boolean);

    if (!misses.length) return { batch: i + 1, misses: 0 };

    return agent(adjudicatePrompt(misses), {
      label: `adjudicate:${i + 1}`,
      phase: "Adjudicate",
      effort: "high",
      schema: ADJUDICATE_BATCH,
    }).then((v) => {
      // Death-safe, polarity preserved from qa.js: an adjudicator that DIES must
      // NOT read as "these misses were refuted". Every miss stands and the run
      // is flagged DEGRADED so the number is never reported as clean.
      if (!v || !Array.isArray(v.verdicts)) {
        unadjudicated += misses.length;
        return { batch: i + 1, misses: misses.length, unadjudicated: true };
      }
      const byId = new Map(v.verdicts.map((d) => [d.case_id, d]));
      for (const m of misses) {
        const d = byId.get(m.id);
        if (d && d.labelIsCorrect === false) {
          adjudications.set(m.id, d); // label was wrong — this miss does not count
        }
      }
      return {
        batch: i + 1,
        misses: misses.length,
        dropped: adjudications.size,
      };
    });
  },
);

// ── Score ───────────────────────────────────────────────────────────────────
phase("Score");

const cases = extracted.labels;
const rows = score(cases, answers).filter((r) => {
  if (adjudications.has(r.id)) {
    r.adjudicatedAway = true;
    return false; // the label was wrong, so this case cannot judge the engine
  }
  return true;
});

const m = metrics(rows);
const degraded = unadjudicated > 0 || answers.size < cases.length;

log(
  `top1_hard ${m.top1_hard} · top3 ${m.top3} · fp_rate ${m.fp_rate} · destructive_fp ${m.destructive_fp} · ` +
    `holdout ${m.holdout_top1_hard} (gap ${m.train_holdout_gap}) · scored ${rows.length}/${cases.length}` +
    (degraded
      ? ` · DEGRADED (${unadjudicated} unadjudicated, ${cases.length - answers.size} unanswered)`
      : ""),
);

const result = {
  corpus_hash: extracted.corpus_hash,
  skills_listed: extracted.skills_listed,
  listing_chars: extracted.listing_chars,
  cases_total: extracted.count,
  cases_scored: rows.length,
  adjudicated_away: adjudications.size,
  unadjudicated,
  degraded,
  ...m,
};

if (AUDIT) {
  log("audit mode — nothing written");
  return result;
}

// ── Persist (the ONLY writing phase) ────────────────────────────────────────
phase("Persist");

await agent(
  `Persist the dispatch benchmark result to ${SCORES_PATH}. This is the only phase permitted to write it.\n\n` +
    `MERGE — do not regenerate. Preserve every existing key, and in particular \`split.ledger\` must survive byte-identical: ` +
    `it is a write-once record of which cases are holdout, and losing it would silently reassign holdout membership.\n\n` +
    `Steps:\n` +
    `1. Read ${SCORES_PATH}.\n` +
    `2. Set \`current\` to the metrics below (top1_hard, top1, top3, mrr, fp_rate, destructive_fp, abstain_error, macro_f1, weighted_f1, holdout_top1_hard, train_holdout_gap, listing_chars, degraded, unadjudicated).\n` +
    `3. Set \`current_value\` to top1_hard, \`top_confusions\` and \`merge_candidates\` to the arrays below, and merge the per-skill precision/recall/f1/fp/top3 into the matching \`per_skill\` entries — keep each entry's existing chars/scope/fp_cost/claude_md_routed/has_when_to_use fields.\n` +
    `4. Append ONE entry to \`weekly_history\`: { week_of: <today, from \`date +%F\`>, top1_hard, holdout_top1_hard, fp_rate, listing_chars, cases: <cases_scored>, delta: <top1_hard minus the previous entry's, or null if first>, note }. ` +
    `In \`note\`, state plainly if the run was DEGRADED and why.\n` +
    `5. Set \`last_updated\` to today and \`last_updated_by\` to "bench-dispatch.js".\n` +
    `6. Verify with \`node -e "JSON.parse(require('fs').readFileSync('${SCORES_PATH}','utf8'))"\` and confirm the ledger key count is unchanged from before your edit.\n\n` +
    `Also stage the regenerated ${CASES_PATH} — the case set is git-tracked on purpose so a corpus change is visible in the diff.\n\n` +
    `Result JSON:\n${JSON.stringify(result, null, 2)}`,
  { label: "persist", phase: "Persist", model: "sonnet", effort: "low" },
);

return result;
