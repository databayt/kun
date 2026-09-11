export const meta = {
  name: "textbook",
  description:
    "Textbook harness — transcribe a scanned book by vision, verify it by blind re-reads on text and structure, adjudicate every disagreement against the scan, repair the pages and the contract, persist the measured grade. Never uploads.",
  whenToUse:
    "Invoked by /textbook <book-dir> [--mode full|verify|repair]. The skill invocation is the multi-agent opt-in. One book per run; the benchmark corpus is the textbook-bench workflow. Not for a single page — that is one transcribe agent in-session.",
  phases: [
    {
      title: "Prepare",
      detail:
        "page renders + the contract templated from structure.json — deterministic scripts, no reading",
    },
    {
      title: "Transcribe",
      detail:
        "12 pages per transcriber, one file per page, one status line back; missing pages retried once",
    },
    {
      title: "Assemble",
      detail:
        "stitch with provenance + reader-grammar lint: coverage, tables without a printed grid, composed captions",
    },
    {
      title: "Verify",
      detail:
        "blind re-read of a random + risk sample; six-axis agreement and failure classes; right-edge crops decide table direction",
    },
    {
      title: "Adjudicate",
      detail:
        "every queued page settled against the scan and native-density crops; mirrored tables reversed; the contract learns the named cases",
    },
    {
      title: "Persist",
      detail:
        "graded front matter + the measured record in textbook-scores.json — the ONLY writing phase for the score",
    },
  ],
};

// args: "<abs book dir>" | { book, mode, pages, sample, seed, riskCap, batch, rounds, model,
//        agentType, adjudicator, audit, date, scripts, scoresPath, furniture }
const _a =
  args && typeof args === "object"
    ? args
    : typeof args === "string"
      ? { book: args }
      : {};
const book = _a.book;
if (!book || !book.startsWith("/"))
  throw new Error(
    'textbook workflow needs args.book — the ABSOLUTE path of a directory holding textbook.pdf, e.g. "/Users/abdout/hogwarts/curriculum/sd/g12/biology"',
  );
const MODE = _a.mode || "full"; // full | verify (no transcription; verify + adjudicate what is on disk) | repair (adjudicate the saved queue only)
const PAGES = Array.isArray(_a.pages) && _a.pages.length ? _a.pages : null;
const SAMPLE = _a.sample ?? 12; // random pages re-read blind — the headline number
const SEED = _a.seed ?? 7; // deterministic sampling; vary per run via args, never Math.random
const RISK_CAP = _a.riskCap ?? 12; // suspect/illegible/table pages re-read on top of the random sample
const BATCH = _a.batch ?? 12; // pages per transcriber — measured ~11k tokens/page, 130-190k per batch
const ROUNDS = _a.rounds ?? 2; // adjudicate → re-lint → adjudicate the still-suspect, at most this many times
const MODEL = _a.model || null; // omit → session model (the measured baseline was opus)
const TRANSCRIBER = _a.agentType || "transcribe"; // kun agent; falls back to general-purpose reading the agent file
const ADJUDICATOR = _a.adjudicator || "adjudicate";
const AUDIT = !!_a.audit; // verify only — measure, queue, never repair, never persist
const DATE = _a.date || null; // ISO date for the record; scripts default to today when absent
const SCRIPTS = _a.scripts || "~/.claude/skills/textbook/scripts";
const SCORES = _a.scoresPath || "~/kun/.claude/memory/textbook-scores.json";
const FURNITURE = _a.furniture || "";

const NOTE_PATHS = "Expand ~ to $HOME. Every path is absolute. ";

