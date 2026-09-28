# Pattern Registry Lookup

Keywords with a canonical card at `.claude/patterns/cards/<keyword>.md`: `form` · `table` ·
`modal` · `auth` · `validation` · `action` · `columns` · `wizard` · `sidebar` · `header` ·
`e2e` · `pwa` · `skeleton` · `blur`.

When building something that involves one: read the card → check
`.claude/patterns/registry.json` for this repo's adoption status → follow the canonical
pattern, file structure and naming, adapted to the product's stack → use the card's clone
command if the pattern must be installed. What the cards prescribe:

- **table** — the triplet: `content.tsx` + `table.tsx` + `columns.tsx`
- **form** — `InputField` / `SelectField` atoms with `useActionStateBridge`
- **auth** — the five-step flow structure · **wizard** — the `createWizardProvider` factory
- **e2e** ("playwright") — clone the setup-project auth config: storageState + desktop / mobile / Arabic-RTL projects
- **pwa** ("installable", "work offline", "push notifications") — per-tenant manifest + hand-rolled worker + outbox; Serwist only for small greenfield apps
- **skeleton** ("loading state", "the page flashes blank") — the hogwarts kit (`atom/loading.tsx` + `animate-shimmer`) mirroring the page layout; never above a `notFound()` guard
- **blur** ("images pop in") — render photos through `BlurImage` (blur-xl → sharp on load) over a stored LQIP

## Rule corpus

The code-quality keywords (`.claude/agents/quality.md`) cite atomic rules in
`.claude/rules/<domain>/`. Each rule has frontmatter `domain` / `severity` / `paths` (a quoted
glob array — Claude Code's native path-scoping, so a rule auto-loads only when a matching file
is touched) / `since`, then Good / Bad / Fix. When a keyword runs, read its domain dirs and
cite findings as `rule-id (severity)`:

`stack` → every domain dir (version / import / deprecation rules) · `pattern` → the cards +
`next-16/` + `react-19/` · `design` → `tailwind-v4/` + `loading/` + the hierarchy cards ·
`guard` → `authjs/` + `prisma-6/` (tenant scope) + `s3/` (presigned URLs) + `cloudflare/`
(secrets, per-request isolation) · `trace` / `efficient` → `react-perf/` (impact-tagged) ·
`motion` / `animation` / `scroll` → `gsap/`.

Adding a rule: drop `<slug>.md` with that frontmatter into the right domain dir — the keyword
reads the whole dir, so no agent change is needed.
