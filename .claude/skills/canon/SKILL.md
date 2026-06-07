---
name: canon
description: Surface the right CEO book + operating move for a business or leadership decision — hiring, firing, pricing, positioning, what to build, customer development, fundraising, prioritization, runway, strategy. Pull in automatically when a decision is on the table; no slash command needed. /canon also lists all 10.
argument-hint: "[decision-type | keyword]"
---

# Canon

Retrieve from the operative CEO canon. Source of truth: `/Users/abdout/kun/docs/CANON.md`.
`/canon` lists the 10; `/canon <decision-type|keyword>` surfaces the matching book + its operating moves.

## Usage

```
/canon                 # List all 10 with one-line thesis each
/canon hiring          # → CEO Excellence / High Output Mgmt + their moves
/canon hard call       # → The Hard Thing About Hard Things + moves
/canon customer        # → The Mom Test + moves
/canon positioning     # → Obviously Awesome + moves
/canon community       # → Working in Public + moves
```

## Argument: $ARGUMENTS

## Process

1. **Read** `/Users/abdout/kun/docs/CANON.md` (the retrieval index + the 10 entries).
2. **No argument** → print the 10 as a numbered list (`N. Title — one-line thesis`). Stop.
3. **Argument present** → match against the "decision-type → book" routing table below first (left-column keywords), then fall back to fuzzy-match on book titles and operating-move text.
4. **On match** → print: book title, 1-line thesis, the 2–3 operating moves _verbatim_, the principle number(s) it powers (link `docs/PRINCIPLES.md`), and the databayt-application line.
5. **On ambiguity** (≥2 books match) → print both, ranked, with a one-line reason each.
6. **No match** → print the full routing table so the user can self-route. **Never invent a book outside the 10.**

## Keyword routing (decision-type → book)

| Keyword(s)                                                      | Book                                          |
| --------------------------------------------------------------- | --------------------------------------------- |
| hire, hiring, fire, org, team, manage, leverage, 1:1, allocate  | 1. CEO Excellence · 5. High Output Management |
| hard, crisis, wartime, layoff, no-good-options, psychology      | 2. The Hard Thing About Hard Things           |
| spec, doc, memo, pr/faq, six-pager, mechanism, bar-raiser       | 3. Working Backwards                          |
| quarter, rocks, scorecard, cadence, accountability, l10, okr    | 4. Traction (EOS)                             |
| output, leverage, meeting, delegation, maturity                 | 5. High Output Management                     |
| build, mvp, experiment, pivot, validate, assumption, hypothesis | 6. The Lean Startup                           |
| customer, interview, discovery, talk to users, validation       | 7. The Mom Test                               |
| segment, beachhead, chasm, early adopter, mainstream            | 8. Crossing the Chasm                         |
| community, contributor, maintainer, open source, oss, sspl      | 9. Working in Public                          |
| positioning, category, what-is-it, messaging, frame             | 10. Obviously Awesome                         |

## Companion skills

- `/decide` — consults the canon for the relevant move before classifying (Process step 2)
- `/weekly` — Friday review surfaces one canon move for the week
- `/captain` — loads `docs/CANON.md` at session start; grounds recommendations in canon books

## Reference

- Operative layer: `/Users/abdout/kun/docs/CANON.md`
- Belief layer: `/Users/abdout/kun/docs/PRINCIPLES.md` (24 numbered principles)
- Bibliography: `/Users/abdout/kun/docs/CEO-OS.md` Part V (passages) + Part VII (reading order)
