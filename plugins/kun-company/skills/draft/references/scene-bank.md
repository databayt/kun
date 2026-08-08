# Scene bank — check 4's raw material

**The data lives in `content/social/scenes.json`** — this page is the doctrine
for using and refreshing it, not a second copy.

## Why it exists

copy.mdx names the drain's structural failure: check 4 (Scene) — _"the check
the drain has never passed, structurally: product docs contain no Thursdays."_
A draft written from a feature list fails Scene no matter how good the
sentences are, because the source material never contained a moment a reader
could recognize. The bank is that missing source: concrete school-life
moments, per audience and season, that a writer can ground a post in.

The eve content-agent evaluation (2026-08-07) mapped this to the _researcher
subagent_ pattern — fresh context feeding the writer real-world material — but
adapted to the engine's economy: a curated file refreshed a few times a year,
never a per-draft research call.

## How the lanes consume it

- **Gemini lanes** (inline + drain-google): `scenesFor(brand)` in the
  draft-prompt mirror pair renders the current season's moments plus the
  evergreen ones into the prompt's static section (cache-friendly — before the
  brief).
- **Claude lane** (queue-mode drain and hand-run `/draft`): read
  `content/social/scenes.json` alongside this file; pick at most ONE scene and
  only when the post can honestly claim it. A scene is an anchor, not a quota.

## Entry rules (mirror of the JSON `$comment`)

- Arabic-first, nouns the reader touches (`الورق`, `الكشف`, `الطابور`).
- ONE moment per line — a scene, not a topic.
- **No digits and no spelled-out figures** — a number here seeds copy the
  craft gate's `invented-number` rule then refuses.
- Season windows are months on the Sudan-slice school year (≈ June→April;
  certificate exams mid-April — Apr 13–23 in 2026; Ramadan ≈ Feb–Mar through
  2027).

## Refresh ritual

Quarterly, or when a season boundary passes — a research session (not a cron):

1. Verify the exam and Ramadan windows still hold for the coming year; move
   the month arrays if they drifted.
2. Retire scenes reviewers stopped recognizing (check the `lessons` output —
   a rising `untrue` or `register` count against scene-anchored drafts is the
   signal).
3. Add what the last term surfaced — a real complaint from a pilot school
   beats an invented moment every time.
4. Only the slice brand carries a bank today; widen to a new brand when its
   slice opens, never speculatively.
