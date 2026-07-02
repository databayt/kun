# Kun — Project Configuration

> Project-level overrides for the kun engine. User defaults live in `~/.claude/CLAUDE.md`
> (Component Hierarchy, Reference Codebase, Imported Rules).

## The Drive

**Cash flow first. Break-even or bust.** This drive governs every decision and settles every argument — without it, we're gone, and so is the engine. When two options tie on the canon, the one closer to revenue wins. Metric: `docs/NORTH-STAR.md` (active paying schools); enforcement: the captain's argument protocol.

## Preferences

- **Model**: `claude-opus-4-8` (Opus 4.8, 1M context) — fallbacks per `engine.json`
- **Billing**: Claude Max $100/mo, subscription-only — no usage credits, no API-key spend (change requires `/decide` + Abdout approval); check `/usage` weekly
- **Package Manager**: pnpm
- **Stack**: Next.js 16 · React 19 · Prisma 6 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
- **Languages**: Arabic (RTL default) · English (LTR)
- **Commit footer**: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

> Project rules auto-load from `.claude/rules/`:
> `cowork-bridge.md`, `github-workflow.md`, `patterns.md`, `block-protocol.md`, `engine-parity.md`.

## Agents — the four lanes

- **`c` — Claude Code (primary).** Default for everything: features, architecture, multi-step work, anything risky. (`c` = `claude --dangerously-skip-permissions`.)
- **`a` — Antigravity (secondary).** Google's `agy` CLI (`a` = `agy --dangerously-skip-permissions`) — fallback when Claude Code is unavailable + cheap lane (Gemini Flash) for easy one-file tasks. Shares this config via `~/.gemini/` bridge. See `content/docs/antigravity.mdx`.
- **`o` — opencode (tertiary).** Open-source terminal agent; bypass is **config-level** (`~/.config/opencode/opencode.json` → `"permission": "allow"` — the `o`-lane equivalent of `--dangerously-skip-permissions`; no flag exists).
- **`claw` — OpenClaw (optional gateway).** Assistant gateway (WhatsApp/Telegram/Slack channels), NOT a coding CLI — reach the engine from chat apps; daemon onboarding is interactive (`openclaw onboard`).

## Pipeline — idea → production

```
IDEA → SPEC (human gate) → [PLAN → TASKS] → SCHEMA → CODE → WIRE → CHECK → SHIP → WATCH
```

