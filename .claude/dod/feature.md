# Definition of Done — Feature

Story 26.5 in `docs/EPICS-V4.md`. Linked from `paths:` frontmatter on feature-creation skills.

A feature is "done" only when ALL of the following are true:

## Code

- [ ] Code merged to `main` via squash merge
- [ ] All CI checks green: typecheck, lint, test, build
- [ ] Code review: at least 1 approval (or self-review with explicit reasoning if solo)
- [ ] No `--no-verify` git operations on the merging branch
- [ ] No new TODO/FIXME comments without linked issues

## Tests

- [ ] Unit tests cover happy path + 1 edge case
- [ ] If touches tenant-owned model: integration test with real database
- [ ] If touches UI: E2E smoke test in both `ar` and `en` locales
- [ ] Coverage on changed files ≥ 80% (95% for tenant-owned actions)

## Documentation

- [ ] README updated if public API changed
- [ ] Inline doc comment on any non-obvious function
- [ ] CHANGELOG.md entry added (or PR description treated as the changelog)
- [ ] If this is a new pattern, link added to `.claude/patterns/registry.json`

## Conventions

- [ ] Files in correct directory (per `.claude/rules/structure.md`)
- [ ] Tenant scoping: every Prisma query has `schoolId` (`.claude/rules/prisma.md`)
- [ ] Auth: every server action calls `auth()` first (`.claude/rules/auth.md`)
- [ ] i18n: no hardcoded strings; logical properties for spacing (`.claude/rules/i18n.md`)
- [ ] Tailwind: semantic tokens only; no raw hex (`.claude/rules/tailwind.md`)

## Deployment

- [ ] Vercel preview deploy passed manually verified at least once
- [ ] Production deploy succeeded after merge
- [ ] `/watch` confirms no console errors / network failures in production
- [ ] If touches database: migration ran cleanly, no rollback needed

## Issue

- [ ] Linked GitHub issue closed via `Closes #N` in the PR
- [ ] Issue contains the user-visible outcome described
- [ ] If reported by a user, comment on issue with the fix and a thank-you

## Captain awareness

- [ ] Captain journal entry mentions the shipped feature in next weekly cycle
- [ ] If revenue-related, `revenue.json` updated within 24h
