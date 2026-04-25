# kun-captain

The CEO-brain of the kun engine. Adds captain + 9-agent leadership tier on top of `kun-core`.

## Depends on

- `kun-core` (specialist agents + sweep skills)

## What's inside

```
kun-captain/
├── .claude-plugin/plugin.json
├── agents/
│   ├── captain.md         # CEO brain — opus-4.7, never executes, always delegates
│   ├── revenue.md
│   ├── growth.md
│   ├── support.md
│   ├── product.md
│   ├── analyst.md
│   ├── tech-lead.md
│   ├── ops.md
│   └── guardian.md
├── skills/
│   ├── captain/SKILL.md       # /captain — decision loop with --dry-run
│   ├── weekly/SKILL.md        # /weekly — Monday plan / Wed check / Fri review
│   ├── dispatch/SKILL.md      # /dispatch — atomic write to Apple Notes + Slack + bridge
│   ├── monitor/SKILL.md       # /monitor — cross-product health check
│   ├── costs/SKILL.md         # /costs — Anthropic + Vercel + Neon + Stripe spend
│   ├── health/SKILL.md        # /health — config health across team members
│   ├── incident/SKILL.md      # /incident — production incident workflow
│   ├── sprint-plan/SKILL.md   # /sprint-plan — Monday allocation ceremony
│   ├── standup/SKILL.md       # /standup — daily digest
│   ├── sprint-review/SKILL.md # /sprint-review — Friday retro
│   └── refine/SKILL.md        # /refine — backlog grooming with ICE scoring
├── captain/
│   └── decision-matrix.yaml   # 24 deterministic rules (escalate/act/delegate)
├── hooks/hooks.json           # SessionStart, PreCompact (state snapshot), TeammateIdle
├── memory/                    # captain-state, runway, revenue, capacity, pilot
└── settings.json              # captain-tier env + permissions
```

## Install

```bash
claude --plugin-dir /path/to/kun/plugins/kun-core --plugin-dir /path/to/kun/plugins/kun-captain
```

Skills are namespaced: `/kun-captain:captain`, `/kun-captain:weekly`, etc.

## Why a separate plugin

`kun-core` is the technical foundation — useful for any product team. `kun-captain` adds the org-orchestration layer that's specific to running a small company (1-10 humans, 5-20 repos, $500-50k/mo budget).

A solo developer doesn't need captain. A 4-human company does. Splitting the plugin lets each team install only what they need.

## Setup

After installing, run once:

```bash
bash scripts/setup-apple-notes.sh    # creates Dispatch folder + Captain/Cowork/Inbox notes (Mac)
# or
pwsh scripts/setup-windows.ps1       # creates GitHub labels for fallback dispatch (Windows)
```

Then register Anthropic Routines:

```bash
bash scripts/setup-routines.sh --list
# Open https://claude.ai/code/routines and register each routine
```

## Compatibility

- Claude Code: 4.7+
- Requires `kun-core`
- Requires Anthropic Max plan ($200/mo) for routines

## License

SSPL-1.0
