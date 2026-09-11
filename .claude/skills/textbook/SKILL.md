---
name: textbook
description: Give every curriculum textbook.pdf a verified Markdown twin — vision transcription, blind re-reads, adjudication, a benchmark
when_to_use: "Use when curriculum textbooks (PDF scans, mostly Arabic) must become Markdown twins, or a twin must be verified, repaired or benchmarked. Triggers on: textbook markdown, textbook.md, convert the textbooks, pdf to md for grade N, re-transcribe the textbooks, fix the textbook twin, textbook bench."
argument-hint: "<book-dir> [--mode full|verify|repair] [--sample N] [--rounds N] [--audit] | bench [book-id] [--label L] [--model M] | gold <book-id> <pages>"
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
`disputed`); `gold` mode adjudicates the disputes; `freeze` hashes the gold. **Blind runs write
to `bench-runs/<label>/` and never open `pages-md/`, `gold/` or the manifest** — the transcript
audit fails the run on any such read, and the entry is persisted `invalid`.

Corpus today: `sd-g12-biology`, 30 pages across dense labels, unreadable labels, diagram-as-table,
RTL/notation tables, multi-figure, ordering/interpretation, repair traps, edge and control pages;
4 pages adjudicated against the scan, the rest candidate.

## Cost, measured

**~11,000 tokens per page** on opus (reasoning + writes dominate, not the ~1,900 image tokens).
A 253-page book ≈ 3M tokens to transcribe; verify adds ~25 pages; adjudication ~15k per queued
page; the 30-page benchmark ≈ 350k per run. Concurrency caps at ~16 agents.

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

## Upload (only when asked)

`pnpm tsx scripts/upload-textbooks-all.ts --force --assets=textbook.md --only=<slugs> --bucket=databayt-cdn`,
then again without `--bucket`; invalidate `/catalog/textbooks/<slug>/*` on CloudFront `E3PHDXTDSBCQSJ`;
verify over HTTPS. **The reader serves the twin from the CDN, so a repair is not live until this runs.**
Then record: `curriculum/<code>/TEXTBOOK_AUDIT.md`, the block ISSUE, memory.

## Files

| Path                                          | Role                                                              |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `.claude/workflows/textbook.js`               | the harness — one book, six phases                                |
| `.claude/workflows/textbook-bench.js`         | the benchmark runner                                              |
| `.claude/agents/transcribe.md`                | page/crop reader, narrow toolset, blind when told                 |
| `.claude/agents/adjudicate.md`                | settles hunks against the scan; the only agent that edits a page  |
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
