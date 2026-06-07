# Kun (كن) — The Kun Engine

> Configuration layer that transforms Anthropic's product suite into a unified company OS.
> **Core insight**: don't build what Anthropic ships — configure it.

## When Implementing

1. Check `docs/EPICS.md` for current stories
2. Reference `docs/ARCHITECTURE.md` for design decisions
3. Reference `docs/CONFIGURATION.md` for engine blueprint
4. Follow patterns from `/Users/abdout/codebase/`
5. Conventional commits — see `.claude/rules/github-workflow.md`
6. Work directly on `main` — no branches, no worktrees, no PRs (see `.claude/rules/github-workflow.md`)

## Documentation

Full project information lives in `docs/`:

| Doc                                                                | Purpose                                  |
| ------------------------------------------------------------------ | ---------------------------------------- |
| `PROJECT-BRIEF.md`                                                 | Vision, goals, Anthropic product mapping |
| `ARCHITECTURE.md`                                                  | 5-layer engine architecture              |
| `PRD.md` · `EPICS.md`                                              | Configuration requirements + stories     |
| `CONFIGURATION.md`                                                 | Full engine blueprint                    |
| `WORKFLOWS.md`                                                     | Technical + business operations          |
| `STACK.md` · `PRINCIPLES.md` · `CONSTITUTION.md` · `NORTH-STAR.md` | Decision framework                       |
| `CEO-OS.md` · `AGILE.md` · `KEYWORDS.md` · `PRODUCTS.md`           | Operating model                          |
| `SELF-HOSTING.md`                                                  | Tailscale/tmux/Docker setup              |

## Operating Configuration

Project-level instructions: `.claude/CLAUDE.md` (Tier 1 pipeline, Tier 2 sweeps, Tier 3 vocabulary).
User-level defaults: `~/.claude/CLAUDE.md` (Component Hierarchy, Reference Codebase, Keyword Vocabulary).
Pattern cards: `.claude/patterns/cards/`.

> Architecture principles — configure over build; architecture-first; guardrails as training data; full spectrum (technical + business); Anthropic-native.
