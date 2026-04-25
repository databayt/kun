---
paths:
  - "/Users/abdout/codebase/**"
  - "/Users/abdout/oss/**"
  - "**/package.json"
description: Cross-repo work — codebase reference, OSS contribution, fork hygiene
---

# Multi-Repo Rules

Active when working across `~/codebase`, `~/oss`, or any repo other than the current one.

## Reference codebase priority

When implementing a feature, check sources in this order:

1. **`/Users/abdout/codebase/src/components/`** — atom + template + block patterns
2. **`/Users/abdout/codebase/__registry__/`** — pre-built shadcn registry items
3. **`databayt/shadcn`** — shadcn/ui fork
4. **`databayt/radix`** — Radix primitives fork
5. **upstream npm** — only when no local pattern matches

Never copy-paste from external repos without attribution. Never re-implement what `~/codebase` already has.

## Cross-repo references

Use `like <repo>` keyword to reference patterns in another databayt repo:

```
"auth like hogwarts"            → reference hogwarts auth
"booking from mkan"             → clone mkan booking pattern
"admission from codebase"       → clone from codebase patterns
```

The `clone` agent reads from those paths and produces an adapted version for the current repo.

## OSS contribution flow

Working under `/Users/abdout/oss/<external-repo>/`:

1. Fork on GitHub
2. Clone into `~/oss/<repo>` with `gh repo clone`
3. Branch from upstream main (`upstream` remote already configured)
4. PR against upstream
5. Sign-off if requested by their CONTRIBUTING.md (DCO/CLA)

Use `contribute` keyword to invoke the workflow.

## Fork hygiene

Forks (databayt/shadcn, databayt/radix) sync via `merge-upstream` weekly via Routine (E17.4 in EPICS-V4). Manual:

```bash
gh repo sync databayt/shadcn --branch main
```

Never rebase the fork's `main` against upstream — that breaks downstream consumers. Always merge.

## Cross-repo PRs

If a feature spans two repos (e.g., shared component change in `databayt/codebase` + consumer change in `databayt/hogwarts`), open both PRs at the same time. Reference each PR in the other's body. Don't merge codebase change until both reviewers approve.

## Never

- Edit a fork's vendored upstream code without a sync plan
- Work in a checkout that's behind `main` by more than 5 commits — pull first
- Mass-rename across repos without coordination
- Skip the upstream remote setup on OSS forks (you'll lose sync)

## Reference

- Org rules: `.claude/rules/org-refs.md`
- Skill: `/clone`, `/codebase`, `/repos`
- Memory: `.claude/memory/repositories.json`
