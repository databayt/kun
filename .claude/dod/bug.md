# Definition of Done — Bug Fix

Story 26.5 in `docs/EPICS-V4.md`.

A bug fix is "done" only when ALL of the following are true:

## Reproducibility

- [ ] The bug was reproduced before the fix (verify with `see` keyword for UI bugs)
- [ ] Root cause is documented in the PR description (not just symptom)
- [ ] If from a user `report` issue, the original report's reproduction steps are validated

## Code

- [ ] Minimum-diff fix — no surrounding cleanup, no scope creep
- [ ] No new TODO/FIXME comments added
- [ ] Naming conventions preserved (`.claude/rules/structure.md`)

## Tests

- [ ] Regression test added that fails before the fix and passes after
- [ ] If the bug was tenant-leak: tenant-scoping test added
- [ ] If the bug was auth bypass: explicit unauthenticated-user test
- [ ] If the bug was UI: E2E test in both locales

## Verification

- [ ] Locally: `pnpm test` passes
- [ ] Locally: `pnpm build` passes
- [ ] CI: all checks green
- [ ] Production: `/watch` confirms the page no longer errors after deploy

## Issue

- [ ] PR commit message: `fix: <one-line summary> (closes #N)`
- [ ] PR description: root cause, fix, regression test reference
- [ ] Issue closed by `Closes #N` in PR body
- [ ] Comment on issue with the deployed fix link
- [ ] If user-reported, thank-you comment

## Captain awareness

- [ ] If P0/critical, captain journal mentions the incident
- [ ] If recurring (3rd same-class bug), `tech-lead` agent notified for systemic review