// ── Schemas ─────────────────────────────────────────────────────────────────
const PREP = {
  type: "object",
  properties: {
    pages: { type: "array", items: { type: "number" } },
    contract: { type: "string" },
    lang: { type: "string" },
    bookId: { type: "string" },
    renderWidth: { type: "number" },
    hasStructure: { type: "boolean" },
    notes: { type: "string" },
  },
  required: ["pages", "contract", "lang", "bookId"],
};
const STATUS = {
  type: "object",
  properties: {
    done: { type: "array", items: { type: "number" }, description: "page numbers whose file you wrote" },
    illegible: { type: "array", items: { type: "number" } },
    printedErrors: { type: "array", items: { type: "string" }, description: '"page: what" for apparent errors in the print, transcribed as printed' },
    status: { type: "string", description: "the one status line the contract asks for" },
  },
  required: ["done", "status"],
};
const LINT = {
  type: "object",
  properties: {
    pages: { type: "number" },
    transcribed: { type: "number" },
    missing: { type: "array", items: { type: "number" } },
    blank: { type: "array", items: { type: "number" } },
    tablePages: { type: "array", items: { type: "number" } },
    illegiblePages: { type: "array", items: { type: "number" } },
    suspectPages: { type: "array", items: { type: "number" } },
    suspects: { type: "object" },
    lintPath: { type: "string" },
  },
  required: ["pages", "transcribed", "missing", "tablePages", "illegiblePages", "suspectPages", "lintPath"],
};
const SAMPLED = {
  type: "object",
  properties: {
    random: { type: "array", items: { type: "number" } },
    risk: { type: "array", items: { type: "number" } },
  },
  required: ["random", "risk"],
};
const CROPPED = {
  type: "object",
  properties: {
    needRead: { type: "array", items: { type: "number" }, description: "table pages whose tables-audit/<N>.right.json does not exist yet" },
  },
  required: ["needRead"],
};
const SCORED = {
  type: "object",
  properties: {
    randomMean: { type: "number" },
    randomN: { type: "number" },
    riskMean: { type: "number", description: "-1 when no risk pages were scored" },
    riskN: { type: "number" },
    meanBow: { type: "number" },
    meanStruct: { type: "number" },
    classes: { type: "object" },
    queue: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page: { type: "number" },
          classes: { type: "array", items: { type: "string" } },
          primary: { type: "string" },
        },
        required: ["page", "primary"],
      },
    },
    mirrored: { type: "array", items: { type: "number" } },
    unclearDirection: { type: "array", items: { type: "number" } },
    scorePath: { type: "string" },
  },
  required: ["randomMean", "randomN", "queue", "scorePath"],
};
const VERDICT = {
  type: "object",
  properties: {
    page: { type: "number" },
    changed: { type: "boolean" },
    hunks: { type: "number" },
    unresolved: { type: "number" },
    classes: { type: "array", items: { type: "string" } },
    printedErrors: { type: "array", items: { type: "string" } },
    observations: { type: "array", items: { type: "string" }, description: "sentences to append verbatim to the contract's observed section" },
    status: { type: "string" },
  },
  required: ["page", "changed", "unresolved", "status"],
};

// ── Helpers (pure; the sandbox has no filesystem) ───────────────────────────
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const modelOpt = MODEL ? { model: MODEL } : {};

// A kun agent type may not resolve in the session that created it (the registry is read at start).
// Fall back to a general-purpose agent that reads the agent file first — the first vision book was
// transcribed exactly that way — rather than failing the run.
// A general-purpose agent carries tools the typed agents deliberately lack. On 2026-09-11 a
// general-purpose adjudicator reached the right verdict and then stalled for 20 minutes inside
// its own advisor call; the typed `adjudicate` agent (Read/Write/Glob only) finished in six.
const NO_CONSULT =
  "Do NOT call any advisor or consultation tool and do not ask questions — decide from the contract, the image and the crops, write the files, return. ";
const FALLBACK = {
  transcribe: "You are acting as the kun `transcribe` agent: read ~/.claude/agents/transcribe.md FIRST and follow it exactly. " + NO_CONSULT,
  adjudicate: "You are acting as the kun `adjudicate` agent: read ~/.claude/agents/adjudicate.md FIRST and follow it exactly. " + NO_CONSULT,
};
async function typed(prompt, opts, type) {
  try {
    return await agent(prompt, { ...opts, agentType: type });
  } catch (e) {
    log(`agent type "${type}" unavailable (${String(e).slice(0, 80)}) — falling back to general-purpose`);
    return agent((FALLBACK[type] || `Read ~/.claude/agents/${type}.md first and follow it. `) + prompt, {
      ...opts,
      agentType: "general-purpose",
    });
  }
}

