export const meta = {
  name: "qa",
  description:
    "Autonomous block QA — static gate, honest detection (every FAIL adversarially refuted), " +
    "fix-until-dry within safe tiers, persist the verdict, open one human-signoff issue.",
  whenToUse:
    "Invoked by /qa <block>. The command invocation is the multi-agent opt-in. Detects across every " +
    "route + the block source, fixes tiers A (mechanical) and B (risky-but-build-gated), hands the " +
    "minimal residual to a human. Not for a single URL — that is /handover <url>.",
  phases: [
    {
      title: "Static",
      detail:
        "resolve routes + compose /check (typecheck + build, 5-retry auto-fix)",
    },
    {
      title: "Detect",
      detail:
        "browser keywords × routes + code keywords × source — one fan-out",
    },
    {
      title: "Verify",
      detail:
        "adversarial RECHECK skeptic refutes every FAIL before it can gate",
    },
    {
      title: "Fix",
      detail:
        "fix-until-dry: tier A parallel, tier B serial+build-gated; re-detect affected only",
    },
    {
      title: "Handoff",
      detail:
        "open ONE qa-signoff issue — matrix + auto-fixed list + minimal residual",
    },
    {
      title: "Persist",
      detail:
        "write the verdict to blocks.json .qa + the block README frontmatter",
    },
  ],
};

// args: "admission" | { block, base, repo, rounds, audit }
const _a =
  args && typeof args === "object"
    ? args
    : typeof args === "string"
      ? (() => {
          try {
            return JSON.parse(args);
          } catch {
            return { block: args };
          }
        })()
      : {};
const block = _a.block || (typeof args === "string" ? args : null);
const base = _a.base || "http://localhost:3000";
const repo = _a.repo || "databayt/hogwarts";
const MAX_ROUNDS = _a.rounds ?? 3;
const AUDIT = !!_a.audit; // detect + verify only, no fixing (honest read-only report)
if (!block)
  throw new Error('qa workflow needs a block, e.g. args: "admission"');

const BROWSER = ["debug", "flow", "responsive", "lang", "see", "fast"];
const CODE = [
  "guard",
  "stack",
  "pattern",
  "design",
  "architecture",
  "structure",
];
const STRUCTURAL_GATING = new Set(["debug", "guard"]); // a live exception / missing auth always gates

// ── Schemas ─────────────────────────────────────────────────────────────────
const FINDING = {
  type: "object",
  properties: {
    title: { type: "string" },
    detail: { type: "string" },
    target: {
      type: "string",
      description: "file:line for code findings; route for browser findings",
    },
    rule: {
      type: "string",
      description:
        "rule-id (e.g. tenant-scope-every-query) for code findings, else omit",
    },
    severity: { type: "string", enum: ["error", "warn", "info"] },
    tier: {
      type: "string",
      enum: ["A", "B", "C"],
      description: "A safe-autofix · B risky-build-gated · C human-only",
    },
    fixable: {
      type: "boolean",
      description:
        "true for tier A or B with a known mechanical/verifiable fix; false for tier C",
    },
  },
  required: ["title", "detail", "severity", "tier", "fixable"],
};
const VERDICT = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["PASS", "WARN", "FAIL"] },
    findings: { type: "array", items: FINDING },
  },
  required: ["verdict", "findings"],
};
const RECHECK = {
  // identical in spirit to handover.js — the honesty engine
  type: "object",
  properties: { isReal: { type: "boolean" }, reason: { type: "string" } },
  required: ["isReal", "reason"],
};
const FIXRESULT = {
  type: "object",
  properties: {
    fixed: { type: "boolean" },
    files: { type: "array", items: { type: "string" } },
    commit: {
      type: "string",
      description: "short SHA if committed, else omit",
    },
    note: { type: "string" },
    escalate: {
      type: "boolean",
      description:
        "true if the fixer judged it unsafe and reverted — becomes residual",
    },
  },
  required: ["fixed", "files"],
};

