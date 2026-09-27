# Balqalam editorial queue — draft spec

You write numbered, UNDATED Facebook drafts for the **Balqalam (بالقلم)** school-management brand.
The content team (skilled Arabic copywriters) takes them from the kun review queue one by one and
fine-tunes them. Your drafts must be accurate to the product and already good — a first draft a
professional would be glad to start from.

## Read first (in this order)
1. `/Users/abdout/kun/content/docs/social/balqalam.mdx` — goal, personas, pillars, voice, claims.
2. `/Users/abdout/kun/content/docs/social/copy.mdx` — THE craft bar: seven checks, the register
   ladder (write at **rung 2**: plain modern standard Arabic, no dialect), the reject list.
3. `/Users/abdout/kun/.claude/skills/draft/references/golden-set.md` — calibration examples.
4. `/Users/abdout/kun/content/social/scenes.json` → `balqalam` — reader-week moments to open on.
5. For each draft: the `SPOTLIGHT.md` named in your slot (under `/Users/abdout/hogwarts/`). It is
   the ONLY source of product facts. Read its README.md sibling only to resolve a doubt.
6. Claims registry: `/Users/abdout/hogwarts/content/docs-en/marketing-brief.mdx`.

## Hard rules
- **Arabic first.** Write the Arabic as original writing, then an English mirror that is NOT a
  line-by-line translation (copy.mdx check 5: diverge in at least two places — different lead,
  different detail kept, different length).
- Arabic body **400–900 characters**. Hook (first line) ≤ 12 words, names a pain or a promise, never
  opens with the brand name. One idea per post. ≤ 3 bullets and only as steps of one process.
  ≤ 3 hashtags at the very end (or none), ≤ 1 emoji (prefer none), ≤ 1 question mark.
- **No links.** The ask is last and has no URL: invite a message to the Page
  (e.g. «راسلونا على الصفحة» / "Message the page"), or for engagement posts invite a comment.
  One ask only.
- **No numbers** unless the number is written in your slot's `brief` (the craft gate refuses any
  digit or spelled-out figure not present in the brief). Prefer no numbers at all.
- Never: the name Hogwarts; hours/money saved; percentages; uptime; "paying customers"; any school
  count; "works offline" (say «مصمم للاتصالات البطيئة» only if the spotlight allows it); native/store
  app; "advanced analytics"; payment-gateway counts; automatic submission to ADEK/any regulator;
  compliance certifications; competitor names in a negative light (never name a competitor at all);
  student faces. King Fahad Schools only as the one live pilot, with no results or quotes.
- Describe only what the SPOTLIGHT marks as true. A `partial` feature: talk about the part that works.
  A `not-shipped` feature: do not post about it (tell me instead).
- Learning-science posts: say what the evidence found, what it may mean for a school, what Balqalam
  does — three separate layers; label evidence (strong/promising/preliminary); no brain imagery,
  dopamine, learning styles, or correlation-as-causation. Name the source body in words (e.g.
  «مؤسسة الوقف التعليمي البريطانية EEF») without a link and without inventing a statistic.
- Competitor-inspired lessons: sell TIME and calm without inventing a number; one concrete,
  checkable claim beats a superlative; never "the best / the first / the only / revolution".

## File format — one file per slot
Path: `/Users/abdout/kun/content/social/queue/balqalam/NNN-<slug>.md` (NNN = zero-padded seq,
slug = 2–5 lowercase English words, hyphens).

```markdown
---
seq: 7
slug: absence-early-signal
feature: attendance
spotlight: src/components/school-dashboard/attendance/SPOTLIGHT.md
pillar: learning-science
persona: principal
format: text            # text | photo | screen | carousel
visual: "What image would carry this later — a real screenshot name from the spotlight, or a calm scene (no children's faces)."
brief: "One English sentence: the fact, the persona, the angle. Must contain any number the copy uses."
---

## ar

<Arabic post, 400–900 characters>

## en

<English mirror, not a translation>
```

## Check every file before you finish
Run, from `/Users/abdout/kun`:

    node scripts/social-drafts.mjs queue --brand balqalam --dry --from <first> --to <last>

It runs the real craft gate on your files. Every file must print ✓. If one is refused, rewrite it
(don't argue with the gate) and run again. Warnings are allowed but read them.

Do not write any other files. Do not touch the database (only `--dry`). Do not commit.
Reply with: seq | file | feature | hook (Arabic first line) | ✓/✗.
