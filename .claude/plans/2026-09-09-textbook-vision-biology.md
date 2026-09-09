# Textbook twins: replace tesseract with vision — sd/g12/biology first

Date: 2026-09-09 · Scope this session: `curriculum/sd/g12/biology` only.

## Diagnosis

Two defects, one of them in the config itself.

1. **Tesseract is the wrong engine for these scans.** Not a tuning problem.
   Measured on biology (253 pages, `coverage: 47`, `quality: A`):
   - p112 — full-page spermatogenesis flowchart — tesseract produced **0 characters**.
     Vision read every label (الخلايا المولدة / مرحلة النمو / ميوزي 1 / ميوزي 2 /
     التمايز / حيوانات منوية) plus the caption الشكل (56).
   - p42 — comparison table — tesseract destroyed every number
     (`٠ قطعة 6٠٠.٠. قطعة`); vision read ١٠٠٠/٢٠٠٠ segments, ٤٠٠٠٠/٨٠٠٠٠ eggs,
     ٧–١٢ / ١٥–٣٥ uterine branches, and the English `Taenia solium`, `hooks`,
     `suckers`, `Proglottids`.
   - p169 — blood-group genetics — tesseract 45 Arabic chars of noise; vision read
     the full I^A / I^B / I^B i superscript notation.
   - 29 of 253 pages sit under 200 Arabic chars. Those are the **diagram** pages,
     which in a biology text carry much of the teaching content.

2. **The grader certifies garbage.** `quality: A` with `coverage: 47` is not a
   contradiction the current script can see, because it only counts whether the
   output *looks like Arabic letters*. It never measured correctness. Biology got
   an A. Across g12, `math` got an A at 28 % coverage. The grade must not survive
   in its present form.

## The input already exists

`pages/<N>.webp` — 1000×1415, ~60 KB, 253 of them — are already rendered for every
g12 book and already on the CDN. The 1000 px render was verified legible against a
1654 px re-render on p42: identical reading. **No re-render, no new storage.**
Under Anthropic's 1568 px cap, each page costs ~1,900 image tokens.

## Pipeline

1. **Batch** 10–12 pages per subagent call (~26 calls for biology).
2. **Subagents write to disk, never return prose.** Each writes
   `pages-md/<N>.md` and returns one status line. Keeps Arabic out of the parent
   context and gives page-level resume for free — sessions die mid-run.
3. **Assemble** deterministically from `pages-md/` in numeric order, preserving
   `<!-- page N -->` markers so the reader's page-image strip stays aligned.
4. **Per-page contract**: transcribe, do not correct or normalize; logical reading
   order; real markdown tables; `![caption](pages/N.webp)` for figures with the
   caption transcribed; Latin/scientific terms kept inline; LaTeX for notation;
   illegible spans marked `[غير مقروء]` — never guessed. Headings aligned to
   `structure.json` chapter titles so contents links land.
5. **Grade by agreement, not by coverage.** Re-transcribe ~5 % of pages with a
   fresh agent, diff normalized Arabic, report the agreement rate. Coverage alone
   produced the false A; do not rebuild that lie.
6. **Provenance.** Keep tesseract output as `textbook.ocr.md`. Front matter records
   `extraction: vision`, the model, and the agreement score. No `quality:` field
   until the agreement grader has run.

Estimated cost: ~750 k tokens for biology.

## kun config — written AFTER the run, from what actually worked

- Rewrite `textbook` SKILL.md: vision-first; tesseract demoted; record the
  false-A grader bug so it cannot be repeated on another grade.
- New `md` keyword — the shared markdown *quality standard*: the schema above,
  the RTL repair rules, the agreement grader. No collision: `convert` is
  MarkItDown one-off file→md; `textbook` is book-scale orchestration; `md` is the
  bar both are held to.
- New `textbook`/`transcribe` subagent (none exists today) with a narrow toolset
  — read images, write one file — so it cannot wander.