const transcribePrompt = (pages, outDir, blind, contract) =>
  (blind
    ? "This is a blind transcription. The image and the contract are your ONLY inputs: do NOT open " +
      `${book}/pages-md/<N>.md, ${book}/pages-md-audit/, ${book}/pages-md-verify/, any gold/ directory or ${book}/textbook.md. ` +
      "The run transcript is scanned afterwards and a read that peeked is discarded as a measurement.\n\n"
    : "") +
  `Read the contract ${contract} first — it is authoritative. Then, for each page N below, IN ORDER: read ${book}/pages/N.webp, ` +
  `write the transcription to ${book}/${outDir}/N.md, move to the next page. One page at a time — never read the whole range ` +
  `before writing anything. Create the directory if it does not exist.\n` +
  `Return done = the page numbers you actually wrote, illegible = the pages carrying the contract's illegible marker, ` +
  `printedErrors = "page: what" for any apparent error in the print (transcribed as printed), status = one line. ` +
  `Never paste transcribed text into your answer — it lives in the files.\n\nPages: ${pages.join(", ")}`;

async function wave(pages, outDir, blind, labelPrefix, phaseName, contract) {
  const groups = chunk(pages, BATCH);
  const results = await pipeline(groups, (g) =>
    typed(
      transcribePrompt(g, outDir, blind, contract),
      { label: `${labelPrefix}:${g[0]}-${g[g.length - 1]}`, phase: phaseName, schema: STATUS, ...modelOpt },
      TRANSCRIBER,
    ),
  );
  const done = new Set();
  const printedErrors = [];
  for (const r of results.filter(Boolean)) {
    (r.done || []).forEach((p) => done.add(p));
    printedErrors.push(...(r.printedErrors || []));
  }
  const dead = results.filter((r) => !r).length;
  if (dead) log(`${labelPrefix}: ${dead} of ${groups.length} transcriber batches returned nothing — their pages will show as missing`);
  return { done, printedErrors, missing: pages.filter((p) => !done.has(p)) };
}

const lintRun = (label) =>
  agent(
    `${NOTE_PATHS}Assemble and lint the book at ${book}. Run exactly:\n` +
      `1. mkdir -p ${book}/pages-md-verify\n` +
      `2. python3 ${SCRIPTS}/textbook-assemble.py ${book}   (provenance-only stitch; the grade is added in Persist)\n` +
      `3. python3 ${SCRIPTS}/md-structure.py lint ${book} --grid --json > ${book}/pages-md-verify/lint.json\n` +
      `Return the fields of lint.json: pages, transcribed, missing, blank, tablePages, illegiblePages, suspectPages, suspects, and lintPath = that file's absolute path. ` +
      `Copy the numbers from the script output; do not read or judge any page content.`,
    { label, phase: "Assemble", model: "sonnet", effort: "low", schema: LINT },
  );

// ── Prepare ─────────────────────────────────────────────────────────────────
phase("Prepare");
const prep = await agent(
  `${NOTE_PATHS}Prepare the book at ${book} for vision transcription. Run these deterministic scripts and nothing else:\n` +
    `1. If ${book}/pages/ holds no .webp files: python3 ${SCRIPTS}/textbook-pages.py ${book}\n` +
    `2. If ${book}/pages-md/_CONTRACT.md is missing: python3 ${SCRIPTS}/textbook-contract.py ${book}${FURNITURE ? ` --furniture "${FURNITURE}"` : ""}\n` +
    `3. pages = the numeric stems of ${book}/pages/*.webp, sorted ascending${PAGES ? ` — then keep ONLY these: ${JSON.stringify(PAGES)}` : ""}.\n` +
    `4. bookId = dbSlug from ${book}/structure.json if present, else the directory name; lang = structure.json lang, default "ar".\n` +
    `Return pages, contract (absolute path), lang, bookId, renderWidth (1000), hasStructure. Do not read or summarise any page.`,
  { label: "prepare", phase: "Prepare", model: "sonnet", effort: "low", schema: PREP },
);
if (!prep || !Array.isArray(prep.pages) || !prep.pages.length)
  throw new Error("prepare returned no pages — nothing to transcribe or verify");
log(`${prep.bookId}: ${prep.pages.length} pages · mode ${MODE} · contract ${prep.contract}`);

// ── Transcribe (mode full) ──────────────────────────────────────────────────
const printedErrors = [];
if (MODE === "full") {
  phase("Transcribe");
  const w = await wave(prep.pages, "pages-md", false, "transcribe", "Transcribe", prep.contract);
  printedErrors.push(...w.printedErrors);
  log(`transcribed ${w.done.size}/${prep.pages.length} (self-reported); assemble will verify on disk`);
}

