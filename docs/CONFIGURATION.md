# Configuration Blueprint: Kun (كن)

> **Version**: 2.0
> **Date**: 2026-03-30
> **Purpose**: The complete specification of Databayt's configuration engine

---

## 1. Overview

Kun's value is its configuration. This is the complete blueprint of every setting, agent, skill, hook, MCP server, rule, and memory file that transforms Anthropic's products into Databayt's operating system.

### Configuration Inventory

| Component | Count | Location |
|-----------|-------|----------|
| CLAUDE.md files | 3 layers | ~/.claude/, CLAUDE.md, .claude/CLAUDE.md |
| Agents | 28 | ~/.claude/agents/ |
| Skills | 17 | ~/.claude/skills/ |
| MCP Servers | 18 | ~/.claude/mcp.json |
| Rules | 8 | ~/.claude/rules/ |
| Hooks | 5 | ~/.claude/settings.json |
| Memory files | 6 | ~/.claude/memory/ |
| Allow rules | 38 | ~/.claude/settings.json |
| Deny rules | 4 | ~/.claude/settings.json |
| Keywords | 100+ | .claude/CLAUDE.md |

---

## 2. Settings (`~/.claude/settings.json`)

### Model

```json
{ "model": "claude-opus-4-6" }
```

### Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| CODEBASE_PATH | /Users/abdout/codebase | Pattern library |
| OSS_PATH | /Users/abdout/oss | Open source workspace |
| GITHUB_USER | abdout | GitHub username |
| CLAUDE_CODE_SUBAGENT_MODEL | opus | Subagent model |
| DEV_PORT | 3000 | Development server port |

### Permission Allow Rules (38)

- **Git**: `Bash(git *)` — all git operations
- **Package manager**: `Bash(pnpm *)`, `Bash(npx *)` — package operations
- **Node**: `Bash(node *)` — runtime execution
- **File tools**: Read, Edit, Write, Glob, Grep, Agent, WebFetch, WebSearch
- **MCP wildcards** (17): shadcn, github, browser, browser-headed, Neon, Vercel, Figma, ref, context7, sentry, linear, stripe, postgres, a11y, storybook, Indeed, design-system-analyzer

### Permission Deny Rules (4)

| Rule | Reason |
|------|--------|
| `Bash(rm -rf *)` | Prevent catastrophic deletion |
| `Bash(prisma migrate reset *)` | Prevent database wipe |
| `Bash(prisma db push --accept-data-loss *)` | Prevent data loss |
| `mcp__neon__run_sql(DROP TABLE *)` | Prevent table deletion |

### Hooks

| Hook | Event | Action |
|------|-------|--------|
| SessionStart | Session begins | Print model + timestamp |
| PreToolUse(pnpm dev) | Before dev server | Kill port 3000 |
| PostToolUse(pnpm dev) | After dev server | Open Chrome |
| PostToolUse(Write\|Edit) | After file change | Run Prettier |
| Stop | Agent finishes | Log session end |

---

## 3. CLAUDE.md Hierarchy

### Layer 1: User-Level (`~/.claude/CLAUDE.md`)

| Setting | Value |
|---------|-------|
| Model | Opus 4.6 |
| Package manager | pnpm |
| Stack | Next.js 16, React 19, Prisma 6, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Languages | Arabic (RTL default), English (LTR) |
| Mode | Full Autopilot (100-turn cycles) |
| Port | Always 3000 |
| Environment | Single .env only |
| Component hierarchy | ui → atom → template → block → micro |
| Reference codebase | /Users/abdout/codebase |

### Layer 2: Project-Level (`CLAUDE.md`)

Project-specific context per product:
- **Hogwarts**: Multi-tenant education SaaS, school modules, SSPL license
- **Mkan**: Rental marketplace, Airbnb-inspired, booking flow
- **Kun**: Configuration engine, documentation site, 3-phase roadmap

### Layer 3: Repo-Level (`.claude/CLAUDE.md`)

Operational configuration:
- 100+ keyword-to-action mappings
- MCP trigger table
- Slash command reference
- Organization repository references
- React best practices (Vercel)

---

## 4. Agent Fleet (`~/.claude/agents/`)

28 agents in 6 chains:

### Stack Chain (7)

