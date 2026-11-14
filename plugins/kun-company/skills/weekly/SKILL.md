---
name: weekly
description: Run the captain's weekly Sunday-plan / Tuesday-check / Thursday-review cycle
when_to_use: "Use when running the captain's weekly cadence — Monday plan (allocate the 7 humans), Wednesday check (progress vs plan), Friday review (coach + canon principle) with archive to memory/weekly. Triggers on: weekly, monday plan, friday review, plan the week."
argument-hint: "[plan|check|review]"
lane: captain
effort: xhigh
---

Run the captain's weekly review.

Arguments: $ARGUMENTS (optional: "plan" for Sunday planning, "check" for Tuesday, "review" for Thursday, "team" to read the group, "send <nn>" to post an approved draft)

Default behavior (no args): Full weekly review.

Steps:

0. Run `/sync` — refresh the engine's view of its ecosystem before planning (due tiers only; it self-skips tiers whose `engine.json → sync.<tier>` stamp is fresh)
   0.5. **Engine self-check (free tier first)** — run `node .claude/scripts/lint-contracts.mjs`, `node .claude/scripts/harvest-transcripts.mjs --out .claude/evals/cases/real-pairs.json` (the fidelity set grows from the week's sessions), `node .claude/scripts/bench-retire.mjs` (retirement evidence for the review), and `node .claude/scripts/extract-dispatch-cases.mjs --check`. All four are deterministic and cost nothing. Only if a guard trips, or `engine.json → eval.cadence_days` has elapsed since `skill-scores.json → last_updated`, run the `bench-dispatch` workflow (~31 agents, ~2.8M subagent tokens as of 2026-11-02). L1 is saturated at 1.0, so it is a **regression tripwire, not an improvement target** — a drop is the signal; a 1.0 is not news. Record the result in `weekly_history` and report KPIs 7–8 alongside the other six.
1. Check git activity across all product repos (github MCP)
2. Check deployment health (vercel MCP if available)
3. Check error rates (sentry MCP if available)
4. Review revenue status (stripe MCP if available)
5. Summarize what shipped vs what was planned
6. Identify blockers and risks
   6.5. **Decision-review sweep (Friday / full review only)** — scan the decision journal (`.claude/memory/decisions/` and `/decide` entries) for entries whose reviewed-by date has passed: grade the prediction against what actually happened, write the lesson as a `feedback_*` memory, and mark the entry reviewed. Predictions that are never graded never compound.
7. Recommend next week's allocation — one or two tasks each, every task with "done when" and a date, all
   pointed at paying schools (the Drive). People: Abdout, Mutaz, Ali, Moed, Samia, Sedon, Ibrahim, Huwaida
   (Abobaker on leave since 2026-11-08). Keep hogwarts `content/docs-*/sprint.mdx` (EN + AR) as the live
   sprint page.
8. Output concise summary for Slack posting
9. **The team group gate («المدرسة 2.0», since 2026-11-08 — Abdout's rule: read everything, post nothing
   without his "send").**
   - Read first: `node .claude/scripts/team-wa.mjs status`, then `read` (read-only snapshot of WhatsApp
     Desktop; data stays in `~/.claude/state/team/`, never in git). Summarise for Abdout: decisions,
     promises with owners and dates, blockers («عائق:»), objections to a Team page («اعتراض:»), questions
     only he can answer.
   - **Objections improve the Team pages (Thursday review).** For each «اعتراض: <page> — <reason>», run the
     captain's argument protocol (steelman both sides, cite the canon, name the metric line) against the
     page's own "Argue with this page" section — it states what would change the rule. Draft the EN + AR
     edit to hogwarts `content/docs-{en,ar}/<page>.mdx`; apply and commit only after Abdout's yes, update the
     page's "Reviewed" date, and tell the group what changed in the review post. A rejected objection gets
     its one-line reason in the same post.
   - Draft the Arabic post (plan / check / review / reply) in `~/.claude/state/team/outbox/<nn>-<slug>.md`,
     first line «🧭 مكتب التشغيل». Short, one line per person, dates.
   - Post only after Abdout says "send <nn>" for that draft: WhatsApp Web in the chrome-devtools Chrome,
     open «المدرسة 2.0», paste the exact text, send, confirm it appears, mark the draft sent. Never post a
     draft he has not approved, never edit an approved one silently, never message a school or a person
     outside the group from this step.

Reference: .claude/agents/captain.md for weekly rhythm
Reference: .claude/memory/team.json for team profiles