// ── Assemble + lint, retry the pages that are really missing ────────────────
phase("Assemble");
let lint = await lintRun("assemble");
if (!lint) throw new Error("assemble/lint returned nothing — cannot verify what is not stitched");
if (MODE === "full" && lint.missing.length) {
  const retry = PAGES ? lint.missing.filter((p) => PAGES.includes(p)) : lint.missing;
  if (retry.length) {
    log(`${retry.length} pages missing on disk — retrying once: ${retry.slice(0, 30).join(", ")}${retry.length > 30 ? "…" : ""}`);
    const w = await wave(retry, "pages-md", false, "transcribe-retry", "Transcribe", prep.contract);
    printedErrors.push(...w.printedErrors);
    lint = (await lintRun("assemble-retry")) || lint;
  }
}
log(
  `lint: ${lint.transcribed}/${lint.pages} pages, missing ${lint.missing.length}, tables on ${lint.tablePages.length}, ` +
    `illegible marks on ${lint.illegiblePages.length}, structural suspects ${lint.suspectPages.length}`,
);

// ── Verify ──────────────────────────────────────────────────────────────────
phase("Verify");
let scored = null;
if (MODE !== "repair") {
  const sampled = await agent(
    `${NOTE_PATHS}Run: python3 ${SCRIPTS}/md-agreement.py ${book} --sample ${SAMPLE} --seed ${SEED} --risk-json ${lint.lintPath} --risk-cap ${RISK_CAP} --json\n` +
      `Return its random and risk arrays exactly.${PAGES ? ` Then drop any page not in ${JSON.stringify(PAGES)}.` : ""}`,
    { label: "sample", phase: "Verify", model: "sonnet", effort: "low", schema: SAMPLED },
  );
  if (!sampled) throw new Error("sampling returned nothing");
  const auditPages = [...new Set([...sampled.random, ...sampled.risk])].sort((a, b) => a - b);
  log(`blind re-read: ${sampled.random.length} random + ${sampled.risk.length} risk pages`);

  // the audit read and the direction crops are independent — no barrier between them
  const tablePages = PAGES ? lint.tablePages.filter((p) => PAGES.includes(p)) : lint.tablePages;
  await parallel([
    () => wave(auditPages, "pages-md-audit", true, "audit", "Verify", prep.contract),
    async () => {
      if (!tablePages.length) return null;
      const cropped = await agent(
        `${NOTE_PATHS}Run: python3 ${SCRIPTS}/textbook-crop.py right ${book} --pages ${tablePages.join(",")}\n` +
          `Then list which of these pages have NO ${book}/tables-audit/<N>.right.json yet and return them as needRead.`,
        { label: "crops:right", phase: "Verify", model: "sonnet", effort: "low", schema: CROPPED },
      );
      const need = (cropped && cropped.needRead) || [];
      if (!need.length) return null;
      return pipeline(chunk(need, 8), (g) =>
        typed(
          `This is a blind transcription of CROPS. Read ${book}/tables-audit/_TASK.md first and follow it exactly. ` +
            `For each page N in [${g.join(", ")}]: read ${book}/tables-audit/N.right.webp and write ${book}/tables-audit/N.right.json. ` +
            `Do not open any page transcription. Return done = the pages you wrote, status = one line.`,
          { label: `crops:read:${g[0]}-${g[g.length - 1]}`, phase: "Verify", schema: STATUS, ...modelOpt },
          TRANSCRIBER,
        ),
      );
    },
  ]);

  scored = await agent(
    `${NOTE_PATHS}Score the book at ${book}. Run exactly, capturing each JSON output:\n` +
      `1. python3 ${SCRIPTS}/md-agreement.py ${book} --score --pages ${sampled.random.join(",")} --json   → randomMean = meanAgreement, randomN = sampled\n` +
      (sampled.risk.length
        ? `2. python3 ${SCRIPTS}/md-agreement.py ${book} --score --pages ${sampled.risk.join(",")} --json   → riskMean = meanAgreement, riskN = sampled\n`
        : `2. (no risk pages) riskMean = -1, riskN = 0\n`) +
      `3. python3 ${SCRIPTS}/md-agreement.py ${book} --score --json --queue-out ${book}/pages-md-verify/queue.json   → meanBow, meanStruct, classes, queue (page, classes, primary)\n` +
      `4. python3 ${SCRIPTS}/md-table-direction.py ${book}   → mirrored = the page list on the MIRRORED line, unclearDirection = the UNCLEAR pages\n` +
      `Write the combined object to ${book}/pages-md-verify/score.json and return it with scorePath. Copy numbers; do not read page content.`,
    { label: "score", phase: "Verify", model: "sonnet", effort: "low", schema: SCORED },
  );
  if (!scored) throw new Error("scoring returned nothing — no grade can be persisted");
  log(
    `agreement ${(scored.randomMean * 100).toFixed(1)}% over ${scored.randomN} random pages` +
      (scored.riskN ? ` · risk tail ${(scored.riskMean * 100).toFixed(1)}% over ${scored.riskN}` : "") +
      ` · classes ${JSON.stringify(scored.classes || {})} · queue ${scored.queue.length} · mirrored ${(scored.mirrored || []).length}`,
  );
} else {
  scored = await agent(
    `${NOTE_PATHS}Read ${book}/pages-md-verify/score.json (written by an earlier verify run) and return it as-is. If it does not exist, return randomMean=-1, randomN=0, queue=[] and scorePath="".`,
    { label: "score:saved", phase: "Verify", model: "sonnet", effort: "low", schema: SCORED },
  );
  if (!scored || !scored.scorePath) throw new Error("repair mode needs a saved pages-md-verify/score.json from a verify run");
}

