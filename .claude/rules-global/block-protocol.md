---
paths:
  - "**/.claude/blocks.json"
  - "**/src/components/**"
  - "**/src/app/**"
  - "**/content/docs*/**"
---

# Block Protocol — per-repo feature blocks

Every feature block in a repo's `.claude/blocks.json` is a passive keyword (hogwarts:
`timetable`, `attendance`, `exams`, `grades`, `admission`, `finance`, `table`, `docs`, …).
Saying a block's name in prose activates this protocol. The list of every repo and block
keyword, and how to say one from another repo: `kun/content/docs/places.mdx`.

Two modes, set in the registry (`"protocol"`): **full** (hogwarts — every key, the steps
below) and **light** (repos that have not adopted block records — only a block that already
has records gets a pointer and the Stop nudge; the rest are routing keywords and nothing more).

## Before work

Read the block's `README.md` + `ISSUE.md` + `CLAUDE.md` (under the block's component dir) and
the related GitHub issue. Skip for quick small tasks.

## After work

Update those records + `content/docs-*/<block>.mdx`, and comment on / close the related issue.

## Enforcement

Hook-enforced — the protocol survives even when forgotten:

- `block-context` — injects block context on prompt (UserPromptSubmit)
- `block-touch` + `block-guard` — Stop nudge when 2+ code files change without record/docs updates

Canonical hook copies: `kun/.claude/hooks/` (setup.sh installs them at `~/.claude/hooks/`; `.claude/settings.json` wires them fleet-wide).
Regenerate a repo's registry: `node .claude/scripts/generate-blocks.mjs <repo-root>` (it keeps
the saved `--containers` and `--protocol`), then `node .claude/scripts/resolve.mjs --build`.
Headless runs skip the Stop nudge.