| Agent | Domain |
|-------|--------|
| nextjs | App Router, Server Components, Server Actions |
| react | Hooks, concurrent features, performance |
| typescript | Strict mode, generics, advanced types |
| tailwind | Semantic tokens, responsive, RTL/LTR |
| prisma | PostgreSQL, migrations, query optimization |
| shadcn | Radix primitives, registry, MCP |
| authjs | JWT, OAuth, sessions |

### Design Chain (4)

| Agent | Domain |
|-------|--------|
| orchestration | Master coordinator, multi-agent workflows |
| architecture | Mirror pattern, multi-tenant (Hogwarts) |
| pattern | Code conventions, anti-patterns |
| structure | File organization, naming |

### UI Chain (4)

| Agent | Domain |
|-------|--------|
| shadcn | Radix primitives, registry |
| atom | Compose 2+ shadcn/ui primitives |
| template | Full-page layouts |
| block | UI + business logic (DataTable, auth, payments) |

### DevOps Chain (3)

| Agent | Domain |
|-------|--------|
| build | TypeScript validation, Turbopack |
| deploy | Vercel, staging/production |
| test | Vitest, Playwright, TDD |

### VCS Chain (2)

| Agent | Domain |
|-------|--------|
| git | Branching, commits, conventional format |
| github | PRs, issues, Actions, code review |

### Specialized (8)

| Agent | Domain |
|-------|--------|
| middleware | Auth, i18n, subdomain routing |
| internationalization | Arabic/English, RTL/LTR, dictionaries |
| semantic | HTML, color tokens, accessibility |
| sse | Server-side exception diagnosis |
| optimize | Feature optimization, automation |
| performance | Core Web Vitals, profiling |
| comment | Code comments |
| icon | SVG icon management |

### Reference Chain (4 product agents)

| Agent | Product |
|-------|---------|
| hogwarts | Education SaaS patterns |
| souq | E-commerce patterns |
| mkan | Rental marketplace patterns |
| shifa | Medical platform patterns |

---

## 5. Skill Library (`~/.claude/skills/`)

### Workflow Skills

| Skill | Trigger | What It Does |
|-------|---------|-------------|
| /dev | "dev" | Kill port 3000 → pnpm dev → Open Chrome |
| /build | "build" | pnpm build + TypeScript check + auto-fix |
| /quick | "push" | Lint → fix → commit → push |
| /deploy | "deploy" | Vercel deploy with retry (max 5) |

### Creation Skills

| Skill | Trigger | What It Does |
|-------|---------|-------------|
| /atom | "atom [name]" | Create/list/preview atom components |
| /template | "template [name]" | Create/list/preview page layouts |
| /block | "block [name]" | Create/refactor/audit with quality scoring |
| /saas | "saas [feature]" | Generate schema + actions + UI + pages |

### Quality Skills

| Skill | Trigger | What It Does |
|-------|---------|-------------|
| /test | "test [file]" | Generate Vitest + Playwright tests |
| /security | "security" | OWASP Top 10 + dependency scan |
| /performance | "performance" | Core Web Vitals + bundle + DB audit |
| /fix | "fix" | Auto-fix TypeScript, lint, build errors |

### Documentation & Utility Skills

| Skill | Trigger | What It Does |
|-------|---------|-------------|
| /docs | "docs" | Generate MDX, API docs, Storybook |
| /codebase | "codebase" | Browse/search/copy from pattern library |
| /repos | "repos" | Explore databayt organization |
| /screenshot | "screenshot" | View recent screenshot |
| /motion | "motion" | Add Framer Motion animations |

### Custom Commands

| Command | Trigger | What It Does |
|---------|---------|-------------|
| /handover | "handover [block]" | 5-pass QA on localhost + production |

---

## 6. MCP Ecosystem (`~/.claude/mcp.json`)

### 18 Servers

#### UI & Design (5)

| Server | Purpose |
|--------|---------|
| shadcn | Component registry |
| figma | Design file access (127.0.0.1:3845) |
| tailwind | CSS utilities, docs |
| a11y | Accessibility audits (WCAG 2.1 AA) |
| storybook | Visual testing |

#### Testing (2)

| Server | Purpose |
|--------|---------|
| browser | Headless Chromium (1920x1080) |
| browser-headed | Visible Chromium (auth flows) |

#### DevOps & Infra (4)

