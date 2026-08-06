---
name: bench
description: Score the engine's own config on its labeled cases, and propose holdout-gated fixes
when_to_use: "Use when the question is whether the CONFIG works, not whether a product feature works — scoring which skill fires for a prompt, checking runs against the contracts their SKILL.md declares, or proposing a description rewrite that must beat an unseen holdout. Unlike /health (counts files, never reads one), /qa (a product block), /check (typecheck + build). Triggers on: bench, benchmark the skills, is the routing accurate, measure the engine, dispatch accuracy, which skills collide, are any skills dead."
argument-hint: "[dispatch|adherence|outcome] [--audit] [--tune <skill>] [--retire]"
---

# Bench — measuring the engine instead of trusting it

kun ships 66 skills into every session. `health.sh` counts them; it has never read one.
`bench` is the layer that produces a defensible number, a trend line, and improvement
proposals a human commits.

The discipline that makes the numbers mean anything: **kun's hand-authored trigger phrases
are the test set, and the tuner may never touch them.** A tool that lets the same process
write both the cases and the answers is measuring its own reflection.

## Usage

- `bench` — full sweep (all implemented layers), appends one `weekly_history` entry
- `bench dispatch` — L1 only
- `bench dispatch --audit` — score and report, write nothing
- `bench --tune <skill>` — propose a description rewrite, gated on holdout gain
- `bench --retire` — merge candidates + absorption + usage evidence, for a `/decide`

## Layers

| Layer            | Question                                                          | Grading                                    | Status  |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------ | ------- |
| **L1 dispatch**  | Does the right skill fire, and do the wrong ones stay silent?     | exact string match, zero LLM               | shipped |
| **L2 adherence** | When a skill fires, does the run honor its own declared contract? | static lint + transcript mining            | planned |
| **L3 outcome**   | Is the artifact any good?                                         | LLM judge, calibrated against human labels | planned |

## L1 — dispatch

```
node .claude/scripts/extract-dispatch-cases.mjs        # human summary
node .claude/scripts/extract-dispatch-cases.mjs --check # guards (health.sh runs this)
```

Then run the workflow `bench-dispatch` (Extract → Dispatch → Adjudicate → Score → Persist).
~17 agents, ~195k tokens, entirely on the Max subscription — no API-key spend.

**Ground truth is free.** 239 `Triggers on:` phrases, 72 vocabulary spells naming a skill,
and 95 spells that route to an agent/MCP and must therefore fire _nothing_. Nothing is
synthesized; the extractor is a parser, not a generator.

**Headline is `top1_hard`** — top-1 accuracy excluding cases whose prompt is literally the
skill's own name, after every miss survives adversarial adjudication. Reported beside it:
`fp_rate` (false fires on the none-cases — the number that matters most, since a false fire
has side effects and a miss does not), `destructive_fp` (hard zero), `top3`, `mrr`, macro
**and** support-weighted F1, and `listing_chars`.

## Guards

| #   | Guard                                                                             | Enforced by                                     |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Trigger phrases are the test set — **read-only to the tuner**                     | `corpus_hash`; `--check` exits 1 when they move |
| 2   | Listing ≤ 26,000 chars total, ≤ 1,200 per skill                                   | `--check`                                       |
| 3   | `listing_chars` is co-primary — accuracy bought with prefix bloat is a regression | report phase                                    |
| 4   | 20% holdout in a write-once ledger, never shown to the tuner                      | `split.ledger`                                  |
| 5   | `destructive_fp` hard 0 blocks adoption regardless of accuracy                    | verdict gate                                    |
| 6   | Headline excludes trivial cases                                                   | `top1_hard`                                     |
| 7   | CLAUDE.md-routed skills frozen from tuning in round 1                             | `per_skill.claude_md_routed`                    |
| 8   | Merge/retire is evidence for `/decide`, never auto-applied                        | `merge_candidates[]`                            |
| 9   | **Graders are blind** — dispatch agents read only the `--redacted` view           | emit-time assertion + `audit-bench-run.mjs`     |

