---
name: textbook
description: Give every curriculum textbook.pdf a verified Markdown twin — vision transcription, blind re-reads, adjudication, a benchmark
when_to_use: "Use when curriculum textbooks (PDF scans, mostly Arabic) must become Markdown twins, or a twin must be verified, repaired or benchmarked. Triggers on: textbook markdown, textbook.md, convert the textbooks, pdf to md for grade N, re-transcribe the textbooks, fix the textbook twin, textbook bench."
argument-hint: "<book-dir> [--mode full|verify|repair] [--sample N] [--rounds N] [--audit] | bench [book-id] [--label L] [--model M]"
---

# Textbook → verified Markdown twin

Every `textbook.pdf` under a curriculum tree gets a `textbook.md` beside it. The twin is
produced by **reading the page images with a vision model** — not OCR — and it is trusted only
as far as **a second, blind read agrees with it**, on text AND on structure. Disagreements are
not averaged away: each one is **adjudicated against the scan**, the page is repaired, and the
contract learns the case so the next book does not repeat it. A **benchmark corpus** of the
hardest pages measures the pipeline itself, so a contract or model change is a number, not an
opinion. Nothing here knows a subject: headings come from `structure.json`, the language decides
direction and markers, the corpus is per book.

## The harness — `.claude/workflows/textbook.js`

```
Workflow({ name: "textbook", args: { book: "/abs/path/to/book-dir", mode: "full" } })
```

| Phase      | What it does                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Preflight  | **formatter canary through the Write TOOL** (a shell write does not fire hooks) + `textbook-preflight.py`: vector-vs-scan, digit script, reference direction. A failed canary ABORTS the run |
| Prepare    | `textbook-pages.py` renders `pages/<N>.webp` (1000 px) if missing; `textbook-contract.py` templates `pages-md/_CONTRACT.md` from `structure.json` |
| Transcribe | 12 pages per `transcribe` agent, one `pages-md/<N>.md` each, one status line back; pages missing on disk retried once |
| Assemble   | `textbook-assemble.py` stitches with provenance; `md-structure.py lint --grid` parses every page with the READER's grammar and lists suspects: tables without a printed grid, composed captions, headings not in the structure, ragged tables, marks |
| Verify     | a random sample (headline) + a risk sample (suspects, illegible, table pages) is **re-read blind**; `md-agreement.py` scores six axes and classes every page; right-edge crops (`textbook-crop.py right`) + `md-table-direction.py` settle table direction physically |
| Adjudicate | every queued page → the `adjudicate` agent with the image, native-density crops (`textbook-crop.py zoom`), both reads and the hunks; repairs the page, writes `pages-md-verify/<N>.json`; mirrored tables reversed; observations appended to the contract; re-lint; up to `rounds` passes |
| Persist    | re-assemble with the grade; `textbook-bench.py persist --run-result` writes `~/kun/.claude/memory/textbook-scores.json` — the only writer |

Modes: `full` (everything), `verify` (skip transcription — verify and repair what is on disk),
`repair` (adjudicate the saved queue only). `--audit` measures and queues but repairs nothing
and persists nothing. Args: `sample` (default 12), `riskCap` (12), `seed` (7 — vary it per run;
the sandbox has no randomness), `rounds` (2), `batch` (12), `model`, `date`.

**The kun agent types may not resolve in the session that created them.** Both workflows fall
back to `general-purpose` reading `~/.claude/agents/<name>.md` first — the first vision book was
transcribed exactly that way. The fallback prompt forbids advisor/consultation calls: a
general-purpose adjudicator once reached the right verdict on page 196 and then stalled for 20
minutes inside its own advisor call, while the typed `adjudicate` agent (Read/Write/Glob only)
settled 12 hunks in six minutes.

## What the numbers mean

- **Headline = the random sample's `seq` agreement**, nothing else. The risk sample is the tail
  and is reported beside it; post-adjudication text is NOT re-scored as independent, because the
  adjudicator saw both reads. Thresholds A ≥ 0.95 · B ≥ 0.90 · C ≥ 0.80 are **provisional**
  (`engine.json` → `textbook.thresholds`; set on one book at n = 21, opus).
