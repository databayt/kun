---
name: textbook
description: Give every curriculum textbook.pdf a graded Markdown twin (MarkItDown → RTL fix → OCR fallback → CDN)
when_to_use: "Use when curriculum textbooks (PDF scans or text-layer PDFs, mostly Arabic) must become Markdown next to the PDF and on the CDN — per subject, per grade, or a whole curriculum. Triggers on: textbook markdown, textbook.md, convert the textbooks, pdf to md for grade N, OCR the textbooks, markitdown the curriculum."
argument-hint: "<curriculum> <grade|subject-dir> [--ocr auto|off|force] [--upload]"
---

# Textbook → Markdown twin

Every `textbook.pdf` under a curriculum tree gets a `textbook.md` beside it, then both
travel to the CDN under the same key prefix. The Markdown is produced by Microsoft
**MarkItDown** (the `convert` keyword's engine), repaired for Arabic, graded from measured
facts, and — when the text layer is a scan or a font without a Unicode map — read by
**tesseract** OCR instead. The front matter always says which engine produced the file
and how good it is; the file never contains invented text.

## Arguments

- `$1` curriculum code (`sd`, `uk`, `in`, …) — the tree under `curriculum/<code>/`.
- `$2` a grade (`g12`) or one subject dir (`g12/physics`).
- `--ocr auto|off|force` — `auto` (default) runs OCR only when MarkItDown grades EMPTY or C.
- `--upload` — after generating, push the `.md` (and any new PDF/cover) to BOTH buckets.

## Process

1. **Generate** — `python3 ~/.claude/skills/textbook/scripts/textbook-md.py curriculum/<code>/<grade>/*/`
   (installed copy; canonical: `kun/.claude/skills/textbook/scripts/textbook-md.py`).
   One JSON line per subject: `quality`, `coverage`, `engine`, `extraction`.
2. **Read the grades** before anything else. A = clean, B = readable with unmapped
   letters, C = fragments, EMPTY = nothing usable. Decide per book whether OCR is worth
   it (`--ocr force` on a dir) — never ship an EMPTY twin as if it were text.
3. **Upload** (hogwarts) — `pnpm tsx scripts/upload-textbooks-all.ts --force --assets=textbook.md
--only=<slugs> --bucket=databayt-cdn`, then the same without `--bucket` (app bucket).
   New subjects also need `--assets=textbook.pdf,cover.jpg`. Objects are `immutable,
max-age=1y`: after overwriting a key, invalidate `/catalog/textbooks/<slug>/*` on
   CloudFront `E3PHDXTDSBCQSJ`. Verify over HTTPS (`content-type: text/markdown`), not the S3 API.
4. **Record** — grade table in the curriculum ledger (`curriculum/<code>/TEXTBOOK_AUDIT.md`
   for Sudan), the block ISSUE, and memory.

## What the engines can and cannot do (learned on Sudan grade 12, 2026-09-05)

- **MarkItDown = pdfminer text extraction, no OCR.** On Arabic textbooks the raw output is
  unusable without the RTL pass: pdfminer emits Arabic in _visual_ order (every word
  letter-reversed), many fonts store presentation-form glyphs (U+FExx), and fonts without a
  ToUnicode map yield `(cid:NN)` tokens carrying no text at all. The script's post-processing
  handles the first two; nothing can recover the third — that is an OCR job.
- **Yield on old NCCER scans**: 10 of 25 grade-12 books had a usable text layer (A: 3, B: 4,
  C: 3); 15 were EMPTY (5 pure scans, 10 unmapped fonts). Expect the same on other grades.
- **Ligature trap**: a glyph that expands to several letters (lam-meem, lam-alef) expands in
  logical order; on a line about to be reversed it must be pre-flipped or "المناهج" becomes
  "املناهج". Fonts that hide ligatures behind a Unicode map can still leave a few swaps.
- **OCR lane**: `brew install tesseract tesseract-lang` (free, offline — the only OCR compatible
  with the subscription-only billing posture). Arabic at 300 dpi, `--psm 3`, `-l ara`; English
  `eng`, French `fra`. MarkItDown's own OCR needs an Azure Document Intelligence endpoint
  (paid) — adopting it is a `/decide`.
- **Never run MarkItDown through the MCP for a book** — a 400-page PDF returned into the
  session is a context bomb; the script uses the CLI (`uvx --from 'markitdown[pdf]'
markitdown in.pdf -o out.md`).
- **CDN convention**: `catalog/textbooks/<slug>/textbook.md` beside `textbook.pdf`; no
  `Subject` field points at the Markdown (deterministic key). Adding one is a schema decision.
- **Coverage < 100 %** on good books is tables, figures and scan pages the text layer omits.

## Front matter written by the script

```yaml
title, titleEn, curriculum, grade, subject, dbSlug, lang, edition, source, sourceMd5,
sourcePages, generator, generatedOn, extraction (text-layer|ocr|glyph-ids-without-unicode-map|none-scanned),
quality (A|B|C|EMPTY), coverage (0–100), stats {…}, notes [...]
```

Convert textbooks: $ARGUMENTS
