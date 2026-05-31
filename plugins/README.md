# Kun plugins

Databayt's Kun engine, packaged as **two Claude Code plugins in one marketplace** so the whole engine installs in one command instead of via the bash installer.

| Plugin          | What's inside                                                                                     | For whom                                                      |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **kun-stack**   | 27 stack agents (Next.js, React, Prisma, Tailwind, TypeScript, shadcn, …) + build/dev/test skills | Anyone on the databayt stack — portable, OSS                  |
| **kun-company** | 18 leadership/product agents + the pipeline/ops commands + 10 pattern cards + 3 rules             | Databayt's operating model — a reference, not install-and-run |

## Install

```bash
/plugin marketplace add databayt/kun
/plugin install kun-stack@kun        # the portable stack fleet
/plugin install kun-company@kun      # databayt's operating fleet (optional)
```

Plugin commands are namespaced — `/kun-company:feature`, not bare `/feature`. Inside the kun repo itself, the bare project commands in `.claude/commands/` still win; the plugin exists to bring those verbs to _other_ repos.

## How it's built

The plugin trees are **build artifacts**. Canonical sources live in:

- `.claude/` (project) — company agents, commands, cards, rules
- `~/.claude/agents` + `~/.claude/skills` (user) — the stack fleet

`bash .claude/scripts/build-plugin.sh` regenerates both plugins from those sources. Re-run it after editing any canonical source. `/health` runs `build-plugin.sh --check` to flag drift, and the build aborts if any literal secret is found in `plugins/` (MCP server defs carry `${ENV}` placeholders only).

## Note on the bash installers

The bash setup/sync scripts deploy the stack agents into `~/.claude/agents`. Once you install `kun-stack` via `/plugin`, those agents become plugin-managed — running the installer too would double-deliver them. Prefer the plugin path; the installers remain for secrets + MCP setup. Reconciling the installer to stop copying stack agents is tracked as follow-up.

## License

SSPL-1.0.