- **Classes decide the repair, not the mean.** `md-agreement.py` labels every sampled page:
  `structure` (tables, dims, figures, captions, label sets differ) · `omission` (a run of ≥ 6
  words in one read only) · `numeric` · `latin` · `illegible` (one read marked, the other wrote
  text — a guess suspect) · `ordering` (same words, different order — noise unless the contract
  defines an order) · `wording` · `clean`. Only the first six enter the queue.
- **Structure is scored on the reader's grammar** (`hogwarts textbook/parse.ts`, ported into
  `md-structure.py`): a "table" is what a student sees as a grid. A Markdown table on a page with
  no ruled or shaded grid is the diagram-as-table defect the first book showed on pages 146/150.
- **Direction is never judged, only observed**: crop the right 45 % and ask what is in it.
  On the first book 8 of 31 tables were mirrored and 23 were right — never blanket-swap.

## The benchmark — `.claude/workflows/textbook-bench.js`

```
Workflow({ name: "textbook-bench", args: { book: "sd-g12-biology", label: "contract-v2", model: "sonnet" } })
node ~/kun/.claude/scripts/audit-textbook-run.mjs --latest --out-dir <run dir>   # then, always
```

`.claude/evals/textbook/manifest.json` holds per-book cases: a page, its failure classes, why it
is there, and **objective assertions** — raw `mustContain`/`mustNotContain` (repair traps like
`(الصورة 51)`, interpretive words that must not appear), numeral and Latin token sets, an
order-insensitive label set, table count/dims and the crop-verified rightmost column, `noTable`
for diagrams, figure count, `illegibleMin/Max` for the never-guess discipline. Gold text sits
beside them as a secondary signal. `textbook-bench.py score` is deterministic; it reports per
kind, per class, and whether the run is `comparable` (gold hash + contract hash + model recorded).
`propose` seeds a corpus from two reads on disk (what both contain is safe, the rest is
`disputed`); promoting a case from `candidate` to `adjudicated` is **manual until wired**: run the
`adjudicate` agent on the disputed page with its output directed to `gold/<N>.md`, edit the
assertions with the page image open, then `freeze` hashes the gold. **Blind runs write
to `bench-runs/<label>/` and never open `pages-md/`, `gold/` or the manifest** — the transcript
audit fails the run on any such read, and the entry is persisted `invalid`.

Corpus today: `sd-g12-biology`, 30 pages across dense labels, unreadable labels, diagram-as-table,
RTL/notation tables, multi-figure, ordering/interpretation, repair traps, edge and control pages;
4 pages adjudicated against the scan, the rest candidate.

## Cost, measured (5 books)

**~9,000 tokens/page** to transcribe. **Verify + adjudicate is 2–3.5M per book — more than
transcription on a small book** (math: 3.49M verify vs ~1.8M transcribe). A usage window holds
roughly 3.5M and then hard-stops mid-phase. **Batch 8 pages, not 12** (12 stalls more often under
the 600s no-progress watchdog) and run **one book at a time**: four concurrent books exhausted a
window in 13 minutes and left four half-books. Pages are written one at a time and survive a kill,
so an interruption costs time, not work.

## Why not OCR (settled on sd/g12/biology, 2026-09-09)

Same book, same pages: tesseract 143,153 Arabic chars / **0 Latin** / 6 table rows / 0 captions /
3 empty pages; vision 180,323 / 7,324 / 276 / 144 / 0. Page 112 — a full-page flowchart — gave
tesseract zero characters. And the old grader counted whether output *looked like* Arabic, so a
47 %-coverage twin scored "A". Never reintroduce a coverage-derived grade. `textbook-md.py`
remains only as the MarkItDown/OCR lane for books whose text layer is genuinely clean.

## The failure mode: repair drift

Transcribers rationalise silent fixes — two printed figure numbers "corrected" by cross-reference,
`ڤ` normalised to `ف`, interpretive words added to raw labels, a caption composed for an
uncaptioned figure. The abstract rule did not hold; **the contract's "Observed in this book"
section, populated with named cases by the adjudicate phase, did.** Tool-call counts are not a
drift signal (measured, disproved).

