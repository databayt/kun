---
name: textbook
description: Give every curriculum textbook.pdf a Markdown twin by vision transcription, graded by agreement
when_to_use: "Use when curriculum textbooks (PDF scans, mostly Arabic) must become Markdown next to the PDF and on the CDN — per subject, per grade, or a whole curriculum. Triggers on: textbook markdown, textbook.md, convert the textbooks, pdf to md for grade N, re-transcribe the textbooks, fix the textbook twin."
argument-hint: "<curriculum> <grade|subject-dir> [--audit N] [--upload]"
---

# Textbook → Markdown twin

Every `textbook.pdf` under a curriculum tree gets a `textbook.md` beside it. The
twin is produced by **reading the page images with a vision model** — not OCR —
and it is graded by **agreement between two independent reads**, never by a
character count.

## Why not OCR (settled on sd/g12/biology, 2026-09-09)

Tesseract is the wrong engine for these scans and it is not a tuning problem.
Measured on the same book, same pages:

| | tesseract | vision |
|---|---:|---:|
| Arabic characters | 143,153 | 180,323 |
| Latin (scientific terms) | 0 | 7,324 |
| table rows | 6 | 276 |
| figures with captions | 0 | 144 |
| pages yielding no text | 3 | 0 |

Page 112 is the whole argument: a full-page spermatogenesis flowchart where
tesseract produced **zero characters** and vision read all nine labels plus the
caption. 29 of 253 pages held under 200 Arabic characters, and they were the
diagram pages — which in a science textbook carry much of the teaching.

**The old grader certified garbage.** It counted whether output looked like
Arabic letters, so biology scored `quality: A` at `coverage: 47`, and g12 maths
scored A at 28. Never reintroduce a coverage-derived grade.

## Pipeline

1. **Renders already exist.** `pages/<N>.webp` (1000 px, ~60 KB) from
   `textbook-pages.py`. 1000 px was verified legible against a 1654 px
   re-render on a dense table page — identical reading. Do not re-render; each
   page costs ~1,900 image tokens under the 1568 px cap.
2. **Write the contract first** to `pages-md/_CONTRACT.md` — the per-book rules
   (reading order, headings from `structure.json`, tables, figures, notation,
   the no-guessing and no-repairing clauses). Every agent reads this one file.
   Editing the contract is how you fix systematic output problems.
3. **Fan out, 12 pages per agent.** (The `transcribe` agent exists for this and
   is **untested** — the biology run used `general-purpose` with the contract.) Each agent reads one image, writes
   `pages-md/<N>.md`, moves on, and returns **one status line**. Agents must
   never return prose: 253 pages of Arabic through the parent is a context bomb,
   and per-page files give resume for free when a session dies.
   **Concurrency cap is 20 subagents** — a 250-page book is one full wave, a
   400-page book is two.
4. **Assemble** — `textbook-assemble.py <book> --model … --agreement … --note …`
   stitches `pages-md/` in numeric order, preserves `<!-- page N -->` markers so
   the reader's page-image strip stays aligned, and writes provenance front
   matter. It reports missing pages rather than silently skipping them.
5. **Grade by agreement** — `md-agreement.py <book> --sample N` picks pages,
   a fresh agent re-transcribes them into `pages-md-audit/`, then `--score`
   diffs normalised Arabic. Feed the mean back into the assembler.
   The audit pass MUST use the current contract, so the score partly measures
   contract drift — that is intended.
6. **Keep the old file** as `textbook.ocr.md`. Front matter records
   `extraction: vision`, the model, the agreement and the sample size.

## Cost, measured

**~11,000 tokens per page**, not the ~3,000 an image-token estimate suggests —
the gap is the agent's own reasoning and file writes. A 12-page agent ran
130–190k tokens; the 253-page biology book cost roughly **3M tokens** across 21
agents. Budget a grade from that, not from image size.

## The failure mode: correction drift

Agents rationalise silent repairs. On biology one transcriber "corrected" a
printed `(الصورة 51)` to 15 and `(الصورة 42)` to 24 by cross-referencing later
pages, and normalised the book's `ڤ` to `ف`. It reported these as improvements.
They were reverted and the contract gained an explicit **"Do not repair the
book"** clause naming those exact cases. After that, audit agents began
*reporting* book typos instead of fixing them — reversed Mendel dates, a
mismatched cross-table label, `OBA` for `ABO`. Keep that clause verbatim.

**Tool-use count is NOT a drift signal.** The agent that altered text used a
normal 29 calls; the 87–131-call agents were working diagram-dense pages and
their output was, if anything, more complete than the audit's. Do not build a
detector on it. Drift is caught by the contract and by reading status lines.

## Reading the agreement number

Biology scored **94.8 % over 21 pages (8 %)**. Inspect the weakest pages before
trusting or distrusting the number: there, every sub-90 % page was **diagram-label
ordering** (identical word counts, labels listed in a different sequence) or a
completeness difference on a dense figure. No fabricated prose appeared in any
sampled page. A low score from label ordering is not the same defect as a low
score from invented text — look, do not just read the percentage.

Thresholds (A ≥ 0.95, B ≥ 0.90, C ≥ 0.80) are **provisional**, set on one book
at n=21. Model was **opus**; sonnet is untested on this task.

## Table column direction — solved, and how

Under `dir="rtl"` Markdown column 1 renders at the RIGHT edge, so column 1 must
carry the **rightmost printed** column or the table renders mirrored against the
book. On biology, 8 of 31 checkable tables were mirrored. Not systematic — 23
were already right, so a blanket swap would have corrupted the majority.

**Do not ask an agent which column is on the right.** Asked to judge direction on
a full page, transcribers get it backwards — it is the same confusion that
creates the bug. A first audit pass reported page 42's rightmost column as
`تينيا ساجيناتا` when the scan plainly shows `تينيا سوليوم`.

**Crop instead.** Render the right ~45 % of the page and ask only "what is in
this image". Position becomes physical, and there is no direction judgment left
to get wrong. That pass matched every page hand-checked against the scan.

```bash
# 1. crop the right 45% of each page carrying a table (PyMuPDF clip)
# 2. an agent writes tables-audit/<N>.right.json: rightmostFirstCell, nextToItsLeft
# 3. compare + fix
md-table-direction.py <book>          # report
md-table-direction.py <book> --fix    # reverse only the MIRRORED tables
```

Reversing a whole row is safe even for a Punnett square: header and body reverse
together, so row × column still lands on the same genotype, and the corner label
moves to whichever end the print has it.

Two things the checker must handle, both found the hard way: a **blank header
row** carries no signal, so fall through to the first row with content (page 169
scored 0.00 both ways until then); and **near-identical labels** (`القائمة (أ)`
vs `القائمة (ب)`) score ~0.89 against each other, so an exact match on one end
must decide it regardless of margin.

Leave alone what is not a printed grid: on 2 pages the Markdown "table" renders a
cross DIAGRAM, where column direction is meaningless.

## Upload (only when asked)

`pnpm tsx scripts/upload-textbooks-all.ts --force --assets=textbook.md
--only=<slugs> --bucket=databayt-cdn`, then again without `--bucket`. Objects are
`immutable, max-age=1y`: after overwriting a key, invalidate
`/catalog/textbooks/<slug>/*` on CloudFront `E3PHDXTDSBCQSJ`. Verify over HTTPS,
not the S3 API. **The reader serves the twin from the CDN, so a re-transcription
is not live until this runs.**

Then record: the grade table in `curriculum/<code>/TEXTBOOK_AUDIT.md`, the block
ISSUE, and memory.

Convert textbooks: $ARGUMENTS
