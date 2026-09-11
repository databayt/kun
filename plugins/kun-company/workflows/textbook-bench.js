export const meta = {
  name: "textbook-bench",
  description:
    "Textbook benchmark — blind-transcribe the corpus pages with the current contract, agent and model, score every page against its objective assertions and gold, persist the trend. Never touches a book's pages-md.",
  whenToUse:
    "Invoked by /textbook bench [book-id] [--label] [--model]. The skill invocation is the multi-agent opt-in. Measures the PIPELINE (contract × agent × model), not a book — a book is graded by the textbook workflow.",
  phases: [
    { title: "Load", detail: "manifest → cases; integrity check on the relayed count" },
    {
      title: "Transcribe",
      detail:
        "blind transcribers write bench-runs/<label>/<N>.md — never pages-md, never gold",
    },
    {
      title: "Score",
      detail:
        "textbook-bench.py score — assertions per page, per class, per kind; text vs gold; zero LLM",
    },
    {
      title: "Persist",
      detail:
        "append to textbook-scores.json benchmark history; the contamination audit runs after the workflow",
    },
  ],
};

// args: "sd-g12-biology" | { book, label, model, agentType, batch, pages, audit, date, manifest, scripts, scoresPath }
const _a =
  args && typeof args === "object"
    ? args
    : typeof args === "string"
      ? { book: args }
      : {};
const BOOK_ID = _a.book || "sd-g12-biology";
const LABEL = _a.label || `run-${BOOK_ID}`; // name the run — model, contract version, or the change under test
const MODEL = _a.model || null;
const TRANSCRIBER = _a.agentType || "transcribe";
const BATCH = _a.batch ?? 6; // smaller than production batches: the corpus is the hard pages
const PAGES = Array.isArray(_a.pages) && _a.pages.length ? _a.pages : null;
const AUDIT = !!_a.audit;
const DATE = _a.date || null;
const MANIFEST = _a.manifest || "~/kun/.claude/evals/textbook/manifest.json";
const SCRIPTS = _a.scripts || "~/.claude/skills/textbook/scripts";
const SCORES = _a.scoresPath || "~/kun/.claude/memory/textbook-scores.json";
const NOTE_PATHS = "Expand ~ to $HOME. Every path is absolute. ";

const LOADED = {
  type: "object",
  properties: {
    source: { type: "string", description: "absolute book directory from the manifest" },
    contract: { type: "string", description: "absolute contract path" },
    lang: { type: "string" },
    count: { type: "number" },
    goldHash: { type: "string" },
    cases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page: { type: "number" },
          classes: { type: "array", items: { type: "string" } },
        },
        required: ["page"],
      },
    },
  },
  required: ["source", "contract", "count", "cases"],
};
const STATUS = {
  type: "object",
  properties: {
    done: { type: "array", items: { type: "number" } },
    illegible: { type: "array", items: { type: "number" } },
    status: { type: "string" },
  },
  required: ["done", "status"],
};
const RESULT = {
  type: "object",
  properties: {
    cases: { type: "number" },
    scored: { type: "number" },
    missing: { type: "array", items: { type: "number" } },
    assertPass: { type: "number" },
    assertTotal: { type: "number" },
    assertRate: { type: "number" },
    perKind: { type: "object" },
    perClass: { type: "object" },
    textVsGold: { type: "object" },
    comparable: { type: "boolean" },
    goldHash: { type: "string" },
    contractHash: { type: "string" },
    degraded: { type: "boolean" },
    resultPath: { type: "string" },
  },
  required: ["cases", "scored", "assertPass", "assertTotal", "assertRate", "comparable", "resultPath"],
};

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const modelOpt = MODEL ? { model: MODEL } : {};
async function typed(prompt, opts, type) {
  try {
    return await agent(prompt, { ...opts, agentType: type });
  } catch (e) {
    log(`agent type "${type}" unavailable (${String(e).slice(0, 80)}) — falling back to general-purpose`);
    return agent(
      `You are acting as the kun \`${type}\` agent: read ~/.claude/agents/${type}.md FIRST and follow it exactly. ` + prompt,
      { ...opts, agentType: "general-purpose" },
    );
  }
}

