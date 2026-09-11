---
name: md
description: The house standard for machine-produced Markdown — the schema, the RTL rules, and grading by agreement
when_to_use: "Use when judging or repairing the QUALITY of Markdown that a machine produced from a document — 'this conversion is bad', 'the md is garbage', 'grade this transcription', 'why are the tables wrong', 'is this twin trustworthy' — and when writing a transcription contract for a new source. This is the standard, not a converter: /convert turns one file into Markdown via MarkItDown, /textbook orchestrates whole books. Both are held to this. Triggers on: md quality, bad conversion, grade the markdown, transcription contract, agreement score, RTL markdown, mirrored tables."
argument-hint: "<file-or-dir> [--grade | --contract]"
---

# The Markdown standard

Machine-produced Markdown is not trustworthy because it parses. It is
trustworthy when a second independent read agrees with it. This file is the bar
`/textbook` and `/convert` are both held to.

## Grade by agreement, never by volume

The failure this standard exists to prevent: a Sudan grade-12 biology twin
shipped as `quality: A` with `coverage: 47`, because the grader counted whether
the output *looked like* Arabic letters. Half the book was missing and a third
of it was wrong. Across the same grade, maths scored A at 28 % coverage.

**A character count cannot distinguish clean text from confident nonsense.**
Re-read a random sample with a fresh agent, diff the normalised text, and report
the agreement rate. `~/.claude/skills/textbook/scripts/md-agreement.py` does
this: `--sample N` picks pages (plus `--risk-json` suspects), `--score` diffs them on six axes.

Then **look at the weakest pages before believing the number**. Disagreement
from unordered list items is not the same defect as disagreement from invented
prose. One is noise, the other is disqualifying.

## The transcription contract

For any multi-page source, write the rules once to a `_CONTRACT.md` the agents
read, rather than repeating them per agent. It is the single lever for fixing
systematic output problems, and it belongs beside the output.

Clauses that earned their place:

- **Transcribe, do not correct.** Reproduce printed typos, non-standard
  spellings and wrong cross-references exactly. Report them in the status line;
  never silently fix them. Agents rationalise repairs as improvements — on
  biology one "fixed" two figure numbers by cross-referencing later pages and
  normalised `ڤ` to `ف`. Name real examples in the clause; the abstract rule
  alone did not hold.
- **Never guess.** Illegible spans get an explicit marker (`[غير مقروء]`), never
  plausible filler. Vision models fail by producing *convincing* text, which is
  undetectable downstream. Marking uncertainty is always correct.
- **Logical reading order**, columns never interleaved.
- **Figures are content.** A page that is only a diagram still yields its caption
  and every internal label. Those pages are where OCR scored zero.
- **Structure, not prose.** Tables become real tables. Notation becomes LaTeX.
  Terms in a second script stay inline as printed.
- **Page furniture is dropped**: running heads, folios, decorative rules.

## RTL Markdown

- Keep the source language's own digits and spelling as printed.
- **Table column direction is a live trap.** Markdown column 1 renders on the
  *right* under `dir="rtl"`, so the rightmost printed column must be written
  first or the table is mirrored against its source. Transcribers get this wrong
  even when told, and **they get it wrong again when asked to audit it** — the
  judgement is the bug. Verify by CROPPING the page's right edge and asking only
  what is in the crop; position then becomes physical. Expect a mix: on one book
  8 of 31 tables were mirrored and 23 were fine, so never blanket-swap.
- Never put a code sample inside translatable RTL prose — braces and `#`/`/` are
  bidi-neutral and will reorder.

## The metrics — text fidelity and structure fidelity

One agreement number hides the defect it should expose. `md-agreement.py` scores every
sampled page on six axes and names a **class**; `md-structure.py` parses pages with the
READER's own grammar (ported from hogwarts `textbook/parse.ts`) so "table" means what a
student sees:

| axis     | what it measures                                           | typical defect it isolates            |
| -------- | ---------------------------------------------------------- | ------------------------------------- |
| `seq`    | word-sequence agreement (the legacy headline)              | everything — the number that is graded|
| `bow`    | bag-of-words F1, order-insensitive                         | `ordering` when `bow` ≫ `seq`         |
| `num`    | numeral-token F1, digits as printed                        | `numeric` — misread table values      |
| `lat`    | Latin-token F1                                             | `latin` — lost binomials, symbols     |
| `labels` | diagram-label token F1 (chunk-insensitive)                 | interpretation, dropped labels        |
| `struct` | signature agreement: tables, dims, figures, captions, headings | `structure`, diagram-as-table     |

Plus two flags: a run of ≥ 6 words present in one read only (`omission`), and one read marking a
span illegible where the other wrote text (`illegible` — a guess suspect). Classes drive the
repair queue; `ordering` and `clean` do not. The benchmark (`textbook-bench.py`) goes one step
further and scores **objective assertions** per page — raw `mustContain`/`mustNotContain`,
numeral/Latin sets, label sets, table dims and the crop-verified rightmost column, `noTable`,
figure count, `illegibleMin/Max` — because gold text produced by the same model is the same hand.

Two independence rules make any of this a measurement: the second read is **blind** (never opens
the first read, the gold or the twin — the run transcript is audited), and the headline is the
**random** sample only; the risk-weighted tail and post-adjudication scores are reported beside
it, never folded in.

## Front matter is provenance

Say how the file was made and how good it is: `extraction`, `generator` (model
included), `generatedOn`, `agreement`, `agreementSample`, `quality`, and a
`notes` list carrying known issues. A twin whose limitations are written down is
usable; one that only claims a grade is not.

$ARGUMENTS
