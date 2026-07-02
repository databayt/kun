---
name: release
description: One spell — handover, check, ship, watch, then comment + close the issue
when_to_use: "Use when a feature block is code-complete on main and Abdout wants it shipped to the client in one move — the full local-to-production-and-verified chain, not a single stage like /check (tight loop), /ship (deploy only), /handover (QA only), or /watch (verify only). Triggers on: release <block>, send to client, one-spell handoff (handover→check→ship→watch→close issue), give away to client, ship it and tell the client."
argument-hint: <block> [--issue #N] [--notify-slack #channel]
---

# Release — Give Away to Client

One spell to take a finished feature block from local-on-main to live-in-production-and-verified. Orchestrates `/handover` → `/check` → `/ship` → `/watch`, then auto-comments the production URL + verdict on the related GitHub issue.

This is the **"send it to the client"** verb. Four sharp tools, one invocation.

## Usage

- `/release admission` — full chain on the admission block
- `/release admission --issue #42` — override the GitHub issue to notify
- `/release admission --notify-slack #demos` — also post the summary to a Slack channel
- `/release admission --skip-handover` — re-run after fixing handover findings
- `/release admission --skip-check` — re-run after fixing check findings

## Argument: $ARGUMENTS

## Instructions

### Phase 1 — Pre-flight

Refuse to proceed if any of these fail. Each check should print the offending state clearly.

1. **Working tree clean**

   ```bash
   git status --short
   ```

   If any output: stop with _"Working tree has uncommitted changes. Commit, stash, or discard before /release."_

2. **On main, up-to-date**

   ```bash
   git rev-parse --abbrev-ref HEAD     # must be 'main'
   git fetch origin main
   git rev-list --count HEAD..origin/main   # must be 0 (not behind)
   git rev-list --count origin/main..HEAD   # must be 0 (not ahead)
   ```

   If any check fails: stop with the specific reason (behind, ahead, or wrong branch). Suggest the fix.

3. **Sentinel cache** (shared session state)
   Read `.claude/session-state.json` if it exists. Each gate command writes its own key (`handover`, `check`) on PASS. For each stage, if its sentinel is `PASS` and the timestamp is within the last 10 minutes, mark it `SKIP`. This makes re-runs idempotent after fixing one stage — and lets `/ship` and `/check` invoked alone earlier in the session contribute their results here.

   Sentinel shape:

   ```json
   {
     "handover": {
       "scope": "block",
       "block": "admission",
       "status": "PASS",
       "at": "2026-05-29T14:30:00Z"
     },
     "check": { "status": "PASS", "at": "2026-05-29T14:32:00Z" }
   }
   ```

   Explicit `--skip-handover` or `--skip-check` flags override the cache.

4. **QA signoff (advisory — warn, do not block)**
   Resolve the block's QA signoff issue: read `blocks.json[block].qa.issue`, or search by label
   `qa-signoff` + `block:<block>`. Then:

   - **Open** (a human hasn't ticked acceptance) → print
     `⚠️  QA signoff issue #N is still open — a human hasn't signed off. Proceeding anyway.` and **continue**.
   - **`qa-blocked`** → print `⚠️  Block is qa-blocked (#N) — autonomous QA couldn't reach CLEAN. Proceeding anyway.`
     and **continue**.
   - **Closed** (signed off) → note `QA signoff #N closed — clear to ship.` and continue.
   - **None found** → note `No QA signoff issue — block was not run through /qa.` and continue.

   This is advisory by design: `/qa` is the place that gates on quality; `/release` only surfaces the
   signoff state so the human knows what they're shipping. Run `/qa <block>` first for the full gate.

### Phase 2 — Resolve the GitHub issue

`/release` needs to know which issue to comment on. Resolve in this order:

1. `--issue #N` flag — use directly
2. `Closes #N` or `Refs #N` in the most recent commit on `main` (`git log -1 --pretty=%B`)
3. Open issue with `type/feat` label whose title fuzzy-matches the `<block>` argument:
   ```bash
   gh issue list --repo <repo> --state open --label type/feat --search "<block>"
   ```
4. If still no match: stop and ask the user for the issue number

Capture `$ISSUE_NUMBER` for Phase 6.

### Phase 3 — Stage 1: /handover

Delegate to `.claude/commands/handover.md` in block mode:

- Skip if sentinel says `handover.status == PASS` and `block` matches and `at` is within 10 min
- Otherwise run `/handover <block>` against localhost:3000 (default) or `--env staging` if passed
- `/handover` writes its own sentinel on PASS
- If `BLOCKED`: stop, surface findings with file:line references
- If `READY FOR DEMO`: continue

### Phase 4 — Stage 2: /check

Delegate to `.claude/commands/check.md`:

- Skip if sentinel says `check.status == PASS` and `at` is within 10 min
- Otherwise run `/check` (inherits the auto-fix loop, max 5 attempts)
- `/check` writes its own sentinel on PASS
- If `BLOCKED`: stop, surface the failing gate
- If `READY TO SHIP`: continue

### Phase 5 — Stage 3: /ship

Delegate to `.claude/commands/ship.md`:

- Run `/ship` (inherits the auto-fix retry loop, max 5)
- Capture the production URL + commit SHA from the ship report
- If ship fails after all retries: stop, surface the deployment error trail

### Phase 6 — Stage 4: /watch

Delegate to `.claude/commands/watch.md`:

- Run `/watch <production-url>` with the URL from Stage 3
- If `ISSUES FOUND` (console errors, network failures, smoke test fail): stop, do **not** auto-revert — surface for human judgment
- If `HEALTHY`: continue to notification

### Phase 7 — Notify the issue (always-on)

Post a comment on the resolved issue with this exact shape:

```markdown
Released to production.

**URL**: <production-url>
**Handover**: PASS (5/5 passes clean on N routes)
**Check**: PASS (typecheck + build + visual)
**Ship**: Deployed in <duration>, commit <sha>
**Watch**: HEALTHY (no console errors, smoke test passed)
**Released by**: <git config user.name>
**Released at**: <ISO timestamp>
```

```bash
gh issue comment $ISSUE_NUMBER --repo <repo> --body "$(cat <<EOF
... above ...
EOF
)"
```

Then close the issue if it is still open:

```bash
gh issue close $ISSUE_NUMBER --repo <repo>
```

### Phase 8 — Optional Slack

If `--notify-slack <channel>` was passed:

- Use the `slack` MCP (`mcp__slack__slack_post_message`) to post the same summary to the channel
- Include the production URL as a link
- This is opt-in; default is no Slack post

### Phase 9 — Single consolidated report

Print one report at the end. No per-stage chatter beyond what each delegated command already printed.

```
## Release — admission — COMPLETE

URL:       https://kingfahad.databayt.org/admission
Issue:     #42 (commented, closed)
Slack:     #demos (posted) | (skipped)

Stages:
- Handover  PASS  (skipped from cache | clean on 12 routes)
- Check     PASS  (skipped from cache | typecheck + build + visual)
- Ship      PASS  (deployed in 1m 42s, commit abc1234)
- Watch     PASS  (healthy in production)

Total elapsed: <duration>
```

## Failure modes

| Stage         | Failure                       | What /release does                                                   |
| ------------- | ----------------------------- | -------------------------------------------------------------------- |
| Pre-flight    | Dirty tree                    | Stop; instruct user to commit/stash                                  |
| Pre-flight    | Wrong branch / behind / ahead | Stop; print the rev-list output                                      |
| Pre-flight    | QA signoff issue open/blocked | **Warn and proceed** — advisory only; run `/qa <block>` for the gate |
| Resolve issue | None found                    | Stop; ask the user for `--issue #N`                                  |
| Handover      | Translation FAIL / RTL FAIL   | Stop; suggest `/handover <block> --fix`                              |
| Handover      | Flow FAIL / Responsive FAIL   | Stop; surface findings — human judgment                              |
| Check         | Build error after auto-fix    | Stop; print remaining errors                                         |
| Ship          | Deploy error after auto-fix   | Stop; print the full error trail                                     |
| Watch         | Issues found                  | Stop; do not auto-revert — alert the user                            |
| Notify        | gh CLI fails                  | Print the comment body so the user can paste it manually             |

## Exit gate

- All four stages report PASS
- Issue comment posted, issue closed
- Optional Slack post dispatched (if `--notify-slack`)
- Sentinel keys for this release cleared from `.claude/session-state.json` (other gates' sentinels untouched)

## When to use

- A feature is code-complete and merged to main
- You want one invocation to ship + verify + tell the client
- The flow is identical every time and benefits from a single discoverable verb

## When NOT to use

- Mid-implementation — use `/check` for the tight loop instead
- Hotfix from a non-main branch — use `/ship` directly
- Just want to QA a build, not ship — use `/handover` alone
- Investigating a pre-existing production issue — use `/watch` + `/incident`
