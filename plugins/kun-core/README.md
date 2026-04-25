# kun-core

The technical foundation of the kun engine. Bundles the agents, skills, rules, hooks, and memory files every databayt repo needs.

## What's inside

After running `bash scripts/build-plugins.sh kun-core`, this directory contains:

```
kun-core/
├── .claude-plugin/plugin.json         # this manifest
├── agents/                            # ~30 specialist agents (excludes captain + leadership)
│   ├── nextjs.md
│   ├── react.md
│   ├── typescript.md
│   ├── tailwind.md
│   ├── prisma.md
│   ├── shadcn.md
│   ├── authjs.md
│   ├── atom.md
│   ├── template.md
│   ├── block.md
│   ├── figma.md
│   ├── structure.md
│   ├── architecture.md
│   ├── pattern.md
│   ├── learn.md
│   ├── analyze.md
│   ├── package.md
│   ├── deploy.md
│   ├── build.md
│   ├── test.md
│   ├── git.md
│   ├── github.md
│   ├── middleware.md
│   ├── internationalization.md
│   ├── semantic.md
│   ├── sse.md
│   ├── optimize.md
│   ├── performance.md
│   ├── comment.md
│   ├── orchestration.md
│   └── report.md
├── skills/                            # 14 sweep skills + creation skills + dev loop
│   ├── nextjs/SKILL.md
│   ├── react/SKILL.md
│   ├── typescript/SKILL.md
│   ├── tailwind/SKILL.md
│   ├── shadcn/SKILL.md
│   ├── prisma/SKILL.md
│   ├── authjs/SKILL.md
│   ├── accessibility/SKILL.md
│   ├── barrel/SKILL.md
│   ├── waterfall/SKILL.md
│   ├── skeleton/SKILL.md
│   ├── structure/SKILL.md
│   ├── guard/SKILL.md
│   ├── translate/SKILL.md
│   ├── react-best-practices/SKILL.md
│   ├── atom/SKILL.md
│   ├── template/SKILL.md
│   ├── block/SKILL.md
│   ├── dev/SKILL.md
│   ├── build/SKILL.md
│   ├── deploy/SKILL.md
│   ├── test/SKILL.md
│   └── ...
├── hooks/hooks.json                   # SessionStart, PostToolUse(Prettier), Stop
├── .claude/rules/                     # 12 path-scoped rules
│   ├── auth.md
│   ├── i18n.md
│   ├── prisma.md
│   ├── tailwind.md
│   ├── testing.md
│   ├── deployment.md
│   ├── multi-repo.md
│   ├── org-refs.md
│   ├── cowork-bridge.md
│   ├── figma.md
│   ├── github-workflow.md
│   └── patterns.md
└── settings.json                      # default permissions (49 allow, 10 deny)
```

## Install

### Option 1 — local development (during kun development)

```bash
claude --plugin-dir /path/to/kun/plugins/kun-core
```

Skills are namespaced: `/kun-core:nextjs`, `/kun-core:react`, etc.

### Option 2 — from a marketplace (after E25.5 submission)

```
/plugin install kun-core
```

### Option 3 — bundle as a dependency

In your repo's `.claude/settings.json`:

```json
{
  "plugins": ["kun-core"]
}
```

## What kun-core does NOT include

- Captain + leadership tier (use `kun-captain` plugin)
- Role-specific configurations (use `kun-engineer`, `kun-business`, etc.)
- Accessibility profile (use `kun-accessible`)

For a complete stack, install `kun-core` + `kun-captain` + the role plugin matching the user.

## Build

```bash
bash scripts/build-plugins.sh kun-core
```

This populates the plugin directory by copying the relevant subset from kun's `.claude/`.

## Compatibility

- Claude Code: latest (4.7+)
- Node: 20+
- pnpm: 9+

## License

SSPL-1.0
