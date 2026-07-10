---
name: qa
description: Autonomous block QA — detect, adversarially verify, fix safe tiers, hand the residual to a human
when_to_use: 'Use when a feature block needs autonomous QA — detect across every route + the block source, adversarially verify every FAIL, auto-fix the safe (tier A) and build-gated (tier B) tiers, persist the verdict to blocks.json, and open one human-signoff issue carrying only the residual — triggering on qa <block> (e.g. "qa admission" in prose, no slash needed), "QA this block", pre-release verification, or a code-complete-but-unverified block; block-scope only — a single URL spot-check is handover''s job, the typecheck/build gate alone is check''s, and a user-reported bug is report''s.'
argument-hint: <block> [--env staging] [--audit] [--rounds N]
---

# QA — Autonomous Block Verification

Take a feature block from "built but unverified" to "ready for a near-free human signoff." `/qa <block>`
**honestly detects** every issue across the block's routes + source, **adversarially refutes** each FAIL
before trusting it, **fixes everything in the safe + build-gated tiers**, re-verifies until dry, **persists
the verdict**, and **opens one GitHub issue** carrying only the minimal residual a human must judge.

This is the gate between building and shipping — heavier than `/handover` (which reports), lighter on the
human than a manual QA pass. It composes, it does not redefine: `/check` for the static gate, the 17 niche
keywords (`.claude/agents/quality.md`), the rules' Fix sections (`.claude/rules/`), and `handover.js`'s
adversarial RECHECK.

## Usage

- `/qa admission` — full autonomous loop on the admission block (localhost:3000)
- `/qa admission --audit` — detect + adversarially verify only, **no fixing** (honest read-only report)
- `/qa admission --env staging` — run the browser checks against `ed.databayt.org`
- `/qa admission --rounds 2` — cap the fix-until-dry loop at 2 rounds (default 3)

## Argument: $ARGUMENTS

## Instructions

### Phase 1 — Resolve

Parse `<block>` and flags from `$ARGUMENTS`. Confirm the block exists in `.claude/blocks.json`; if not,
stop and list near matches. The workflow itself resolves the block's `path` + pre-computed `routes` (with a
`find src/app` + strip fallback), so the command stays thin.

Pre-flight: ensure the dev server is running on **port 3000** (or the `--env` target is reachable) and you
are on `main` (`git branch --show-current` → `main`) — the loop commits fixes straight to main per the
github-workflow rule.

**Baseline smoke before any edit**: load one representative route of the block end-to-end _before_ the
workflow starts fixing. If the block is already broken at baseline, record that state in the run log —
pre-existing breakage must never be attributed to (or hidden by) this run's fixes.

**Verdict contract**: `blocks.json[block].qa` is written by the workflow's Persist phase **only**. It is
unacceptable for any other flow — a fixer agent, a report run, a manual edit — to flip a block's QA verdict;
they may only append findings. The verdict field is the engine's ground truth for `/release`.

### Phase 2 — Run the workflow (multi-agent opt-in)

Invoke the saved Workflow — **this command invocation is the opt-in** for the multi-agent fan-out:

```
Workflow({ name: "qa", args: "<block>" })
```

For `--env`/`--audit`/`--rounds`, pass the object form:
`Workflow({ name: "qa", args: { block: "<block>", base: "https://ed.databayt.org", audit: true, rounds: 2 } })`.

The workflow runs six phases (`.claude/workflows/qa.js`):

| Phase   | What it does                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------- |
| Static  | resolve routes + compose `/check` (typecheck + build, 5-retry auto-fix). Won't build ⇒ `BLOCKED`. |
| Detect  | browser keywords × routes + code keywords × source — one fan-out, severity + fix-tier per finding |
| Verify  | adversarial RECHECK skeptic refutes every FAIL before it can gate (flaky FAIL ⇒ WARN)             |
| Fix     | fix-until-dry: tier A in parallel, tier B serial + self-verify + build-gated; re-detect affected  |
| Handoff | open ONE `qa-signoff` issue (or update the existing one) with the matrix + fixes + residual       |
| Persist | write the verdict to `blocks.json[block].qa` + the block README frontmatter                       |

The fix-tier matrix and the honesty doctrine live in `.claude/agents/quality.md` — the detector and fixer
agents read them. Tier C (subjective UX, business-logic correctness, data accuracy) is **never** auto-fixed;
it always flows to the human residual.

### Phase 3 — Render

Print the verdict the workflow returns:

```
## QA — admission — CLEAN
Routes × keywords:  78/84 PASS, 4 WARN, 2 FAIL (downgraded by recheck)
Auto-fixed:         7 findings over 2 rounds (lang ×3, design ×2, guard ×1, pattern ×1)
Residual (human):   3 items → issue #412
Signoff issue:      https://github.com/databayt/hogwarts/issues/412

Verdict: CLEAN — ready for human signoff
```

