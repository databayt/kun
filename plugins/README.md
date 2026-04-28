# Kun Plugins

Story 25 in `docs/EPICS-V4.md`. The kun engine packaged as 7 installable plugins.

## Plugin map

| Plugin | What | For whom |
|--------|------|----------|
| `kun-core` | ~30 specialist agents + 60 skills + 12 rules + 13 memory + 3 hooks | Every databayt repo |
| `kun-captain` | Captain + 9 leadership agents + 11 captain skills + decision matrix | Org orchestrators |
| `kun-engineer` | Role profile — full surface | Abdout (founder + lead engineer) |
| `kun-business` | Role profile — captain + revenue + outreach | Ali (sales + QA) |
| `kun-content` | Role profile — business + figma + translate + R&D | Samia (R&D + kun caretaker) |
| `kun-ops` | Role profile — deploy + monitor + incident | Sedon (Saudi ops) |
| `kun-accessible` | Output style overlay — verbose, semantic, no emoji | Samia + Ali (blind / screen-reader) |

## Stacking

Plugins compose. The standard install for each team member:

```bash
# Abdout (engineer)
claude --plugin-dir kun-core --plugin-dir kun-captain --plugin-dir kun-engineer

# Ali (business + accessible)
claude --plugin-dir kun-core --plugin-dir kun-captain --plugin-dir kun-business --plugin-dir kun-accessible

# Samia (content + accessible)
claude --plugin-dir kun-core --plugin-dir kun-captain --plugin-dir kun-content --plugin-dir kun-accessible

# Sedon (ops)
claude --plugin-dir kun-core --plugin-dir kun-captain --plugin-dir kun-ops
```

`kun-core` is the foundation. `kun-captain` is optional but recommended (adds the org-orchestration layer). Role profiles are mutually exclusive — pick one. `kun-accessible` stacks on any role profile.

## Build the plugins from kun

This directory contains manifests + READMEs + role-specific `settings.json`. The actual content (agents, skills, rules, hooks, memory) is built from the parent `.claude/` directory by:

```bash
bash scripts/build-plugins.sh
# or for one plugin
bash scripts/build-plugins.sh kun-core
```

After build, each plugin directory is fully self-contained per the Anthropic plugin schema.

## Install

### From a local clone (development)

```bash
git clone https://github.com/databayt/kun
cd kun
bash scripts/build-plugins.sh
claude --plugin-dir ./plugins/kun-core --plugin-dir ./plugins/kun-captain
```

### From the Anthropic marketplace (after E25.5 submission)

```
/plugin install kun-core
/plugin install kun-captain
/plugin install kun-engineer
```

## Namespacing

All plugin skills are namespaced. `kun-core`'s `/nextjs` becomes `/kun-core:nextjs`. Use `kun-core:nextjs` to invoke explicitly, or just `nextjs` if there's no conflict.

`kun-captain` and `kun-business` may have skills with the same name (e.g. `/dispatch`). Higher-priority install wins per Anthropic's plugin scoping (managed > personal > project > plugin).

## Versioning

All plugins ship version `4.0.0` matching `docs/EPICS-V4.md`. Bump together when v5 launches.

## License

All plugins: SSPL-1.0 (databayt's primary license).

## Reference

- Story 25 in `docs/EPICS-V4.md`
- Plugin schema: https://code.claude.com/docs/en/plugins
- Marketplace: https://claude.ai/settings/plugins