// ── Load ────────────────────────────────────────────────────────────────────
phase("Load");
const loaded = await agent(
  `${NOTE_PATHS}Read ${MANIFEST} and find the book whose id is "${BOOK_ID}". Return source (its absolute source directory), ` +
    `contract = source + "/" + its contract field, lang, goldHash, count = the number of its cases, and cases = EXACTLY its cases ` +
    `in file order carrying ONLY page and classes${PAGES ? ` — then keep only pages ${JSON.stringify(PAGES)} and set count accordingly` : ""}. ` +
    `Do not include assertions, gold paths or any page content: the transcribers must meet the pages cold.`,
  { label: "load", phase: "Load", model: "sonnet", effort: "low", schema: LOADED },
);
if (!loaded || !Array.isArray(loaded.cases) || !loaded.cases.length)
  throw new Error(`no cases loaded for ${BOOK_ID} from ${MANIFEST}`);
{
  // the relay through an LLM is the weak link — bench-dispatch once scored 6 stale ids this way
  const ids = new Set(loaded.cases.map((c) => c.page));
  if (loaded.cases.length !== loaded.count || ids.size !== loaded.count)
    throw new Error(`load relay is unfaithful: ${loaded.cases.length} rows (${ids.size} unique) for a declared count of ${loaded.count}`);
}
const RUN_DIR = `${loaded.source}/bench-runs/${LABEL}`;
log(`${BOOK_ID}: ${loaded.cases.length} benchmark pages → ${RUN_DIR}`);

// ── Transcribe (blind) ──────────────────────────────────────────────────────
phase("Transcribe");
const pages = loaded.cases.map((c) => c.page);
const results = await pipeline(chunk(pages, BATCH), (g) =>
  typed(
    "This is a blind transcription — a benchmark measurement. The image and the contract are your ONLY inputs: do NOT open " +
      `${loaded.source}/pages-md/<N>.md, pages-md-audit/, pages-md-verify/, bench-runs/, any gold/ directory, the benchmark manifest or ${loaded.source}/textbook.md. ` +
      "The run transcript is scanned afterwards and a read that peeked voids the whole run.\n\n" +
      `Read the contract ${loaded.contract} first — it is authoritative. Then for each page N below, IN ORDER: read ${loaded.source}/pages/N.webp ` +
      `and write the transcription to ${RUN_DIR}/N.md (create the directory). One page at a time. Return done = the pages you wrote, ` +
      `illegible = pages carrying the illegible marker, status = one line. Never paste transcribed text into your answer.\n\nPages: ${g.join(", ")}`,
    { label: `bench:${g[0]}-${g[g.length - 1]}`, phase: "Transcribe", schema: STATUS, ...modelOpt },
    TRANSCRIBER,
  ),
);
const dead = results.filter((r) => !r).length;
if (dead) log(`${dead} transcriber batches returned nothing — their pages will score as missing (DEGRADED)`);

// ── Score (deterministic) ───────────────────────────────────────────────────
phase("Score");
const scored = await agent(
  `${NOTE_PATHS}Run exactly: python3 ${SCRIPTS}/textbook-bench.py score --manifest ${MANIFEST} --book-id ${BOOK_ID} --run ${RUN_DIR} ` +
    `--label "${LABEL}" --model "${MODEL || "session"}" --json --out ${RUN_DIR}/result.json\n` +
    `Return its fields (cases, scored, missing, assertPass, assertTotal, assertRate, perKind, perClass, textVsGold, comparable, goldHash, ` +
    `contractHash, degraded) and resultPath = ${RUN_DIR}/result.json. Copy numbers; judge nothing.`,
  { label: "score", phase: "Score", model: "sonnet", effort: "low", schema: RESULT },
);
if (!scored) throw new Error("scoring returned nothing");
log(
  `assertions ${scored.assertPass}/${scored.assertTotal} = ${(scored.assertRate * 100).toFixed(1)}%` +
    (scored.comparable ? "" : " · NOT COMPARABLE (gold hash moved or never frozen)") +
    (scored.degraded ? ` · DEGRADED (missing ${(scored.missing || []).join(", ")})` : ""),
);

const result = { book: BOOK_ID, label: LABEL, model: MODEL || "session", runDir: RUN_DIR, ...scored, audit: AUDIT };

// ── Persist ─────────────────────────────────────────────────────────────────
phase("Persist");
if (AUDIT) {
  log("audit mode — nothing persisted");
  return result;
}
await agent(
  `${NOTE_PATHS}Run exactly: python3 ${SCRIPTS}/textbook-bench.py persist --scores ${SCORES} --result ${RUN_DIR}/result.json${DATE ? ` --date ${DATE}` : ""}\n` +
    `Return "ok" and the scores path.`,
  { label: "persist", phase: "Persist", model: "sonnet", effort: "low" },
);
result.next =
  `Run the contamination audit before trusting this number: node ~/kun/.claude/scripts/audit-textbook-run.mjs --latest --out-dir ${RUN_DIR}. ` +
  `If CONTAMINATED: python3 ${SCRIPTS}/textbook-bench.py persist --scores ${SCORES} --result ${RUN_DIR}/result.json --invalid "contaminated: <why>"`;
return result;