// ── Phase: Static — resolve targets, then the typecheck+build gate ────────────
phase("Static");
const resolved = await agent(
  `Resolve the QA targets for block "${block}" in the current repo.\n` +
    `Read .claude/blocks.json and return blocks["${block}"].path and blocks["${block}"].routes (logical routes ` +
    `like "/${block}", "/${block}/settings").\n` +
    `If routes is missing or empty, discover them: list src/app/**/page.tsx, strip the structural segments ` +
    `[lang] / literal s / [subdomain] / (route-groups) (keep dynamic [id]/[slug] segments), and keep routes whose ` +
    `first remaining segment is "${block}" or its singular/plural variant.\n` +
    `Return { path, routes }.`,
  {
    label: "resolve",
    phase: "Static",
    model: "sonnet",
    schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        routes: { type: "array", items: { type: "string" } },
      },
      required: ["path", "routes"],
    },
  },
);
const blockPath = (resolved && resolved.path) || `src/components/${block}`;
const routes = (resolved && resolved.routes) || [];
if (!routes.length)
  log(
    `no routes resolved for "${block}" — code checks still run, browser checks skipped`,
  );

const gate = await agent(
  `Run the /check gate (origin only — do NOT deploy) for the "${block}" block.\n` +
    `Execute \`pnpm tsc --noEmit\`, then \`pnpm build\` (the /check steps — check.md lives in ./.claude/commands ` +
    `or ~/.claude/commands), each with the documented 5-attempt auto-fix loop.\n` +
    `Verify you are on main (\`git branch --show-current\` → main) and commit any fixes atomically as ` +
    `\`fix(${block}): typecheck/build [qa]\` with the footer:\n` +
    `  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>\n` +
    `Return ok=true only if BOTH pass; otherwise ok=false with the remaining errors.`,
  {
    label: "static:check",
    phase: "Static",
    model: "opus",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        errors: { type: "array", items: { type: "string" } },
      },
      required: ["ok"],
    },
  },
);
if (!gate || !gate.ok) {
  log(
    `static gate failed — block "${block}" will not build; cannot be honestly QA'd`,
  );
  return finalize({
    verdict: "BLOCKED",
    reason: "static gate (typecheck/build) failed",
    staticErrors: (gate && gate.errors) || [],
    rows: [],
    fixed: [],
    rounds: 0,
    issue: null,
  });
}

// ── Detector (fan-out + adversarial verify), reused every round ───────────────
const detectPrompt = (u) =>
  `Run the niche quality keyword "${u.keyword}" from kun's quality fleet against ` +
  (u.kind === "route"
    ? `the route ${u.target}. Drive the browser MCP against the live page (resolve the navigable URL for this ` +
      `logical route under ${base} — fill in the default lang + the dev tenant). `
    : `the block source dir ${u.target}. Read the source plus the matching rule corpus (the rule directories ` +
      `mapped in patterns.md — ./.claude/rules or ~/.claude/rules) and cite each finding as rule-id (severity). `) +
  `\nFirst read the quality agent (quality.md, in ./.claude/agents or ~/.claude/agents) for the "${u.keyword}" ` +
  `definition AND its §Fix-Tier Matrix, then execute ` +
  `exactly that check. For EVERY finding, classify its fix-tier (A safe-autofix / B risky-build-gated / C human-only) ` +
  `and set fixable accordingly (tier C ⇒ fixable=false). An empty findings array is the correct PASS.`;

const recheckPrompt = (res, f) =>
  `Adversarially verify this "${res.keyword}" finding on ${res.target} — actively try to REFUTE it before accepting it:\n` +
  `${f.title}: ${f.detail}${f.target ? ` (${f.target})` : ""}\n` +
  `Reproduce it (browser MCP for browser checks, read the cited source for code checks). ` +
  `If you cannot reproduce or evidence it, return isReal=false.`;