// ── Adjudicate ──────────────────────────────────────────────────────────────
phase("Adjudicate");
const repaired = [];
const unresolvedPages = [];
const observations = [];
let queue = scored.queue.map((q) => ({ page: q.page, classes: q.classes || [q.primary], primary: q.primary }));
if (AUDIT) {
  log(`audit mode — ${queue.length} pages queued, nothing repaired`);
  queue = [];
}
for (let round = 1; round <= ROUNDS && queue.length; round++) {
  const cropPages = queue
    .filter((q) => q.classes.some((c) => ["illegible", "structure", "omission", "numeric", "latin"].includes(c)))
    .map((q) => q.page);
  if (cropPages.length)
    await agent(
      `${NOTE_PATHS}Run: python3 ${SCRIPTS}/textbook-crop.py zoom ${book} --pages ${cropPages.join(",")}\nReturn "ok".`,
      { label: `crops:zoom:r${round}`, phase: "Adjudicate", model: "sonnet", effort: "low" },
    );

  const verdicts = await pipeline(queue, (q) =>
    typed(
      `Adjudicate page ${q.page} of the book at ${book}. Read the contract ${prep.contract} first, then the page image ` +
        `${book}/pages/${q.page}.webp, then every crop that exists: ${book}/crops/${q.page}.*.webp and ${book}/tables-audit/${q.page}.right.webp. ` +
        `Read A = ${book}/pages-md/${q.page}.md and B = ${book}/pages-md-audit/${q.page}.md, and this page's entry in ${book}/pages-md-verify/queue.json ` +
        `(its classes, structMismatches and spans). Disagreement classes: ${q.classes.join(", ")}.\n` +
        `Settle every hunk against the print. Write the repaired page to ${book}/pages-md/${q.page}.md and the verdict file ` +
        `${book}/pages-md-verify/${q.page}.json exactly as the adjudicate agent specifies. A hunk the print cannot settle is unresolved ` +
        `and carries the illegible marker — never a third reading. Return page, changed, hunks, unresolved, classes, printedErrors, observations, status.`,
      { label: `adjudicate:${q.page}`, phase: "Adjudicate", schema: VERDICT, ...modelOpt },
      ADJUDICATOR,
    ),
  );
  for (let i = 0; i < queue.length; i++) {
    const v = verdicts[i];
    if (!v) {
      // a dead adjudicator leaves the page AS IS and flags it — never "verified"
      unresolvedPages.push(queue[i].page);
      continue;
    }
    if (v.changed) repaired.push(v.page);
    if (v.unresolved) unresolvedPages.push(v.page);
    observations.push(...(v.observations || []));
    printedErrors.push(...(v.printedErrors || []));
  }

  const obs = [...new Set(observations)];
  await agent(
    `${NOTE_PATHS}Apply the mechanical repairs for round ${round} on ${book}:\n` +
      `1. python3 ${SCRIPTS}/md-table-direction.py ${book} --fix   (reverses ONLY tables the right-edge crops proved mirrored)\n` +
      (obs.length
        ? `2. Append each of these named cases to the contract, one call each: python3 ${SCRIPTS}/textbook-contract.py ${book} --observe "<case>"\n` +
          obs.map((o) => `   - ${o.replace(/"/g, "'")}`).join("\n") + "\n"
        : "2. (no new observations)\n") +
      `Return "ok".`,
    { label: `apply:r${round}`, phase: "Adjudicate", model: "sonnet", effort: "low" },
  );

  const relint = await lintRun(`relint:r${round}`);
  const stillSuspect = relint ? relint.suspectPages.filter((p) => repaired.includes(p)) : [];
  queue = stillSuspect.map((p) => ({ page: p, classes: ["structure"], primary: "structure" }));
  log(`round ${round}: repaired ${repaired.length}, unresolved ${unresolvedPages.length}, still suspect after repair ${stillSuspect.length}`);
  if (relint) lint = relint;
}
if (queue.length) log(`${queue.length} pages remain structurally suspect after ${ROUNDS} rounds — listed in the result, not hidden`);

