---
paths: [".claude/**"]
---

# Engine Parity — fleet changes land whole

`.claude/engine.json` → `counts` is the declared truth; `health.sh` warns when reality drifts.
Plugins (`plugins/kun-*`) and the vocabulary outputs (CLAUDE.md block, `spellbook-data.ts`) are
**build artifacts** of `.claude/` sources.

When you add/remove/rename an agent, skill, rule, pattern card, MCP server, or workflow, the
SAME commit must carry:

1. `.claude/engine.json` → `counts` updated to the new reality
2. `node .claude/scripts/generate-vocab.mjs` re-run if the change touches any vocabulary target
3. `bash .claude/scripts/build-plugin.sh` re-run (plugin parity)

**Personal beats project.** setup.sh installs every kun skill into `~/.claude/skills/`, and when a
name exists in both, Claude Code runs the personal copy — so inside a kun session an edited
`.claude/skills/<name>/SKILL.md` does not run until setup re-copies it (the daily maintain heartbeat
does; `bash .claude/scripts/setup.sh` does it now). Test a skill edit only after that.

Verify before committing: `bash .claude/scripts/health.sh` — the engine section must be all ✅.
A fleet commit that leaves health warning is a broken commit even if the build is green.