const detect = (units) =>
  pipeline(
    units,
    (u) =>
      agent(detectPrompt(u), {
        label: `detect:${u.keyword}`,
        phase: "Detect",
        model: "opus",
        schema: VERDICT,
      }).then((r) => r && { ...r, keyword: u.keyword, target: u.target }),
    (res) => {
      if (!res || res.verdict !== "FAIL" || !res.findings.length) return res;
      // Every FAIL is refuted before it can gate — flaky browser checks downgrade FAIL→WARN.
      return parallel(
        res.findings.map(
          (f) => () =>
            agent(recheckPrompt(res, f), {
              label: `verify:${res.keyword}`,
              phase: "Verify",
              model: "opus",
              schema: RECHECK,
            }).then((v) => ({
              ...f,
              isReal: v ? v.isReal : false,
              verifyReason: v && v.reason,
            })),
        ),
      ).then((checked) => {
        const real = checked.filter((f) => f.isReal);
        return {
          ...res,
          findings: real,
          verdict: real.length ? "FAIL" : "WARN",
        };
      });
    },
  );

// ── Phase: Detect (initial full fan-out) ──────────────────────────────────────
phase("Detect");
const unitsFor = (rts, withCode) => [
  ...rts.flatMap((r) =>
    BROWSER.map((kw) => ({ kind: "route", target: r, keyword: kw })),
  ),
  ...(withCode
    ? CODE.map((kw) => ({ kind: "file", target: blockPath, keyword: kw }))
    : []),
];
let rows = (await detect(unitsFor(routes, true))).filter(Boolean);

// ── Phase: Fix — fix-until-dry, affected-only re-detection, round cap ──────────
const allFixed = [];
const escalated = [];
const escalatedKeys = new Set();
const fkey = (f) => `${f.keyword}|${f.target}|${f.title}`;
const isRoute = (t) => typeof t === "string" && routes.includes(t);
let roundsRun = 0;

if (!AUDIT) {
  phase("Fix");
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const fixable = rows
      .filter((r) => r.verdict === "FAIL")
      .flatMap((r) =>
        (r.findings || []).map((f) => ({
          ...f,
          keyword: r.keyword,
          target: r.target,
        })),
      )
      .filter((f) => f.fixable && !escalatedKeys.has(fkey(f)));
    if (!fixable.length) {
      log(
        round === 1
          ? "no fixable findings — nothing to auto-fix"
          : `fix loop dry at round ${round}`,
      );
      break;
    }
    roundsRun = round;
    const tierA = fixable.filter((f) => f.tier === "A");
    const tierB = fixable.filter((f) => f.tier === "B");
    log(
      `round ${round}: ${tierA.length} tier-A (parallel) + ${tierB.length} tier-B (serial, build-gated)`,
    );

    const runFix = (f, tier) =>
      fixer(f, tier).then((res) => ({
        finding: f,
        res: res || { fixed: false, files: [], escalate: true },
      }));
    const aRes = await parallel(tierA.map((f) => () => runFix(f, "A")));
    const bRes = [];
    for (const f of tierB) bRes.push(await runFix(f, "B")); // serial — each self-verifies + builds

    const all = [...aRes, ...bRes].filter(Boolean);
    const done = all.filter((x) => x.res.fixed);
    for (const x of all.filter((x) => !x.res.fixed)) {
      escalatedKeys.add(fkey(x.finding));
      escalated.push({ ...x.finding, note: x.res.note });
    }
    allFixed.push(
      ...done.map((x) => ({
        title: x.finding.title,
        keyword: x.finding.keyword,
        tier: x.finding.tier,
        files: x.res.files,
        commit: x.res.commit,
      })),
    );

    // Affected set = routes whose findings we fixed + code keywords if any source file changed.
    const fixedRoutes = [
      ...new Set(
        done
          .map((x) => x.finding)
          .filter((f) => isRoute(f.target))
          .map((f) => f.target),
      ),
    ];
    const touchedCode = done.some((x) => !isRoute(x.finding.target));
    const reUnits = unitsFor(fixedRoutes, touchedCode);
    if (!reUnits.length) break;

    const fresh = (await detect(reUnits)).filter(Boolean);
    const reKeys = new Set(reUnits.map((u) => `${u.keyword}@${u.target}`));
    rows = rows
      .filter((r) => !reKeys.has(`${r.keyword}@${r.target}`))
      .concat(fresh);
    if (round === MAX_ROUNDS)
      log(
        `hit round cap (${MAX_ROUNDS}) — any remaining fixable findings become residual`,
      );
  }
}

