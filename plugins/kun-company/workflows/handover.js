export const meta = {
  name: "handover",
  description:
    "URL-mode handover — fan out the 12 niche quality keywords on one route in parallel, adversarially verify every FAIL, return the verdict table",
  whenToUse:
    "Invoked by /handover <url>. The command invocation is the multi-agent opt-in; do not run this for block mode (block mode stays in-session, route by route).",
  phases: [
    {
      title: "Sweep",
      detail:
        "7 tiered agents — 1 browser session covering all 6 browser keywords + 6 code keywords",
    },
    {
      title: "Verify",
      detail: "batched adversarial re-check of every FAIL before it blocks",
    },
  ],
};

// args: the route as a string ("/admission/new") or { url, base } where base
// overrides the default dev server origin (e.g. "https://ed.databayt.org").
const url = typeof args === "string" ? args : args && args.url;
const base = (args && args.base) || "http://localhost:3000";
if (!url)
  throw new Error(
    'handover workflow needs a route, e.g. args: "/admission/new"',
  );

const VERDICT = {
  type: "object",
  properties: {
    keyword: { type: "string" },
    verdict: { type: "string", enum: ["PASS", "WARN", "FAIL"] },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          file: { type: "string" },
          severity: { type: "string", enum: ["error", "warn", "info"] },
        },
        required: ["title", "detail"],
      },
    },
  },
  required: ["keyword", "verdict", "findings"],
};

const MULTI = {
  type: "object",
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          verdict: { type: "string", enum: ["PASS", "WARN", "FAIL"] },
          findings: VERDICT.properties.findings,
        },
        required: ["keyword", "verdict", "findings"],
      },
    },
  },
  required: ["checks"],
};

const RECHECK_BATCH = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          isReal: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["title", "isReal"],
      },
    },
  },
  required: ["verdicts"],
};

const BROWSER = ["see", "flow", "debug", "responsive", "lang", "fast"];
const CODE = [
  "guard",
  "architecture",
  "structure",
  "pattern",
  "design",
  "stack",
];

// Token model (mirrors qa.js): the old fan-out ran one OPUS agent per keyword,
// so the 6 browser keywords each navigated + authed + loaded the SAME page —
// 6 page loads for one route, 12 opus agents, plus one opus verifier per finding.
// Now: ONE browser agent assesses all 6 browser keywords from a single loaded
// page, models are tiered (observation → sonnet, reasoning-heavy code → opus),
// and verification is batched per keyword instead of per finding.
const CODE_MODEL = {
  guard: "opus",
  architecture: "opus",
  pattern: "opus",
  stack: "sonnet",
  design: "sonnet",
  structure: "sonnet",
};

const browserPrompt = () =>
  `Verify the route ${base}${url} by driving the browser MCP. In ONE browser session, assess ALL of these ` +
  `niche quality keywords from kun's quality fleet: ${BROWSER.join(", ")}.\n` +
  `SETUP ONCE: navigate to ${base}${url}; if it redirects to login, authenticate with the repo's documented ` +
  `dev/test creds (.claude/rules/accounts.md or content/docs*/accounts) and continue to the callbackUrl; ` +
  `dismiss any first-visit onboarding/tour modal. Then assess EVERY keyword from the SAME loaded page — ` +
  `reuse the one navigation; do NOT reload per keyword.\n` +
  `Read the quality agent (quality.md, ./.claude/agents or ~/.claude/agents) for each keyword's definition. ` +
  `"debug" → inspect FAILED NETWORK REQUESTS (404 assets log no console error) but IGNORE dev-environment ` +
  `noise — do NOT report: HMR/websocket (webpack-hmr), RSC prefetch aborts (?_rsc cancelled on navigation), ` +
  `browser-extension requests, source-map 404s, Next.js dev-overlay requests; flag ONLY first-party app ` +
  `assets/APIs that genuinely fail. "responsive" → resize to 375/768/1440 within the same session; "lang" → ` +
  `check the RTL/Arabic variant; if a modal is part of the page, open it before judging its contents.\n` +
  `TOKEN DISCIPLINE (matters): prefer the text accessibility snapshot over screenshots; take AT MOST ONE ` +
  `screenshot total, and only if a visual finding genuinely needs evidence; never save screenshots or ` +
  `scratch files to disk.\n` +
  `Return one "checks" entry per keyword (verdict + findings). An empty findings array is the correct PASS.`;

