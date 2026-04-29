# Configuration Blueprint

This is the engine. Every setting, agent, skill, hook, MCP server, rule, and memory file that shapes how Claude Code behaves.

## Live Inventory

| Component | Location |
|-----------|----------|
| CLAUDE.md | `~/.claude/`, project `CLAUDE.md`, repo `.claude/CLAUDE.md` |
| Agents | `~/.claude/agents/` |
| Skills | `~/.claude/skills/<name>/SKILL.md` |
| MCP servers | `~/.claude/mcp.json` + role variants |
| Rules | `~/.claude/rules/` |
| Hooks | `~/.claude/settings.json` |
| Memory | `~/.claude/memory/` |
| Permissions | `~/.claude/settings.json` (allow / deny) |

## Settings (`~/.claude/settings.json`)

### Model & Environment

| Setting | Value |
|---------|-------|
| Model | `claude-opus-4-7` |
| `DEV_PORT` | 3000 |
| `CLAUDE_CODE_SUBAGENT_MODEL` | `opus` |

### Permissions

**Allow rules** cover git, pnpm, npx, node, file operations, configured MCP server wildcards.

**Deny rules** block destructive operations:
- `rm -rf *`
- `prisma migrate reset *`
- `prisma db push --accept-data-loss *`
- `DROP TABLE *`

### Hooks

| Hook | Event | Action |
|------|-------|--------|
| SessionStart | Session begins | Print model + timestamp |
| PreToolUse | Before `pnpm dev` | Kill port 3000 |
| PostToolUse | After `pnpm dev` | Open browser |
| PostToolUse | After Write/Edit | Auto-run Prettier |
| Stop | Agent finishes | Log session end |

## CLAUDE.md Hierarchy

### Layer 1: User-level (`~/.claude/CLAUDE.md`)

| Setting | Value |
|---------|-------|
| Model | Opus |
| Package manager | pnpm |
| Stack | Next.js 16, React 19, Prisma 6, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Languages | Arabic (RTL default), English (LTR) |
| Port | Always 3000 |
| Environment | Single `.env` only |

### Layer 2: Project-level
Project-specific context: domain model, multi-tenancy, license, key constraints.

### Layer 3: Repo-level
Keyword-to-action mappings, MCP trigger table, slash commands, framework best practices.

## Skill Library

### Workflow

| Skill | Trigger | What It Does |
|-------|---------|--------------|
| `/dev` | `dev` | Kill port → pnpm dev → open browser |
| `/build` | `build` | pnpm build + TypeScript check + auto-fix |
| `/quick` | `push` | Lint → fix → commit → push |
| `/deploy` | `deploy`, `ship` | Vercel deploy with retry |

### Creation

| Skill | Trigger | What It Does |
|-------|---------|--------------|
| `/atom` | `atom [name]` | Create atom component |
| `/template` | `template [name]` | Create page layout |
| `/block` | `block [name]` | Create block with quality scoring |
| `/saas` | `saas [feature]` | Schema + actions + UI + pages |

### Quality

| Skill | Trigger | What It Does |
|-------|---------|--------------|
| `/test` | `test [file]` | Generate tests |
| `/security` | `security` | OWASP Top 10 + dependency scan |
| `/performance` | `performance` | Core Web Vitals + bundle + DB queries |
| `/fix` | `fix` | Auto-fix TypeScript/lint/build errors |

### Other

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `/docs` | `docs` | MDX, API docs, Storybook stories |
| `/codebase` | `codebase` | Browse/search/copy patterns |
| `/repos` | `repos` | Explore organization repositories |
| `/handover` | `handover [block]` | Multi-pass production QA |

## MCP Ecosystem

Per role:

| Role | Config | Servers |
|------|--------|---------|
| **engineer** | `mcp.json` | All |
| **business** | `mcp-business.json` | github, slack, linear, stripe, notion, browser, context7, memory-bank |
| **content** | `mcp-content.json` | github, slack, notion, browser, figma, context7, memory-bank, ref |
| **ops** | `mcp-ops.json` | github, slack, vercel, sentry, neon, stripe, browser, posthog, memory-bank |

## Rules Engine

| Rule | Activates On | Enforces |
|------|--------------|----------|
| auth | `**/auth/**`, `**/middleware.*` | NextAuth v5, session scoping |
| i18n | `**/*-ar.json`, `**/dictionaries/**` | Single-language storage, RTL |
| prisma | `**/*.prisma` | Tenant scoping, `$extends` |
| tailwind | `**/*.css`, `**/styles/**` | CSS-first v4, OKLCH, RTL logical |
| testing | `**/tests/**`, `**/*.spec.*` | Playwright/Vitest conventions |
| deployment | `**/vercel.json` | pnpm, tsc before builds |
| multi-repo | (global) | Cross-repo paths |
| org-refs | (global) | Repo priority lookup |

## Memory System

| File | Contents |
|------|----------|
| `preferences.json` | Port, env policy, package manager |
| `repositories.json` | Org repos with paths + stacks |
| `atom.json` | Atom component registry |
| `template.json` | Template registry |
| `block.json` | Block registry |
| `report.json` | Report templates |

## Installation

```bash
cd ~/kun && bash .claude/scripts/install.sh                # engineer
cd ~/kun && bash .claude/scripts/install.sh business
cd ~/kun && bash .claude/scripts/install.sh content
cd ~/kun && bash .claude/scripts/install.sh ops
```

Windows uses the matching `.ps1` scripts.
