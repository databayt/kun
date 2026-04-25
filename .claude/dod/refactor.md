# Definition of Done — Refactor

Story 26.5 in `docs/EPICS-V4.md`.

A refactor is "done" only when ALL of the following are true:

## Behavior preservation

- [ ] Public API unchanged (or change is documented as a breaking change with migration notes)
- [ ] All existing tests pass without modification (rare exceptions: explicit test refactor, justified in PR)
- [ ] If user-facing UI: visual diff shows zero pixel change in both locales
- [ ] If tenant-owned: same data flows, same `schoolId` scoping

## Justification

- [ ] PR description states the concrete benefit (perf, readability, deduplication, pattern alignment)
- [ ] Benefit is measured where applicable (LCP delta, bundle size delta, line count delta)
- [ ] Refactor scope is narrow — one concern per PR (don't bundle "rename + extract + retype")

## Pattern alignment

- [ ] If migrating to a canonical pattern, that pattern's card in `.claude/patterns/cards/` is referenced
- [ ] If creating a new pattern, the pattern card is added in this PR
- [ ] No new abstractions for a single use case (3+ similar uses justify abstraction)

## Tests

- [ ] No reduction in coverage on touched files
- [ ] If extracting a shared util: util has its own test file
- [ ] If migrating to a new pattern: at least one consumer's tests prove the pattern works

## Conventions

- [ ] All `.claude/rules/*.md` checks pass (auth, prisma, tailwind, etc.)
- [ ] No new TODO/FIXME comments
- [ ] Imports normalized (no barrel imports per `.claude/rules/`)

## Captain awareness

- [ ] If the refactor changes public API across repos: tech-lead agent notified
- [ ] If refactor was triggered by a customer-visible bug: linked back to the bug issue in the PR
- [ ] No surprise: the refactor was either captured in a sprint plan or in the captain decision queue before being started