const codePrompt = (kw) =>
  `Run the niche quality keyword "${kw}" from kun's quality fleet against the source behind the route ${url}.\n` +
  `First read the quality agent (quality.md, ./.claude/agents or ~/.claude/agents) for the "${kw}" check ` +
  `definition, then execute exactly that check — read the route's source plus the matching rule directories ` +
  `per .claude/rules/patterns.md and cite each finding as rule-id (severity).\n` +
  `Return your verdict (PASS / WARN / FAIL) with concrete findings — file:line where applicable. ` +
  `An empty findings array is correct for a clean PASS.`;

// Batched, model-tiered, death-safe: a verifier that DIES (null) must NOT read as
// "refuted" — its findings are retained, the check downgrades FAIL→WARN, and they
// are flagged unverified so they still reach the human. Never silently dropped.
const verify = (row) => {
  if (!row || row.verdict !== "FAIL" || !(row.findings || []).length)
    return Promise.resolve(row);
  const isBrowser = BROWSER.includes(row.keyword);
  return agent(
    `Adversarially verify these "${row.keyword}" findings on ${base}${url} — actively try to REFUTE each ` +
      `before accepting it. Reproduce with the browser MCP (browser checks) or by reading the cited source ` +
      `(code checks). Return isReal=false for any finding you cannot reproduce/evidence; key each verdict by ` +
      `the finding's exact title.\n` +
      row.findings
        .map(
          (f, i) =>
            `${i + 1}. ${f.title}: ${f.detail}${f.file ? ` (${f.file})` : ""}`,
        )
        .join("\n"),
    {
      label: `verify:${row.keyword}`,
      phase: "Verify",
      model: isBrowser ? "sonnet" : CODE_MODEL[row.keyword] || "opus",
      schema: RECHECK_BATCH,
    },
  ).then((v) => {
    if (!v || !Array.isArray(v.verdicts)) {
      return {
        ...row,
        verdict: "WARN",
        unverified: true,
        findings: row.findings.map((f) => ({ ...f, unverified: true })),
      };
    }
    const byTitle = new Map(v.verdicts.map((d) => [d.title, d]));
    const real = row.findings.filter((f) => {
      const d = byTitle.get(f.title);
      return d ? d.isReal : true; // unmatched verdict → keep (conservative)
    });
    return { ...row, findings: real, verdict: real.length ? "FAIL" : "WARN" };
  });
};

// One browser unit (expands to 6 rows from a single session) + one unit per code
// keyword. Each FAILing row is batch-verified as soon as it lands — no barrier.
const detected = (
  await parallel([
    () =>
      agent(browserPrompt(), {
        label: "sweep:browser",
        phase: "Sweep",
        model: "sonnet",
        schema: MULTI,
      }).then((r) =>
        r && Array.isArray(r.checks)
          ? r.checks.map((c) => ({
              keyword: c.keyword,
              verdict: c.verdict,
              findings: c.findings || [],
            }))
          : [],
      ),
    ...CODE.map(
      (kw) => () =>
        agent(codePrompt(kw), {
          label: `sweep:${kw}`,
          phase: "Sweep",
          model: CODE_MODEL[kw] || "sonnet",
          schema: VERDICT,
        }).then((r) => (r ? [{ ...r, keyword: kw }] : [])),
    ),
  ])
)
  .flat()
  .filter(Boolean);

const results = await pipeline(detected, (row) => verify(row));

const rows = results.filter(Boolean);
const fails = rows.filter((r) => r.verdict === "FAIL");
const warns = rows.filter((r) => r.verdict === "WARN");
if (rows.length < 12)
  log(
    `coverage gap: ${12 - rows.length} of 12 checks returned nothing (skipped or errored)`,
  );
log(
  `sweep done — ${rows.length - fails.length - warns.length} PASS, ${warns.length} WARN, ${fails.length} FAIL`,
);

return {
  url,
  base,
  summary: `${rows.length - fails.length - warns.length}/12 PASS, ${warns.length} WARN, ${fails.length} FAIL${rows.length < 12 ? ` (${12 - rows.length} checks missing)` : ""}`,
  verdict: fails.length || rows.length < 12 ? "BLOCKED" : "READY FOR DEMO",
  checks: rows.map((r) => ({
    keyword: r.keyword,
    verdict: r.verdict,
    findings: r.findings,
  })),
};
