# Kun — Project Configuration

> Project-level overrides for the kun engine. User defaults live in `~/.claude/CLAUDE.md`
> (Component Hierarchy, Reference Codebase, Keyword Vocabulary, Imported Rules).

## Preferences

- **Model**: `claude-opus-4-8` (Opus 4.8, 1M context) — fallbacks per `engine.json`
- **Billing**: Claude Max $100/mo, subscription-only — no usage credits, no API-key spend (change requires `/decide` + Abdout approval); check `/usage` weekly
- **Package Manager**: pnpm
- **Stack**: Next.js 16 · React 19 · Prisma 6 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
- **Languages**: Arabic (RTL default) · English (LTR)
- **Commit footer**: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

> Project rules auto-load from `.claude/rules/`:
> `cowork-bridge.md`, `github-workflow.md`, `patterns.md`.

## Agents — primary & secondary

- **`c` — Claude Code (primary).** The default agent for everything: features, architecture, multi-step work, anything risky. (`c` = `claude --dangerously-skip-permissions`.)
- **`a` — Antigravity (secondary).** Google's `agy` CLI, reached via `a` = `agy --dangerously-skip-permissions`. Use it as the **fallback** when Claude Code is unavailable, and as the **cheap lane** (Gemini Flash) for easy/one-file tasks. It shares this exact config — same MCP fleet (`~/.gemini/config/mcp_config.json`), skills (`~/.gemini/skills/`), and playbook (`~/.gemini/AGENTS.md` → this file). Defer anything beyond "easy" back to `c`. See `content/docs/antigravity.mdx`.

---

## Pipeline — idea → production

`/feature <name> [product]` chains every stage. Each is also a standalone command.

```
IDEA → SPEC → PLAN → TASKS → SCHEMA → CODE → WIRE → CHECK → SHIP → WATCH
```

| Stage   | Command   | Exit gate                           |
| ------- | --------- | ----------------------------------- |
| Capture | `/idea`   | GitHub issue exists                 |
| Specify | `/spec`   | Spec approved on issue (human gate) |
| Plan    | `/plan`   | Architecture plan on issue (opt.)   |
| Tasks   | `/tasks`  | Ordered breakdown on issue (opt.)   |
| Data    | `/schema` | Migration applied, types compile    |
| Logic   | `/code`   | `tsc --noEmit` passes               |
| UI      | `/wire`   | `pnpm build` passes                 |
| Quality | `/check`  | TypeScript + build + visual green   |
| Deploy  | `/ship`   | Vercel production Ready             |
| Monitor | `/watch`  | No errors, issue closed             |

`/plan` + `/tasks` are optional rigor for non-trivial features (spec-kit-style: spec = _what_, plan = _how_, tasks = _ordered work_); trivial changes skip them. They sit after the single human approval gate at `/spec`.

Product scope: append `hogwarts`, `souq`, `mkan`, `shifa` to activate domain context.

UI verification gate (deeper than `/check`): **`/handover <url|block>`** — polymorphic on argument. URL mode runs the 12 per-URL niche keywords; block mode runs the per-route subset on every route in the block.

One-spell client handoff: **`/release <block>`** — chains `/handover` → `/check` → `/ship` → `/watch`, auto-comments the production URL on the related GitHub issue, and closes it. Requires main branch + clean tree.

---

## Tools — standalone commands

Surface verbs available in any session. See `.claude/commands/<name>.md` (project) or `~/.claude/skills/<name>/SKILL.md` (user) for the spec.

**Lifecycle**: `dev`, `build`, `deploy`, `ship`, `watch`, `quick`, `fix`
**Quality**: `check`, `handover`, `release`, `report`
**Components**: `atom`, `block`, `template`
**Pipeline stages**: `idea`, `spec`, `plan`, `tasks`, `schema`, `code`, `wire`, `feature`
**Ops**: `incident`, `monitor`, `costs`, `pricing`, `proposal`, `credentials`
**Org**: `captain`, `weekly`, `health`, `learn`, `analyze`, `profile`, `sync-anthropic`
**Utility**: `clone`, `convert`, `package`, `screenshot`, `issue`, `crawl-anthropic`

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
  **Services**: `github`, `figma`, `linear`, `slack`, `stripe`, `vercel`, `sentry`, `neon`, `analytics`, `markitdown` (aliases `convert`/`markdown` → file or URL to Markdown)
  **Cross-repo**: `from codebase`, `from shadcn`, `like hogwarts`, `like souq`, `like mkan`, `like shifa`
  **Operations**: `weekly`, `monitor`, `incident`, `credentials`
  **Intelligence**: `learn`, `analyze`, `conventions`, `health`, `patterns`, `drift`, `sync` (→ `/sync-anthropic`)
  **Decisions/CEO** (passive — no slash): `canon` + any leadership/strategy decision (`hiring`, `pricing`, `positioning`, `strategy`, `prioritize`, `fundraise`, `runway`, `customer development`, "should we build…", "what do I do about…") → consult `docs/CANON.md`, surface the book + one operating move grounded in principle `#N`

---

## Behavior

When you see a keyword:

1. **Pipeline stage** → run the corresponding stage command
2. **Tool verb** → invoke the command/skill
3. **Vocabulary keyword** → activate the right agent + MCP
4. **`from <repo>` / `like <product>`** → reference patterns from the named source
5. **Business/leadership/strategy decision** (natural conversation, _no slash_) → consult `docs/CANON.md`; surface the relevant book + one operating move, grounded in principle `#N`. Don't wait for `/canon`. Keep it brief — one book, one move — and skip trivial or purely-technical choices.

Bug fixes → `/report`. New features → `/feature <name>`. Components → `/atom`, `/block`, `/template`.
Pre-demo quality pass → `/handover <block>`. **Send to client (one spell) → `/release <block>`.**
Facing a CEO/business/strategy decision → surface the relevant **canon** move passively (no slash; see `docs/CANON.md`).

## Lookups

- **Command detail**: `.claude/commands/<name>.md`
- **Agent detail**: `.claude/agents/<name>.md` (project) or `~/.claude/agents/<name>.md` (user)
- **Skill spec**: `.claude/skills/<name>/SKILL.md` or `~/.claude/skills/<name>/SKILL.md`
- **Pattern card**: `.claude/patterns/cards/<keyword>.md`
- **MCP servers**: `.claude/mcp.json` (project, 26 servers) + `~/.claude/mcp.json` (user, 20 servers)

---

## Command vs Skill — which is which

- **Command** (`.claude/commands/<name>.md`) — a verb a human types, with `$ARGUMENTS`, a pipeline position, and an exit gate. Invoked explicitly (`/feature`, `/release`, `/spec`). Now carry frontmatter (`description`, `argument-hint`, optional `model`) for `/help` discoverability and model auto-invocation.
- **Skill** (`~/.claude/skills/<name>/SKILL.md`) — a capability the model _pulls in_ when relevant (progressive disclosure, reusable across repos, keyword-triggered). E.g. `build`, `security`, `motion`.
- **Heuristic**: has `$ARGUMENTS` + an exit gate → command; "teach the model to do X well, surfaced automatically" → skill.
- `allowed-tools` is intentionally omitted from commands for now — they inherit the full toolset; add per-command later if least-privilege hardening is wanted.