| Server | Purpose |
|--------|---------|
| github | Repos, issues, PRs, Actions |
| vercel | Deployments, logs |
| sentry | Error monitoring |
| gcloud | Google Cloud CLI |

#### Data & Auth (4)

| Server | Purpose |
|--------|---------|
| neon | Neon PostgreSQL branching |
| postgres | Database queries (dbhub) |
| stripe | Payments, subscriptions |
| keychain | macOS Keychain credentials |

#### Knowledge & PM (3)

| Server | Purpose |
|--------|---------|
| ref | Technical documentation |
| context7 | Up-to-date library docs |
| linear | Issue tracking |

---

## 7. Rules Engine (`~/.claude/rules/`)

8 path-scoped rules:

| Rule | Glob Patterns | Key Enforcements |
|------|--------------|------------------|
| auth | `**/auth/**`, `**/middleware.*` | NextAuth v5, session.user.schoolId |
| i18n | `**/*-ar.json`, `**/dictionaries/**` | Single-language storage, RTL logical |
| prisma | `**/*.prisma`, `**/prisma/**` | Always include schoolId, $extends |
| tailwind | `**/*.css`, `**/styles/**` | CSS-first v4, OKLCH, RTL logical |
| testing | `**/tests/**`, `**/*.spec.*` | Playwright in tests/, Vitest co-located |
| deployment | `**/vercel.json` | pnpm, tsc before builds |
| multi-repo | (global) | CODEBASE_PATH, fork workflows |
| org-refs | (global) | Priority: codebase → shadcn → radix |

---

## 8. Memory System (`~/.claude/memory/`)

### 6 Persistent Files

| File | Contents |
|------|----------|
| preferences.json | Port 3000, single .env, pnpm-only |
| repositories.json | 14 databayt repos with paths, stacks, sync config |
| atom.json | 59 atoms across 6 categories |
| template.json | 31 templates across 5 categories |
| block.json | 4 blocks (DataTable, Auth, Invoice, Report) |
| report.json | T&C electrical report templates |

### Project-Level Memory

Stored at `~/.claude/projects/[project]/memory/`:
- Company profile (team, financials)
- Active project status (Hogwarts pilot)
- User preferences and feedback

---

## 9. Installation

### New Team Member Setup

```bash
# macOS (engineer role is default)
git clone git@github.com:databayt/kun.git ~/kun
cd ~/kun && bash .claude/scripts/install.sh
bash .claude/scripts/secrets.sh <GIST_ID>

# macOS (business or content role)
cd ~/kun && bash .claude/scripts/install.sh business
cd ~/kun && bash .claude/scripts/install.sh content

# Windows (PowerShell)
git clone git@github.com:databayt/kun.git ~/kun
cd ~/kun; .\.claude\scripts\install.ps1
.\.claude\scripts\secrets.ps1 -GistId <GIST_ID>

# Windows (business or content role)
cd ~/kun; .\.claude\scripts\install.ps1 -Role business
cd ~/kun; .\.claude\scripts\install.ps1 -Role content
```

### Roles

| Role | Skills | MCP | Hooks | Codebase Clone |
|------|--------|-----|-------|----------------|
| **engineer** | All 17 | All 18 | All 5 | Yes |
| **business** | docs, repos, screenshot, codebase | None | None | No |
| **content** | docs, repos, screenshot, codebase | None | None | No |

### What the Installer Does

1. Copies agents to `~/.claude/agents/`
2. Copies skills to `~/.claude/commands/` (role-filtered)
3. Copies rules to `~/.claude/rules/`
4. Installs settings into `~/.claude/settings.json` (role-specific)
5. Sets up MCP servers in `~/.claude/mcp.json` (engineer only)
6. Creates memory directory with component registry
7. Clones databayt/codebase to ~/codebase (engineer only)

### Setup Time: ~5 minutes

---

## 10. Keyword Quick Reference

| Say | What Happens |
|-----|-------------|
| "dev" | Kill port 3000 → pnpm dev → Chrome |
| "push" | git add → commit → push |
| "deploy" | Vercel deploy → retry → report |
| "table users" | block agent → DataTable → prisma |
| "auth" | authjs agent → NextAuth setup |
| "saas billing" | orchestrate → stripe MCP → schema + UI |
| "test login" | test agent → Vitest + Playwright |
| "handover auth" | 5-pass QA → both environments |
| "clone vercel/ai" | GitHub MCP → clone → adapt |