`/feature <name> [product]` chains every stage; each is also a standalone skill with its own exit gate (see the skill's `SKILL.md`). Product scope resolves from `.claude/memory/repositories.json`. Deeper gates: **`/handover <url|block>`** (niche-keyword UI verification) · **`/qa <block>`** (autonomous detect→verify→fix→one signoff issue) · **`/release <block>`** (one spell: handover→check→ship→watch→close issue; main + clean tree).

## Vocabulary — keywords routed to skills, agents, MCP

<!-- BEGIN vocabulary (generated) -->
Claude routes these to the right skill + agent + MCP without a dedicated command. Registry: `.claude/vocabulary.json` (edit it, then `node .claude/scripts/generate-vocab.mjs`); browsable at kun.databayt.org/en/docs/keywords.

**The Pipeline** — idea to production in one word: `feature`, `idea`, `spec`, `schema`, `ready`, `code`, `wire`, `check`, `ship`, `watch`
**Charm Work** — everyday practical magic: `dev`, `build`, `push`, `quick`, `deploy`, `ship`, `check`, `release`
**Transfiguration** — creating something from nothing: `component`, `page`, `api`, `atom`, `template`, `block`, `feature`, `migration`
**Ancient Runes** — the foundational frameworks: `nextjs`, `react`, `typescript`, `prisma`, `tailwind`, `shadcn`
**Conjuration** — summoning ui elements: `table`, `header`, `menu`, `form`, `modal`, `card`, `sidebar`, `footer`, `hero`, `navbar`
**The Dark Arts of Features** — n.e.w.t.-level system enchantments: `auth`, `saas`, `dashboard`, `landing`, `checkout`, `settings`, `profile`, `admin`, `onboarding`
**Animation Charms** — giving life to stillness: `motion`, `animation`, `transition`, `gesture`, `scroll`
**Defense Against the Dark Arts** — protection from bugs and entropy: `test`, `e2e`, `handover`, `coverage`, `review`, `security`, `audit`, `analyze`, `constitution`, `accessibility`, `optimize`, `performance`
**Reparo** — the mending spells: `fix`, `error`, `scan`, `lint`, `format`, `type-check`, `report`
**Quill Charms** — the spells of documentation: `docs`, `readme`, `api-docs`, `storybook`, `changelog`
**Geminio** — duplication and summoning: `clone`, `copy`, `fork`, `extend`, `sync`, `upstream`
**Summoning Charms** — portals to external realms: `github`, `figma`, `linear`, `slack`, `notion`, `sentry`, `stripe`, `vercel`, `analytics`, `neon`
**Divination** — seeing ahead: `bmad`, `flow`, `plan`, `architect`, `implement`, `story`, `cycle`, `loop`
**Advanced Spellwork** — performance magic: `parallelize`, `waterfall`, `bundle`, `lazy`, `suspense`, `memo`, `server-component`, `streaming`, `barrel`, `dedup`
**Portkeys** — teleportation to other repos: `from codebase`, `from shadcn`, `from radix`, `like hogwarts`, `like souq`, `like mkan`, `like shifa`, `like sijillee`, `like moallimee`
**The Unforgivable Commands** — forbidden by the engine: `rm -rf *`, `prisma migrate reset`, `prisma db push --accept-data-loss`, `DROP TABLE`, `git push --force main`
**The Auror Office** — one keyword, one quality dimension: `see`, `flow`, `debug`, `responsive`, `lang`, `fast`, `guard`, `architecture`, `structure`, `pattern`, `design`, `stack`, `trace`, `efficient`, `mirror`, `diff`
**The Ministry of Magic** — operations and intelligence: `weekly`, `monitor`, `incident`, `credentials`, `health`, `learn`, `conventions`, `patterns`, `drift`
**The Pensieve** — judgment and conversion: `canon`, `convert`
<!-- END vocabulary (generated) -->

**Quality dimensions** route through `.claude/agents/quality.md`; `/handover` orchestrates all of them on a URL or block.
**Decisions/CEO** (passive — no slash): `canon` + any leadership/strategy decision (`hiring`, `pricing`, `positioning`, `strategy`, `prioritize`, `fundraise`, `runway`, `customer development`, "should we build…", "what do I do about…") → consult `docs/CANON.md`, surface the book + one operating move grounded in principle `#N`
**Blocks** (passive, per-repo): every feature block in a repo's `.claude/blocks.json` is a keyword → follow the **block protocol** rule (`.claude/rules/block-protocol.md`).

## Behavior

Abdout prompts in natural language — he won't type slash commands. Pick the keywords out of the prose and activate the right config automatically; passive activation is the engine's job, not his. Each skill's `when_to_use` frontmatter carries its triggers — trust it.

When you see a keyword:

1. **Pipeline stage or tool verb** → invoke the matching skill
2. **Vocabulary keyword** → activate the right agent + MCP
3. **`from <repo>` / `like <product>`** → reference patterns from the named source
4. **Business/leadership/strategy decision** (natural conversation, _no slash_) → consult `docs/CANON.md`; surface the relevant book + one operating move, grounded in principle `#N`. Don't wait for `/canon`. Keep it brief — one book, one move — and skip trivial or purely-technical choices.

Bug fixes → `/report`. New features → `/feature <name>`. Components → `/atom`, `/block`, `/template`.
Pre-demo quality pass → `/handover <block>`. Autonomous QA + human-signoff issue → `/qa <block>` (passive: saying **"qa admission"** in prose activates it). **Send to client (one spell) → `/release <block>`.**

## Lookups

- **Skill spec**: `.claude/skills/<name>/SKILL.md` (project) or `~/.claude/skills/<name>/SKILL.md` (user) — commands are retired, skills carry the verbs
- **Agent detail**: `.claude/agents/<name>.md` (project) or `~/.claude/agents/<name>.md` (user)
- **Keyword registry**: `.claude/vocabulary.json` → `node .claude/scripts/generate-vocab.mjs`
- **Pattern card**: `.claude/patterns/cards/<keyword>.md`
- **MCP servers**: `.claude/mcp.json` (project) + `~/.claude/mcp.json` (user)
- **Engine truth**: `.claude/engine.json` (model, counts, sync stamps) — `/health` flags drift
