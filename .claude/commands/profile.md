---
description: Load a selective config profile by role (engineer/business/content/ops)
argument-hint: <role>
---

# Profile — Selective Config Loading

Manage configuration profiles that control which agents, skills, and rules are active.

## Usage

- `/profile` — show current profile and available profiles
- `/profile core` — switch to core profile
- `/profile security` — switch to security profile
- `/profile ali` — switch to Ali's personal profile
- `/profile create <name>` — create a new profile
- `/profile show <name>` — show what's in a profile

## Argument: $ARGUMENTS

## Instructions

Parse arguments:

- No args → show current profile + list available profiles
- Profile name → activate that profile
- `create <name>` → create new profile interactively
- `show <name>` → display profile contents

### What is a Profile?

A profile is a named subset of the Kun engine configuration. Instead of loading all 44 agents, 40+ skills, and all rules, a profile selects only what's relevant for a specific role, task, or person.

Profiles are stored in `~/.claude/profiles/` as YAML files.

### Built-in Profiles

#### `core` — Minimum viable engine

The essentials for any developer on any repo.

```yaml
# ~/.claude/profiles/core.yaml
name: core
description: Essential tools for daily development
agents:
  - nextjs
  - react
  - typescript
  - build
  - deploy
  - git
  - github
commands:
  - dev
  - build
  - deploy
  - clone
rules: [] # all rules always apply
```

#### `developer` — Full development toolkit

Everything a developer needs, minus business agents.

```yaml
name: developer
description: Full development toolkit
agents:
  - nextjs
  - react
  - typescript
  - tailwind
  - prisma
  - shadcn
  - authjs
  - build
  - deploy
  - test
  - git
  - github
  - architecture
  - pattern
  - structure
  - middleware
  - internationalization
  - semantic
  - sse
  - performance
  - atom
  - template
  - block
commands:
  - dev
  - build
  - deploy
  - test
  - clone
  - atom
  - block
  - template
  - schema
  - wire
  - code
  - check
  - translate
  - docs
  - security
  - performance
rules: all
```

#### `security` — Security and compliance focus

For security audits and auth work.

```yaml
name: security
description: Security audit and auth focus
agents:
  - guardian
  - authjs
  - middleware
  - typescript
  - build
  - test
commands:
  - security
  - build
  - test
  - check
rules: all
```

#### `business` — Non-technical operations

For Ali, Samia, Sedon — business operations via Cowork.

```yaml
name: business
description: Business operations — no code agents
agents:
  - captain
  - revenue
  - growth
  - support
  - product
  - analyst
commands:
  - weekly
  - monitor
  - costs
  - pricing
  - proposal
  - content-calendar
  - dispatch
  - issue
rules: []
```

#### `qa` — Quality assurance

For Ali's testing workflow.

```yaml
name: qa
description: QA and testing workflow
agents:
  - quality
  - report
  - test
  - guardian
  - build
  - sse
commands:
  - test
  - build
  - check
  - security
  - performance
  - screenshot
rules: all
```

#### `full` — Everything

All agents, all skills, all rules. Default for Abdout.

```yaml
name: full
description: Complete engine — all agents, skills, rules
agents: all
commands: all
rules: all
```

### Personal Profiles

#### `abdout` — Builder (alias for full)

```yaml
name: abdout
extends: full
```

#### `ali` — QA + Sales

```yaml
name: ali
extends: qa
agents_add:
  - revenue
  - support
  - analyst
commands_add:
  - report
  - monitor
  - proposal
```

#### `samia` — R&D + Kun Care

```yaml
name: samia
extends: business
agents_add:
  - tech-lead
  - learn
  - analyze
commands_add:
  - learn
  - analyze
  - docs
```

#### `sedon` — Executor

```yaml
name: sedon
extends: business
agents_add:
  - ops
  - deploy
commands_add:
  - deploy
  - monitor
  - incident
  - credentials
```

### Creating a Profile

`/profile create <name>`:

1. Ask: "What's the role? (developer, business, security, custom)"
2. Ask: "Which agents? (list, or 'like <existing-profile>')"
3. Ask: "Which commands?"
4. Generate YAML file in `~/.claude/profiles/<name>.yaml`
5. Report: "Profile <name> created with N agents, M commands."

### Showing a Profile

`/profile show <name>`:

Display the profile contents in a readable table:

```
Profile: ali (QA + Sales)
Extends: qa

Agents (12):
  quality, report, test, guardian, build, sse,
  revenue, support, analyst

Commands (10):
  test, build, check, security, performance, screenshot,
  report, monitor, proposal

Rules: all
```

### Switching Profiles

`/profile <name>`:

1. Read the profile YAML
2. Report what's being activated/deactivated
3. Note: Profile switching is informational for now — it tells agents which subset to use. Full enforcement requires settings.json `allowedTools` support (Phase 2).

### Profile in Analyze

When `/analyze` generates config for a repo, it includes profile recommendations:

```markdown
## Recommended Profiles

- **core**: nextjs, typescript, build, deploy — for quick fixes
- **full**: + prisma, tailwind, shadcn, test, i18n — for feature work
```

### How Profiles Work (Current)

Profiles are **advisory** in Phase 1:

- The YAML files define what should be loaded
- Agents read the active profile and scope their work accordingly
- The captain uses profiles for team allocation

Profiles become **enforced** in Phase 2:

- Settings.json `allowedTools` maps to profile
- Only agents in the active profile get spawned
- Hook validates agent spawning against profile

**Rule**: Not everyone needs 44 agents. Profiles give each person and each task exactly the engine they need — no more, no less.
