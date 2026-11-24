# Org facts — one fact per file

The org's shared memory is public and plain: every coding agent (Claude Code, Codex,
opencode, Antigravity, free Claude Code, Hermes) on every machine reads `~/kun/.claude/memory`
and writes new facts here.

## Write rules
1. One fact per file: `facts/<short-kebab-slug>.md` with frontmatter `name`, `description`,
   `type` (user | feedback | project | reference).
2. Add a one-line pointer in `MEMORY.md` (`- [Title](file.md) — hook`).
3. Update a fact rather than writing a duplicate; delete facts that turned out wrong.
4. Link related facts with `[[name]]`.
5. No keys, tokens or passwords — ever. Those live in the Keychain.

## Sync
```
node .claude/scripts/memory/memory.mjs sync     # pull, commit memory paths only, push to main
node .claude/scripts/memory/memory.mjs status
```