## The book gate — a twin is not allowed before the book is verified

The catalog enforces an order: `book` -> `structure` -> `twin` -> `assessment`
(`~/catalog/CLAUDE.md` invariant 8, `pnpm gate`). **Check it before transcribing anything:**

```bash
cd ~/catalog && pnpm gate sd --grade g12 --enforce none   # the subject must show book ✅
```

A subject whose `book` gate fails has no verified edition, or its `structure.json`
`verification.pdfSha256` no longer matches the locked PDF — transcribing it produces a twin of a
book nobody has established is the right one. Run `pnpm verify` first (`~/catalog/docs/verification.md`).

The `twin` gate is what this skill earns, and it deliberately ignores `textbook.md`'s `quality`
letter: the retired OCR grader scored coverage, so a 47 %-complete twin could read "A". It passes
only on `extraction: "vision"` with a real two-read `agreement` at or above the B threshold, a
`pages-md/` page count equal to the book's, and a `sourceMd5`. Front matter is the gate's input, so
the assemble step's stamp is not cosmetic.

## Where books live — stage, run, land

Books live in the **catalog** repo (`~/catalog`, `databayt/catalog`), which mirrors the CDN: the book folder
`~/catalog/<cur>/<grade>/<subject>/` IS `cdn.databayt.org/catalog/<cur>/<grade>/<subject>/`. That folder holds only
canonical files, and the validator rejects pipeline scratch there. So the pipeline runs on a **staged copy** in
the gitignored `.work/`, and only the outputs are landed back:

```bash
C=~/catalog/sd/g12/biology; W=~/catalog/.work/sd/g12/biology
cd ~/catalog && pnpm assets pull sd/g12/biology       # binaries (pdf, pages) if not present
mkdir -p $W && cp -Rc $C/ $W/                           # stage (APFS clone — instant)
# run the workflow / scripts with book = $W
cp -c $W/textbook.md $C/ && rsync -a $W/pages-md/ $C/pages-md/ && rsync -a $W/pages/ $C/pages/   # land
pnpm assets lock && pnpm validate && pnpm index        # then commit on main
```

## What five books taught the pipeline (read this before book six)

**A formatter hook is the one defect no score here can see.** `prettier --write` on a PostToolUse
Write/Edit hook renumbers `9)` to `8.` and rewrites a `- +` bullet to `- -` — fabricating content.
The blind second read goes through the same tool and is damaged **identically**, so
`md-agreement.py` diffs two corrupted files and reports agreement. The Preflight canary is the only
detector, and it must use the **Write tool**: a shell write does not fire hooks. `.prettierignore`
is NOT a fix (prettier resolves it from the CWD, and agents `cd` into the book), and a settings
guard is not durable — `/model` silently reverted one. Re-verify per wave, never once per session.

**Render kind is per book; 16 of 25 sd/g12 pdfs are VECTOR.** On those the 1000 px page images throw
away detail that small integral limits, subscripts and diacritics live in — a 3× page render reads
them. `textbook-crop.py native` cannot tell you this: it inspects **embedded rasters only**, so it
returns `zoomHelps:false` on a vector page whose text is perfectly sharp at 3×. Classify from the
TEXT LAYER, not the image count. Shipped `pages/*.webp` stay 1000 px; hi-res is for transcription.

**Reference direction is per book and tracks the DIGIT SCRIPT.** chemistry (Latin digits, bidi EN)
stores `(1-17)` for a reference drawn `17 - 1` — chapter first. agriculture (Arabic-Indic, bidi AN)
stores what it draws. Carrying one book's answer to the next **reverses every reference in it**.
`textbook-preflight.py` measures it from the text layer and returns `unknown` below 8 digit runs —
it once produced a confident verdict on 2 runs that a 3× render flatly contradicted. When it is
unknown, settle it on a reference whose meaning is fixed (an exercise number inside a known unit).

**`[غير مقروء]` means ink you cannot read, NOT "nothing is printed."** Four `نها` on one page were
marked illegible when the book simply prints no limit. A false marker sends adjudication hunting
for glyphs that do not exist and hides a real defect behind a transcription caveat.