If `BLOCKED`: surface the gating findings (error-severity or debug/guard) that survived the loop, with
file:line, and the `qa-blocked` issue link.

### Phase 4 — Sentinel

On a completed run, write the shared session sentinel `.claude/session-state.json` (merge, don't overwrite):

```json
{
  "qa": {
    "block": "<block>",
    "status": "CLEAN",
    "issue": 412,
    "at": "<ISO timestamp>"
  }
}
```

`/release` reads this (and `blocks.json[block].qa`) to surface the signoff state before shipping.

## Human-QA handoff issue

The workflow's Handoff agent fills this template. Labels: `qa-signoff` (CLEAN) or `qa-blocked` (BLOCKED),
`P1`, `block:<name>`. One issue per block — re-running `/qa` updates it in place, never duplicates.

```markdown
## QA Signoff — <block> — <CLEAN | BLOCKED>

**Verified by**: qa.js (Opus 4.8) · **Run**: <ISO> · **Rounds**: <N> · **Base**: localhost:3000
**Auto-fixed**: <K> · **Residual for human**: <M>

Autonomous QA fixed the safe + verifiable surface and adversarially confirmed every reported failure.
Everything below needs human judgment — it cannot be honestly auto-decided.

### Verified matrix (routes × keywords) — ✅ PASS · ⚠️ WARN (advisory) · ❌ FAIL (gating)

| Route            | debug | flow | responsive | lang | see | fast | guard | stack | pattern | design | arch | struct |
| ---------------- | ----- | ---- | ---------- | ---- | --- | ---- | ----- | ----- | ------- | ------ | ---- | ------ |
| /admission       | ✅    | ⚠️   | ✅         | ✅   | ✅  | ✅   | ✅    | ✅    | ✅      | ✅     | ✅   | ✅     |
| /admission/merit | ✅    | ❌   | ✅         | ✅   | ⚠️  | ✅   | ✅    | ✅    | ✅      | ✅     | ✅   | ✅     |
| …                |       |      |            |      |     |      |       |       |         |        |      |        |

### Auto-fixed (committed to main)

| #   | Finding                          | Keyword | Tier | Files         | Commit    |
| --- | -------------------------------- | ------- | ---- | ------------- | --------- |
| 1   | "Submit application" hardcoded   | lang    | A    | form.tsx:42   | `abc1234` |
| 2   | merit query unscoped by schoolId | guard   | B    | actions.ts:88 | `def5678` |
| …   |                                  |         |      |               |           |

### Residual for human — minimal checklist

Only what a human must decide. Each: route/file · what to check · why a human is needed.

- [ ] **/admission/merit · flow** — verify the merit ranking is _correct_ (score desc, ties by application
      date). _Bot confirms the page works; it can't confirm the business rule produces the right order._
- [ ] **/admission · see** — applications-table header spacing looks tight at 768px. _Design taste call._
- [ ] **/admission/applications · responsive @375** — action column overflows; needs a layout decision
      (hide vs. wrap vs. menu). _Trade-off needs a human._

### Acceptance checklist (tick to sign off)

- [ ] Verified matrix reviewed — no surprise FAIL
- [ ] Each residual item checked and accepted (or a follow-up issue filed)
- [ ] Arabic (RTL) variant spot-checked on one route
- [ ] **Signed off — clear to `/release <block>`**
```

**BLOCKED variant** swaps the Acceptance section for **"Blocking — could not auto-fix"**, listing the
surviving error-severity / structural findings (file:line + why the loop couldn't safely fix them), and the
issue carries `qa-blocked`.

## Product mode (stub — not yet built)

`/qa hogwarts` (a product name instead of a block) will eventually fan the loop over **all** blocks in
`blocks.json` with bounded concurrency, emit a rollup dashboard (block × verdict × residual count), and link
the per-block signoff issues under one tracking issue. **Deferred** until the single-block loop is proven on
`admission` + 2 more blocks — running it 71× unattended must earn trust first. For now, `/qa` requires a
block argument.

## Exit gate

- Static gate green (typecheck + build)
- Every confirmed FAIL adversarially verified; flaky FAILs downgraded to WARN
- No confirmed error-severity or `debug`/`guard` finding remains (else `BLOCKED`)
- One `qa-signoff` (or `qa-blocked`) issue opened/updated; `blocks.json[block].qa` written
- Verdict: **CLEAN — ready for human signoff**

## When to use

- A block is code-complete but never QA'd — the hogwarts launch case
- Before `/release <block>` — `/qa` produces the signoff issue `/release` surfaces
- After a large refactor that touched a block's routes, data wiring, or i18n

## When NOT to use

- A single URL spot-check — use `/handover <url>`
- Just the typecheck/build gate — use `/check`
- A user-reported bug — use `/report`
- Shipping an already-signed-off block — use `/release <block>`