// ── Verdict + residual (pure) ─────────────────────────────────────────────────
const verdict = computeVerdict(rows);
const residual = residualOf(rows, escalated);
log(
  `${block}: ${verdict} — ${summarize(rows)} · auto-fixed ${allFixed.length} · residual ${residual.length}`,
);

// ── Phase: Handoff — open ONE signoff issue (or update the existing one) ───────
phase("Handoff");
const matrix = rows.map((r) => ({
  keyword: r.keyword,
  target: r.target,
  verdict: r.verdict,
  findings: r.findings || [],
}));
const issue = await agent(
  `Open ONE GitHub issue in ${repo} handing the "${block}" block to a human QA reviewer (verdict: ${verdict}).\n` +
    `Use the issue template in qa.md §"Human-QA handoff issue" (./.claude/commands or ~/.claude/commands). ` +
    `Labels: ${verdict === "CLEAN" ? "qa-signoff" : "qa-blocked"}, P1, block:${block}. ` +
    `First ensure each label exists — \`gh label create <name> --force\` (qa-signoff color green, qa-blocked red, ` +
    `block:${block} blue) — gh issue create fails on a missing label.\n` +
    `Body MUST contain: (1) the verified matrix (routes × keywords) from the data below, (2) the auto-fixed list with ` +
    `commit SHAs, (3) the minimal "residual for human" checklist (ONLY the tier-C + escalated items below — each line: ` +
    `route/file · what to check · why a human is needed), (4) the tick-box acceptance checklist.\n` +
    `If an open issue labelled qa-signoff/qa-blocked + block:${block} already exists, UPDATE it (edit body + reconcile ` +
    `labels) instead of opening a duplicate. Return its number + url.\n\n` +
    `MATRIX:\n${JSON.stringify(matrix, null, 2)}\n\nAUTO-FIXED:\n${JSON.stringify(allFixed, null, 2)}\n\nRESIDUAL:\n${JSON.stringify(residual, null, 2)}`,
  {
    label: "handoff",
    phase: "Handoff",
    model: "sonnet",
    schema: {
      type: "object",
      properties: { number: { type: "number" }, url: { type: "string" } },
      required: ["number"],
    },
  },
);

// ── Phase: Persist — write blocks.json .qa + README frontmatter ────────────────
phase("Persist");
const qa = {
  status: verdict,
  verified_by: "qa.js@opus-4-8",
  rounds: roundsRun,
  fixed_count: allFixed.length,
  residual_count: residual.length,
  issue: issue ? issue.number : null,
};
await agent(
  `Persist the QA verdict for block "${block}" (repo ${repo}).\n` +
    `1. In .claude/blocks.json, set blocks["${block}"].qa to ${JSON.stringify(qa)} PLUS a verified_at field set to the ` +
    `current UTC ISO timestamp (run \`date -u +%Y-%m-%dT%H:%M:%SZ\`). Merge — preserve path/context/docs/routes and every other block.\n` +
    `2. In ${blockPath}/README.md frontmatter, set last_audited to today's date and qa_status to "${verdict}". ` +
    `Leave the rest of the frontmatter untouched.\n` +
    `Commit on main as \`chore(${block}): record qa verdict ${verdict} [qa]\` with the standard Co-Authored-By footer. ` +
    `Return the files you changed.`,
  {
    label: "persist",
    phase: "Persist",
    model: "sonnet",
    schema: {
      type: "object",
      properties: { files: { type: "array", items: { type: "string" } } },
      required: ["files"],
    },
  },
);

return finalize({
  verdict,
  reason: null,
  staticErrors: [],
  rows,
  fixed: allFixed,
  rounds: roundsRun,
  issue: issue || null,
  residual,
});