Guard 1 is the load-bearing one. The cases come from `when_to_use`; the tuner edits
`when_to_use`. Without it the optimal move is to paste every trigger phrase into the
description — score 1.0, engine unchanged, frontmatter degraded into a keyword list that is
_worse_ for the novel prompts that make up all real usage. A holdout alone does not stop
this, because keyword stuffing lifts train and holdout identically.

Guard 9 is the one that actually bit. The first run scored **0.9942** — and it was not a
measurement. The dispatch agents had been told to read the case file for prompts, and that file
carried `label` for every case, so they were reading the answer. `label` was not the only leak:
`source` announces a none-case (`vocab_none`) and `tags` carries `destructive` and
`hard:names-ship`. Redacting one field would have left the score just as contaminated and much
harder to doubt.

Two lessons are now wired in rather than remembered. First, **a near-perfect score on a 67-way
classification is evidence about the harness, not the fleet** — 0.9942 with a holdout of 1.0 and
a _negative_ train/holdout gap should be read as a symptom on sight. Second, an instruction not
to look is not a control: `audit-bench-run.mjs` scans each run's agent transcripts for forbidden
tool inputs afterwards, and fails the run on any hit. Void results stay in `weekly_history` with
`invalid: true` and their reason instead of being deleted — a score file that only ever shows
clean numbers is exactly the artifact this system exists to distrust.

## Improvement lane

1. Worst `top1_hard`, or a bidirectional confusion pair.
2. Tuner sees **only** the train split and its failures — never holdout, never the
   `Triggers on:` tail.
3. Re-score against holdout.
4. Accept only on holdout gain, under the length cap, `destructive_fp` still 0.
5. Write `.claude/evals/proposals/<skill>-<date>.md` — diff plus before/after/holdout — and
   open a GitHub issue.
6. **Human says yes**, then commit on `main` with the score table in the body.

No auto-apply and no mid-session mutation. kun's thesis is guardrails-as-training-data;
unmeasured self-patching contradicts it, and the engine works directly on `main` where a bad
config edit has no PR to catch it.

## Honesty

The harness shows the skill listing only. It does **not** carry `.claude/CLAUDE.md`,
path-scoped rules, ~25 MCP servers' tool listings, or conversation history. So it
under-estimates the `claude_md_routed` skills (CLAUDE.md's Behavior section routes them
directly — their frontmatter was never the binding constraint), over-estimates `higgs`/
`issue`/`deploy` (whose real competitor is an MCP tool it cannot show), and under-estimates
`ship`/`watch`/`check` (context-dependent, here always cold-start).

Validate with the real `(prompt → skill)` pairs harvested from `~/.claude/projects/` and
publish the agreement as `proxy_fidelity` with its `n`. It bounds gross error; it certifies
nothing, it under-samples passive inline reads that leave no `Skill` trace, and it is
survivorship-biased — it never sees the dispatch that _should_ have happened and didn't.

## Files

| Path                                         | Role                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `.claude/scripts/extract-dispatch-cases.mjs` | deterministic case extraction + guards                                |
| `.claude/scripts/test-bench-dispatch.mjs`    | regression test for the scoring math (28 assertions, free)            |
| `.claude/workflows/bench-dispatch.js`        | the L1 harness                                                        |
| `.claude/evals/cases/dispatch.json`          | generated case set — git-tracked so a corpus change shows in the diff |
| `.claude/memory/skill-scores.json`           | measured state + longitudinal `weekly_history`                        |

`engine.json` holds **declared** truth that `health.sh` checks reality against; a score has
no declared counterpart, so it lives in memory and `health.sh` checks only that the
measurement is current.

## Exit Gate

A run is reportable only when `destructive_fp` is 0, `unadjudicated` is 0, and every case was
answered. Otherwise it is **DEGRADED** and must be reported as such — never as a clean score.