**Never restore what the page omits, and never fix it with a script.** These books drop integral
signs (including from a boxed integration-by-parts formula, both sides), exponents, minus signs and
the constant factors their own substitutions introduce. Transcribe and report. When a systematic
error IS found, re-transcribe the affected batches — a regex pass over transcribed content is
repair drift with a script instead of an agent, and it silently breaks the legitimate exceptions
(a cross-chapter reference keeps its own chapter).

**A half-dead verify reports itself CLEAN.** When the usage window dies during Adjudicate the
workflow still returns `degraded:false`, `repaired:0`, a letter grade and a long `unresolved` list.
`repaired:0` means the stage never RAN. Check `agents_error == 0` **and** that the book reached
`textbook-scores.json`; recover with `mode:"repair"`, which reuses the surviving `queue.json`.

**Resume from DISK, never from a failure list.** `textbook.js` re-transcribes every page in
`prep.pages`, and its `pages` arg narrows the whole book, so a `full` run with `pages:[missing]`
assembles a PARTIAL book. Compute gaps as `pages/*.webp` stems minus `pages-md/*.md` stems — dead
batches write partial ranges, so the failed range is not the gap.

**The contract is the only lever that has paid.** Promoting book-agnostic observations into
`textbook-contract.py` cut physics' queued pages 24 → 10 and its verify 3.49M → 2.15M tokens versus
math. Do it after every book.

## Upload (only when asked)

From `~/catalog`, **scoped to the book** so a one-subject fix cannot replace another grade's files:

```bash
pnpm assets push sd/g12/biology --apply                      # new page renders / PDF
pnpm publish:cdn sd/g12/biology --overwrite --apply          # textbook.md, pages-md, structure.json
```

Both are additive; replacing a key that is already live (a re-transcribed `textbook.md`) needs
`--overwrite`, and both writers now invalidate CloudFront, which binaries require because they are
cached `immutable` for a year. Verify over HTTPS — and know that most g12 text keys predate
`CATALOG_EPOCH`, so without `--overwrite` a publish reports success and changes nothing. On
2026-09-28 that gap was real: the CDN was still serving the **tesseract** twin for all four
vision-transcribed books, months after they were re-read. **The reader serves the twin from the CDN, so a repair is not live
until this runs.** Then record: the book's `structure.json` history if it changed, the block ISSUE, memory.

## Files

| Path                                          | Role                                                              |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `.claude/workflows/textbook.js`               | the harness — one book, six phases                                |
| `.claude/workflows/textbook-bench.js`         | the benchmark runner                                              |
| `.claude/agents/transcribe.md`                | page/crop reader, narrow toolset, blind when told                 |
| `.claude/agents/adjudicate.md`                | settles hunks against the scan; the only agent that edits a page  |
| `skills/textbook/scripts/textbook-preflight.py`| vector-vs-scan, digit script, reference direction — before a token is spent |
| `skills/textbook/scripts/textbook-contract.py`| contract from structure.json + the observed-cases section         |
| `skills/textbook/scripts/md-structure.py`     | reader-grammar signature, lint, grid detector                     |
| `skills/textbook/scripts/md-agreement.py`     | stratified sampling; six-axis scoring; classes; repair queue      |
| `skills/textbook/scripts/textbook-crop.py`    | right-edge crops, native-density figure crops, native-size report |
| `skills/textbook/scripts/md-table-direction.py` | report / `--fix` mirrored tables from crop truth               |
| `skills/textbook/scripts/textbook-assemble.py`| stitch + provenance front matter                                  |
| `skills/textbook/scripts/textbook-bench.py`   | propose / score / freeze / persist / report                       |
| `.claude/scripts/audit-textbook-run.mjs`      | post-run contamination check on blind reads                       |
| `.claude/evals/textbook/`                     | manifest + per-book gold                                          |
| `.claude/memory/textbook-scores.json`         | measured state — books and benchmark history                      |

## Exit gate

A run is reportable only when every page is on disk, the random sample was fully re-read blind,
the transcript audit is CLEAN, and unresolved pages are listed. Otherwise it is **DEGRADED** and is
persisted as such — never as a clean grade.

$ARGUMENTS
