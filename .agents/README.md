# .agents/ — Cross-Tool Alias

Story 27.3 in `docs/EPICS-V4.md`.

This directory is a symlink alias for `/.claude/` so external AI coding tools (Cursor, Windsurf, Aider, the Vercel `agentskills.io` ecosystem) discover kun's skills, agents, and rules without configuration.

## Layout

```
.agents/
├── skills/  → ../.claude/skills/   # 64 SKILL.md skill definitions
├── agents/  → ../.claude/agents/   # 49 specialist + leadership agent files
└── rules/   → ../.claude/rules/    # 12 path-scoped rules
```

## Why both locations

- `.claude/` is the canonical Anthropic Claude Code path
- `.agents/` is the open standard from [agentskills.io](https://agentskills.io) used by Vercel's react-best-practices skill, Cursor, and others

Both surfaces point at the same files. Edit in `.claude/`; `.agents/` updates automatically (it's a symlink).

## Compatibility

| Tool | Reads | Source |
|------|-------|--------|
| Claude Code | `.claude/` | Native |
| Cursor | `.cursorrules` (different) | Bridge needed; not yet in kun |
| Windsurf | `.windsurfrules` (different) | Bridge needed; not yet in kun |
| Vercel agent skills | `.agents/skills/<n>/SKILL.md` | Via this alias |

Bridges to `.cursorrules` and `.windsurfrules` are tracked under E27 follow-ups.

## Note

Symlinks are git-tracked. If you clone kun on Windows, the symlinks will appear as regular files with the link path as content. Use `git config core.symlinks true` and re-clone, or run:

```powershell
git update-index --refresh
```