// ── fixer: one finding → edit (+ tier-B self-verify & build) → commit on main ──
function fixer(f, tier) {
  return agent(
    `You are auto-fixing ONE QA finding in the "${block}" block (repo ${repo}), tier ${tier}.\n` +
      `Finding: [${f.keyword}] ${f.title} — ${f.detail} (${f.target || "n/a"})${f.rule ? ` · rule ${f.rule}` : ""}.\n\n` +
      (f.rule
        ? `Read the rule ${f.rule}.md (under ./.claude/rules/** or ~/.claude/rules/**) and apply its **Fix** section exactly.\n`
        : `Apply the minimal mechanical fix per the quality agent §Fix-Tier Matrix (quality.md, ./.claude/agents or ~/.claude/agents) for "${f.keyword}".\n`) +
      `TIER A (mechanical): make the edit only — lang key, RTL physical→logical class swap, hardcoded-color→token, ` +
      `missing revalidatePath, deprecated-import swap, file move, lint/format.\n` +
      `TIER B (risky — auth / tenant-scope / data-wiring): after editing you MUST (a) re-read the changed code and ` +
      `adversarially confirm the fix is correct AND introduces no regression, then (b) run \`pnpm build\`. If either ` +
      `step is not clearly clean, REVERT your change (git restore) and return fixed=false, escalate=true.\n\n` +
      `HARD EXCLUSIONS (never touch — revert + escalate instead): prisma/ schema, any destructive migration, ` +
      `middleware.ts. Honor the report agent's qa-scope (minimum diff, follow existing patterns).\n` +
      `Verify the branch before committing: \`git branch --show-current\` must print main. Commit ONLY this fix:\n` +
      `  fix(${block}): ${f.title} [qa]\n\n  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>\n` +
      `Return fixed, the files changed, the short commit SHA, and escalate=true if you refused.`,
    {
      label: `fix:${f.keyword}`,
      phase: "Fix",
      model: "opus",
      schema: FIXRESULT,
    },
  );
}

// ── Pure helpers (no filesystem — the Workflow sandbox forbids it) ─────────────
function computeVerdict(rs) {
  const blocking = rs
    .filter((r) => r.verdict === "FAIL")
    .flatMap((r) =>
      (r.findings || []).map((f) => ({ ...f, keyword: r.keyword })),
    )
    // severity:error gates; a live exception (debug) or missing auth (guard) always gates; tier-C never gates (it's human judgment)
    .filter(
      (f) =>
        f.tier !== "C" &&
        (f.severity === "error" || STRUCTURAL_GATING.has(f.keyword)),
    );
  return blocking.length ? "BLOCKED" : "CLEAN";
}

function residualOf(rs, esc) {
  const fromRows = rs
    .filter((r) => r.verdict === "FAIL" || r.verdict === "WARN")
    .flatMap((r) =>
      (r.findings || []).map((f) => ({
        ...f,
        keyword: r.keyword,
        target: f.target || r.target,
      })),
    )
    .filter((f) => f.tier === "C");
  const seen = new Set();
  return [...fromRows, ...esc].filter((f) => {
    const k = `${f.keyword}|${f.target}|${f.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function summarize(rs) {
  const fail = rs.filter((r) => r.verdict === "FAIL").length;
  const warn = rs.filter((r) => r.verdict === "WARN").length;
  const pass = rs.length - fail - warn;
  return `${pass} PASS, ${warn} WARN, ${fail} FAIL across ${rs.length} checks`;
}

function finalize(o) {
  return {
    block,
    base,
    repo,
    verdict: o.verdict,
    summary: o.reason || summarize(o.rows || []),
    rounds: o.rounds,
    fixed: (o.fixed || []).map((f) => ({
      finding: f.title,
      keyword: f.keyword,
      files: f.files,
      commit: f.commit,
    })),
    residual: (o.residual || []).map((f) => ({
      keyword: f.keyword,
      target: f.target,
      title: f.title,
      why: f.detail,
    })),
    staticErrors: o.staticErrors || [],
    issue: o.issue ? { number: o.issue.number, url: o.issue.url } : null,
    checks: (o.rows || []).map((r) => ({
      keyword: r.keyword,
      target: r.target,
      verdict: r.verdict,
      findings: r.findings || [],
    })),
  };
}
