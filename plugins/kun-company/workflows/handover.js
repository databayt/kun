export const meta = {
  name: "handover",
  description:
    "URL-mode handover — fan out the 12 niche quality keywords on one route in parallel, adversarially verify every FAIL, return the verdict table",
  whenToUse:
    "Invoked by /handover <url>. The command invocation is the multi-agent opt-in; do not run this for block mode (block mode stays in-session, route by route).",
  phases: [
    {
      title: "Sweep",
      detail: "12 niche keywords in parallel (browser 6 + code 6)",
    },
    {
      title: "Verify",
      detail: "adversarial re-check of every FAIL before it blocks",
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

const RECHECK = {
  type: "object",
  properties: {
    isReal: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["isReal", "reason"],
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

const results = await pipeline(
  [...BROWSER, ...CODE],
  (kw) =>
    agent(
      `You are running the niche quality keyword "${kw}" from kun's quality fleet against the route ${url} (origin ${base}).\n` +
        `First read .claude/agents/quality.md for the "${kw}" check definition, then execute exactly that check — ` +
        `browser keywords (${BROWSER.join(", ")}) drive the browser MCP against ${base}${url}; ` +
        `code keywords (${CODE.join(", ")}) read the route's source plus the matching rule directories per .claude/rules/patterns.md and cite findings as rule-id (severity).\n` +
        `Return your verdict (PASS / WARN / FAIL) with concrete findings — file:line where applicable. An empty findings array is correct for a clean PASS.`,
      { label: `sweep:${kw}`, phase: "Sweep", schema: VERDICT },
    ),
  (res, kw) => {
    if (!res || res.verdict !== "FAIL" || !res.findings.length) return res;
    // Every FAIL is adversarially verified before it can block the handover —
    // a refuted finding downgrades, so flaky browser checks don't gate demos.
    return parallel(
      res.findings.map(
        (f) => () =>
          agent(
            `Adversarially verify this "${kw}" finding on ${base}${url} — actively try to REFUTE it before accepting it:\n` +
              `${f.title}: ${f.detail}${f.file ? ` (${f.file})` : ""}\n` +
              `Reproduce it (browser MCP for browser checks, read the cited source for code checks). If you cannot reproduce or evidence it, return isReal=false.`,
            { label: `verify:${kw}`, phase: "Verify", schema: RECHECK },
          ).then((v) => ({
            ...f,
            isReal: v ? v.isReal : false,
            verifyReason: v && v.reason,
          })),
      ),
    ).then((checked) => {
      const real = checked.filter(Boolean).filter((f) => f.isReal);
      return { ...res, findings: real, verdict: real.length ? "FAIL" : "WARN" };
    });
  },
);

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
