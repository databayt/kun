# Kun — Project Configuration

> Project-level overrides for the kun engine. User defaults live in `~/.claude/CLAUDE.md`
> (Component Hierarchy, Reference Codebase, Keyword Vocabulary, Imported Rules).

## Preferences

- **Model**: `claude-opus-4-7` (Opus 4.7, 1M context)
- **Package Manager**: pnpm
- **Stack**: Next.js 16 · React 19 · Prisma 6 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
- **Languages**: Arabic (RTL default) · English (LTR)
- **Mode**: Full Autopilot (100-turn cycles)
- **Commit footer**: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

> Project rules auto-load from `.claude/rules/`:
> `cowork-bridge.md`, `github-workflow.md`, `patterns.md`.

---

## Tier 1 — Pipeline (idea → production)

`feature <name> [product]` chains every stage. Each is also a standalone command.

```
IDEA → SPEC → SCHEMA → CODE → WIRE → CHECK → SHIP → WATCH
```

| Stage | Command | Exit gate |
|-------|---------|-----------|
| Capture | `/idea` | GitHub issue exists |
| Specify | `/spec` | Spec approved on issue |
| Data | `/schema` | Migration applied, types compile |
| Logic | `/code` | `tsc --noEmit` passes |
| UI | `/wire` | `pnpm build` passes |
| Quality | `/check` | All gates green |
| Deploy | `/ship` | Vercel deployment Ready |
| Monitor | `/watch` | No errors, issue closed |

Product scope: append `hogwarts`, `souq`, `mkan`, `shifa` to activate domain context.

---

## Tier 2 — Standalone Tools

Self-describing commands at `.claude/commands/<name>.md`:

`dev`, `build`, `deploy`, `report`, `atom`, `block`, `template`, `test`, `clone`,
`incident`, `monitor`, `package`, `learn`, `analyze`, `profile`, `captain`, `weekly`,
`screenshot`, `pricing`, `costs`, `proposal`, `credentials`, `health`.

## Tier 2b — Coverage Sweeps

All accept `[block]` for scoped runs and `--status` for reports.
Ledger at `<product>/.claude/coverage/ledger.json`, protocol at `.claude/coverage/sweep-protocol.md`.

| Sweep | Mode | Sweep | Mode |
|-------|------|-------|------|
| `/nextjs` | fix | `/prisma` | report |
| `/react` | fix | `/authjs` | report |
| `/typescript` | fix | `/translate` | fix |
| `/tailwind` | fix | `/skeleton` | fix |
| `/shadcn` | fix | `/structure` | fix |
| `/accessibility` | fix | `/guard` | fix |
| `/barrel` | fix | `/waterfall` | fix |

`/coverage [product] [keyword]` for the report.

## Tier 3 — Vocabulary

Claude routes these keywords to the right agent + MCP without a dedicated command.

**UI**: `table`, `form`, `modal`, `card`, `sidebar`, `header`, `footer`, `hero`, `navbar`, `menu`
**Features**: `auth`, `dashboard`, `landing`, `checkout`, `settings`, `profile`, `admin`, `onboarding`
**Animation**: `motion`, `animation`, `transition`, `gesture`, `scroll`
**Quality**: `security`, `performance`, `review`, `audit`, `e2e`
**Build**: `fix`, `error`, `lint`, `format`, `type-check`, `deps`, `outdated`
**React perf**: `parallelize`, `bundle`, `lazy`, `suspense`, `memo`, `streaming`, `dedup`
**Services**: `github`, `figma`, `linear`, `slack`, `stripe`, `vercel`, `sentry`, `neon`, `analytics`
**Cross-repo**: `from codebase`, `from shadcn`, `like hogwarts`, `like souq`, `like mkan`, `like shifa`
**Operations**: `costs`, `pricing`, `weekly`, `monitor`, `incident`, `credentials`
**Intelligence**: `learn`, `analyze`, `profile`, `conventions`, `health`, `patterns`, `drift`

---

## Behavior

When you see a keyword:
1. **Pipeline keyword** → run the corresponding stage command
2. **Sweep keyword** → run full sweep (or scoped to block arg)
3. **Vocabulary keyword** → activate the right agent + MCP
4. **`from <repo>` / `like <product>`** → reference patterns from the named source

Bug fixes → `/report`. New features → `/feature <name>`. Components → `/atom`, `/block`, `/template`.
Enterprise-scale planning still lives at `~/.claude/bmad/`.

## Lookups

- **Command detail**: `.claude/commands/<name>.md`
- **Agent detail**: `.claude/agents/<name>.md` (project) or `~/.claude/agents/<name>.md` (user)
- **Skill spec**: `.claude/skills/<name>/SKILL.md` or `~/.claude/skills/<name>/SKILL.md`
- **Pattern card**: `.claude/patterns/cards/<keyword>.md`
- **MCP servers**: `.claude/mcp.json` (project, 25 servers) + `~/.claude/mcp.json` (user, 19 servers)
