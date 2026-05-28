# Kun — Project Configuration

> Project-level overrides for the kun engine. User defaults live in `~/.claude/CLAUDE.md`
> (Component Hierarchy, Reference Codebase, Keyword Vocabulary, Imported Rules).

## Preferences

- **Model**: `claude-opus-4-7` (Opus 4.7, 1M context)
- **Package Manager**: pnpm
- **Stack**: Next.js 16 · React 19 · Prisma 6 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
- **Languages**: Arabic (RTL default) · English (LTR)
- **Commit footer**: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

> Project rules auto-load from `.claude/rules/`:
> `cowork-bridge.md`, `github-workflow.md`, `patterns.md`.

---

## Pipeline — idea → production

`/feature <name> [product]` chains every stage. Each is also a standalone command.

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
| Quality | `/check` | TypeScript + build + visual green |
| Deploy | `/ship` | Vercel production Ready |
| Monitor | `/watch` | No errors, issue closed |

Product scope: append `hogwarts`, `souq`, `mkan`, `shifa` to activate domain context.

Pre-demo gate (deeper than `/check`, scoped to a feature block): **`/handover <block>`** — five-pass Playwright QA.

---

## Tools — standalone commands

Surface verbs available in any session. See `.claude/commands/<name>.md` (project) or `~/.claude/skills/<name>/SKILL.md` (user) for the spec.

**Lifecycle**: `dev`, `build`, `deploy`, `ship`, `watch`, `quick`, `fix`
**Quality**: `check`, `handover`, `report`
**Components**: `atom`, `block`, `template`
**Pipeline stages**: `idea`, `spec`, `schema`, `code`, `wire`, `feature`
**Ops**: `incident`, `monitor`, `costs`, `pricing`, `proposal`, `credentials`
**Org**: `captain`, `weekly`, `health`, `learn`, `analyze`, `profile`
**Utility**: `clone`, `package`, `screenshot`, `issue`, `crawl-anthropic`

---

## Vocabulary — keywords routed to agents

Claude routes these to the right agent + MCP without a dedicated command.

**UI**: `table`, `form`, `modal`, `card`, `sidebar`, `header`, `footer`, `hero`, `navbar`, `menu`
**Features**: `auth`, `dashboard`, `landing`, `checkout`, `settings`, `profile`, `admin`, `onboarding`
**Animation**: `motion`, `animation`, `transition`, `gesture`, `scroll`
**Quality dimensions** (17 niche keywords — see `.claude/agents/quality.md`):
  - Browser: `see`, `flow`, `debug`, `responsive`, `lang`, `fast`
  - Code: `guard`, `architecture`, `structure`, `pattern`, `design`, `stack`
  - Deep: `trace`, `performance`, `efficient`
  - Compare: `mirror`, `diff`
**Build**: `error`, `lint`, `format`, `type-check`, `deps`, `outdated`
**React perf**: `parallelize`, `bundle`, `lazy`, `suspense`, `memo`, `streaming`, `dedup`
**Services**: `github`, `figma`, `linear`, `slack`, `stripe`, `vercel`, `sentry`, `neon`, `analytics`
**Cross-repo**: `from codebase`, `from shadcn`, `like hogwarts`, `like souq`, `like mkan`, `like shifa`
**Operations**: `weekly`, `monitor`, `incident`, `credentials`
**Intelligence**: `learn`, `analyze`, `conventions`, `health`, `patterns`, `drift`

---

## Behavior

When you see a keyword:
1. **Pipeline stage** → run the corresponding stage command
2. **Tool verb** → invoke the command/skill
3. **Vocabulary keyword** → activate the right agent + MCP
4. **`from <repo>` / `like <product>`** → reference patterns from the named source

Bug fixes → `/report`. New features → `/feature <name>`. Components → `/atom`, `/block`, `/template`.
Pre-demo quality pass → `/handover <block>`.

## Lookups

- **Command detail**: `.claude/commands/<name>.md`
- **Agent detail**: `.claude/agents/<name>.md` (project) or `~/.claude/agents/<name>.md` (user)
- **Skill spec**: `.claude/skills/<name>/SKILL.md` or `~/.claude/skills/<name>/SKILL.md`
- **Pattern card**: `.claude/patterns/cards/<keyword>.md`
- **MCP servers**: `.claude/mcp.json` (project, 25 servers) + `~/.claude/mcp.json` (user, 19 servers)