- Scripts: `textbook-vision.py` (batch driver, assembler, checkpoints),
  `md-agreement.py` (the grader).
- No new MCP required. Reading local page images is native; markitdown MCP keeps
  its one-off lane.

---

# Results — 2026-09-09, same session

**Done and on disk.** All 253 pages transcribed, assembled to
`curriculum/sd/g12/biology/textbook.md`. Old file kept as `textbook.ocr.md`.
**Not uploaded to the CDN** — the reader serves the twin from there, so the fix
is not live until someone says the word.

| metric | tesseract | vision |
|---|---:|---:|
| Arabic characters | 143,153 | 180,323 |
| Latin (scientific terms) | 0 | 7,324 |
| table rows | 6 | 276 |
| figures with captions | 0 | 144 |
| pages yielding no text | 3 | 0 |

**Grade: B, agreement 94.8 % over 21 pages (8 %).** Not A. The metric was not
tuned to reach a nicer letter — that would be the exact sin this replaced.
Inspecting every sub-90 % page showed the residual is **diagram-label ordering**
(identical word counts, different sequence) and completeness differences on dense
figures. No fabricated prose in any sampled page.

## What was learned

- **Cost is ~11k tokens/page**, not the ~3k an image-token estimate suggests —
  agent reasoning and file writes dominate. Biology ≈ 3M tokens over 21 agents.
  The original estimate in this plan was wrong by 3.7×.
- **Concurrency caps at 20 subagents.** A 250-page book is one wave.
- **Correction drift is the real failure mode.** One agent silently "fixed" two
  printed figure numbers by cross-referencing later pages and normalised `ڤ`→`ف`,
  reporting it as an improvement. Reverted. The contract gained a "Do not repair
  the book" clause naming those exact cases; after that, audit agents began
  *reporting* book typos (reversed Mendel dates, `OBA` for `ABO`) instead of
  fixing them. The abstract rule was not enough — the named example was.
- **Tool-use count is NOT a drift detector.** The drifting agent used a normal 29
  calls; the 87–131-call agents were on diagram-dense pages and their output was
  more complete than the audit's. A plausible detector, disproved by measurement.
- **1000 px renders are sufficient** — verified against a 1654 px re-render on a
  dense table page, identical reading. No re-render, no new storage.
- **Thresholds are provisional** (n=21, one book, opus). Sonnet untested, and
  the `transcribe` agent is untested — the run used `general-purpose`.

## Open

- **Table column direction — extent UNMEASURED.** Contract asks
  rightmost-printed-first; on the two pages checked against the scan (42, 169)
  the transcriber emitted leftmost-first, which under the reader's `dir="rtl"`
  renders those tables mirrored. Only 5 audited pages carry tables in both runs
  and 2 disagree structurally, so "systematic" was an over-claim from n=2 and the
  fix (contract wording vs post-process swap) is undecided. Measure first.
- **CDN upload** for `sd-g12-biology`, plus CloudFront invalidation.
- **The other 24 g12 books** still carry OCR twins graded A on a coverage metric
  that cannot see correctness. ~4,700 pages, ~50M tokens at the measured rate.

## Config landed in kun

- `skills/textbook/SKILL.md` rewritten vision-first, with the measured numbers.
- `skills/md/SKILL.md` — new: the shared Markdown quality standard.
- `agents/transcribe.md` — new: narrow toolset (Read/Write/Glob only).
- `skills/textbook/scripts/textbook-assemble.py` — new: stitch + provenance,
  grades by agreement.
- `skills/textbook/scripts/md-agreement.py` — new: the sampling grader.
- `vocabulary.json` — `md` spell added, `textbook` spell rewritten.

## Correction, same session

The first write-up said tesseract extracted 1,060 Latin characters and vision
8,336. Both counts included the word "page" in 253 `<!-- page N -->` markers.
Excluding comments the real figures are **0 and 7,324**: tesseract with `-l ara`
recovered no Latin letters at all, so every scientific term in the book was lost.
The corrected row is a stronger result than the one it replaces.
