# Pattern Registry Lookup

When you encounter a Tier 3 vocabulary keyword that has a pattern card, load the card for context.

## Pattern Keywords

These keywords have canonical patterns documented in `.claude/patterns/cards/`:

`form`, `table`, `modal`, `auth`, `validation`, `action`, `columns`, `wizard`, `sidebar`, `header`, `e2e`

## Behavior

When building a new feature that involves one of these keywords:

1. Read `.claude/patterns/cards/{keyword}.md` for the canonical pattern
2. Read `.claude/patterns/registry.json` to check the current repo's adoption status
3. Follow the canonical pattern, adapting for the current product's stack
4. Use the canonical file structure and naming conventions
5. Reference the clone command if the pattern needs to be installed

## Examples

- User says "add a students table" → read `table.md`, follow the triplet pattern (content.tsx + table.tsx + columns.tsx)
- User says "create a form for invoices" → read `form.md`, use InputField/SelectField atoms with useActionStateBridge
- User says "add auth" → read `auth.md`, follow the five-step flow structure
- User says "multi-step wizard for onboarding" → read `wizard.md`, use createWizardProvider factory
- User says "add E2E tests" or "playwright" → read `e2e.md`, clone the setup-project auth config (storageState + desktop/mobile/Arabic-RTL projects)

## Rule Corpus — keyword → rule directory

The code-side quality keywords (see `.claude/agents/quality.md`) cite atomic, severity-tagged rules under `.claude/rules/<domain>/`. Each rule has frontmatter (`domain`, `severity`, `paths`, `since`) and Good/Bad/Fix sections. `paths` is Claude Code's native path-scoping field (quoted glob array), so each rule auto-loads only when Claude touches a matching file — the 3 cross-cutting rules at `.claude/rules/*.md` carry no `paths` and load unconditionally. When a keyword runs, read the matching domain dir(s) and cite findings as `rule-id (severity)`.

| Keyword               | Rule directories                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stack`               | all of `react-19/`, `react-perf/`, `next-16/`, `typescript-strict/`, `tailwind-v4/`, `prisma-6/`, `authjs/`, `neon/`, `s3/` (version/import/deprecation rules) |
| `pattern`             | `.claude/patterns/cards/` + `next-16/` + `react-19/`                                                                                                           |
| `design`              | `tailwind-v4/` (tokens, OKLCH, logical properties) + component-hierarchy cards                                                                                 |
| `guard`               | `authjs/` + `prisma-6/` (tenant scope) + `s3/` (presigned URLs)                                                                                                |
| `trace` / `efficient` | `react-perf/` (parallelization, bundle, RSC-boundary rules — impact-tagged)                                                                                    |

Domains (37 rules total): `react-19` (5), `react-perf` (8 — vendored from vercel-labs/agent-skills, 2026-07-10), `next-16` (5), `typescript-strict` (4), `tailwind-v4` (4), `prisma-6` (4), `authjs` (3), `neon` (2), `s3` (2).

Adding a rule: drop a new `<slug>.md` in the right domain dir with the standard frontmatter (`domain` / `severity` / `paths` glob array / `since`) + Good/Bad/Fix. No agent changes needed — the keyword reads the whole dir, and `paths` scopes the ambient auto-load.