// ── Persist ─────────────────────────────────────────────────────────────────
phase("Persist");
const result = {
  book,
  bookId: prep.bookId,
  mode: MODE,
  model: MODEL || "session",
  contract: prep.contract,
  pages: lint.pages,
  transcribed: lint.transcribed,
  missing: lint.missing,
  agreement: scored.randomMean,
  agreementN: scored.randomN,
  riskAgreement: scored.riskN ? scored.riskMean : null,
  riskN: scored.riskN || 0,
  meanBow: scored.meanBow ?? null,
  meanStruct: scored.meanStruct ?? null,
  classes: scored.classes || {},
  queued: scored.queue.length,
  repaired: repaired.length,
  repairedPages: repaired,
  unresolved: [...new Set(unresolvedPages)],
  stillSuspect: queue.map((q) => q.page),
  mirrored: scored.mirrored || [],
  observations: [...new Set(observations)],
  printedErrors: [...new Set(printedErrors)],
  audit: AUDIT,
  degraded: lint.missing.length > 0 || scored.randomN < Math.min(SAMPLE, lint.pages),
};
const quality = result.agreement >= 0.95 ? "A" : result.agreement >= 0.9 ? "B" : result.agreement >= 0.8 ? "C" : "D";
result.quality = quality;

if (AUDIT) {
  log("audit mode — nothing persisted");
  return result;
}

await agent(
  `${NOTE_PATHS}Persist the run for the book at ${book}. This is the only phase allowed to write the score.\n` +
    `1. Write this JSON verbatim to ${book}/pages-md-verify/run.json:\n${JSON.stringify(result, null, 1)}\n` +
    `2. Re-assemble with the grade: python3 ${SCRIPTS}/textbook-assemble.py ${book} --agreement ${result.agreement} --agreement-n ${result.agreementN} ` +
    `--note "Headline agreement is the RANDOM sample only (${result.agreementN} pages, seed ${SEED}); the risk-weighted tail scored ${result.riskAgreement ?? "n/a"} over ${result.riskN} suspect pages and is not part of the grade." ` +
    `--note "Failure classes on the sample: ${JSON.stringify(result.classes).replace(/"/g, "'")}. ${result.repaired} pages repaired by adjudication against the scan; post-repair text is NOT independently re-scored." ` +
    (result.unresolved.length ? `--note "Unresolved after adjudication (illegible marker kept): pages ${result.unresolved.join(", ")}." ` : "") +
    (result.mirrored.length ? `--note "Table direction verified by right-edge crops; mirrored tables reversed on pages ${result.mirrored.join(", ")}." ` : "") +
    (MODEL ? `--model ${MODEL} ` : "") +
    `\n3. python3 ${SCRIPTS}/textbook-bench.py persist --scores ${SCORES} --run-result ${book}/pages-md-verify/run.json --book-id ${prep.bookId}${DATE ? ` --date ${DATE}` : ""}\n` +
    `4. Verify: python3 -c "import json;json.load(open('${SCORES.replace("~", "$HOME")}'))" and return "ok" plus the scores path.`,
  { label: "persist", phase: "Persist", model: "sonnet", effort: "low" },
);

return result;
