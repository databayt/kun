# Block Protocol — per-repo feature blocks

Every feature block in a repo's `.claude/blocks.json` is a passive keyword (hogwarts:
`timetable`, `attendance`, `exams`, `grades`, `admission`, `finance`, `table`, `docs`, … 72
keys). Saying a block's name in prose activates this protocol.

## Before work

Read the block's `README.md` + `ISSUE.md` + `CLAUDE.md` (under the block's component dir) and
the related GitHub issue. Skip for quick small tasks.

## After work

Update those records + `content/docs-*/<block>.mdx`, and comment on / close the related issue.

## Enforcement

Hook-enforced — the protocol survives even when forgotten:

- `block-context` — injects block context on prompt (UserPromptSubmit)
- `block-touch` + `block-guard` — Stop nudge when 2+ code files change without record/docs updates

Canonical hook copies: `kun/.claude/scripts/hooks/`, installed at `~/.claude/hooks/`.
Regenerate a repo's registry: `node .claude/scripts/generate-blocks.mjs <repo-root>`.
