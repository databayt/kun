
# The Standard Book of Spells

> *"It does not do to dwell on documentation and forget to ship."*
> — Albus Dumbledore, probably

Every witch and wizard knows that magic begins with a word. Not a paragraph. Not a committee. A single, well-chosen word spoken with intent — and the universe rearranges itself.

**Kun** (كن) is Arabic for "Be" — the divine command of creation. Say the word, and it is. This is not metaphor. Type `dev` and your server rises. Type `deploy` and your code travels across the world. Type `auth` and an entire authentication system assembles itself from nothing.

This spellbook contains **114 incantations** across 15 schools of magic. Each has been tested, refined, and proven in production. Some are gentle charms for daily work. Others are powerful enchantments that orchestrate dozens of agents and services. A few are dangerous enough to warrant warnings.

Learn them well. A wizard who knows the right word at the right moment is worth a hundred who know only how to type.

---

## How Spells Work

When you speak an incantation into the terminal, the Kun engine performs three acts of magic in sequence:

1. **Recognition** — The word activates the corresponding agent or chain of agents (your magical familiars)
2. **Channeling** — Relevant MCP servers open portals to external realms (GitHub, Vercel, Neon, Stripe)
3. **Manifestation** — The spell takes effect: files materialize, servers ignite, code transforms

Some spells are simple — one word, one effect. Others are compound — combine them with a target and the magic adapts. `test` runs your test suite. `test login` targets the login flow specifically. `saas billing` conjures an entire billing system with schema, API, UI, and Stripe integration.

The incantation must be spoken clearly. No wand-waving required.

### Reading the Order

Every spell in this book reveals its **Order** — the hidden chain of familiars, portals, enchantments, and wards that activate behind the scenes. Like the Order of the Phoenix working invisibly to protect the wizarding world, these forces mobilize the instant you speak.

| Symbol | Meaning |
|--------|---------|
| **Familiar** | Agent summoned to do the work |
| **Portal** | MCP server opened to an external realm |
| **Skill** | Slash command executed (`/dev`, `/build`, `/deploy`...) |
| **Hook** | Silent enchantment that fires automatically |
| **Ward** | Rule that activates based on files touched |
| **Step** | The sequence of what happens, in order |

---

## I. Charm Work

*Everyday practical magic. The spells you will cast most often — reliable, essential, and dangerously easy to take for granted. Professor Flitwick would be proud.*

These are the spells that keep your workshop running. Cast them a hundred times a day and they never dull.

### `dev`

Extinguishes whatever haunts port 3000, summons the development server, and opens Chrome to witness your creation.

> **The Order:**
> **Skill:** `/dev` | **Hooks:** Port Guardian + Chrome Opener
>
> 1. Hook kills port 3000 (`lsof -ti:3000 | xargs kill -9`)
> 2. Chrome opens to `localhost:3000`
> 3. `pnpm dev` starts Turbopack
> 4. Hook confirms Chrome is watching

*This is your Lumos — the first spell you cast each morning.*

### `build`

Compiles your entire project, scans for TypeScript heresies, and auto-repairs what it finds.

> **The Order:**
> **Familiar:** `build` | **Backup:** `typescript`, `nextjs` | **Skill:** `/build` | **Hook:** Auto-Format | **Ward:** `deployment`
>
> 1. `pnpm tsc --noEmit` — type check
> 2. If errors: analyze, auto-fix, re-check (up to 5 attempts)
> 3. `pnpm prisma generate` — regenerate client
> 4. `pnpm lint` — ESLint pass
> 5. `pnpm build` — production build
> 6. Post-build analysis: bundle size, warnings

### `push`

Stages all worthy changes, composes a conventional commit message, and dispatches your code to the remote repository.

> **The Order:**
> **Familiar:** `git` → `github` | **Portal:** GitHub MCP | **Hook:** Auto-Format
>
> 1. `git status` — survey the changes
> 2. `git add` — stage worthy files
> 3. `git commit -m "type(scope): message"` — conventional format
> 4. `git push` — dispatch to remote
> 5. GitHub MCP for PR creation if needed

### `quick`

The impatient wizard's push — commits and pushes without the ceremony of build validation.

> **The Order:**
> **Familiar:** `git` → `github` | **Portal:** GitHub MCP | **Skill:** `/quick`
>
> 1. Quick lint check
> 2. Auto-fix trivial issues
> 3. `git add .` — stage everything
> 4. `git commit` — skip build validation
> 5. `git push` — send it

### `deploy`

Sends your work through the Vercel portal to staging, retrying up to five times if the portal resists.

> **The Order:**
> **Familiar:** `deploy` → `build` → `github` | **Portal:** Vercel MCP + Neon MCP | **Skill:** `/deploy` | **Ward:** `deployment`
>
> 1. Check for uncommitted changes
> 2. `pnpm tsc --noEmit` — local type check
> 3. `pnpm build` — verify locally
> 4. Fix errors if any (loop up to 5 times)
> 5. `npx vercel --yes` — deploy to preview
> 6. Poll deployment status every 30 seconds
> 7. If Error: fetch logs → diagnose → fix → commit → push → redeploy
> 8. If Ready: report URL and aliases

### `ship`

The full-power deployment — straight to production, no staging, no safety net.

> **The Order:**
> Same as `deploy` but step 5 becomes `npx vercel --prod --yes` — production, no preview.

### `validate`

Runs every quality check in the arsenal — lint, types, tests, security — and reports what survived.

> **The Order:**
> **Familiar:** `build` + `test` + `typescript` | **Ward:** `testing`
>
> 1. `pnpm tsc --noEmit` — type check
> 2. `pnpm lint` — ESLint
> 3. `pnpm test` — run tests
> 4. Report pass/fail for all quality gates

> *Charm Tip: `dev` is your Lumos — the first spell you cast each morning. `validate` is your Nox — the last spell before you rest.*

---

## II. Transfiguration

*The art of creating something from nothing, or transforming one thing into another. These spells conjure new files, components, and entire features into existence.*

### `component`

Conjures a new React component with proper structure and typing.

> **The Order:**
> **Familiar:** `react` + `shadcn` | **Backup:** `tailwind`, `typescript` | **Portal:** shadcn MCP | **Hook:** Auto-Format | **Ward:** `tailwind`
>
> Creates a Server Component by default, adds `"use client"` only if hooks are needed. Follows project file structure conventions.

### `page`

Creates a new Next.js page within the App Router.

> **The Order:**
> **Familiar:** `nextjs` | **Backup:** `architecture`, `structure` | **Hook:** Auto-Format
>
> 1. Create `app/[lang]/.../<name>/page.tsx` — the route
> 2. Create `app/[lang]/.../<name>/loading.tsx` — loading state
> 3. Create `components/platform/<name>/content.tsx` — mirror pattern
> 4. Create `components/platform/<name>/actions.ts` — server actions

### `api`

Materializes a Server Action — the bridge between client desire and server truth.

> **The Order:**
> **Familiar:** `nextjs` | **Backup:** `typescript`, `architecture` | **Hook:** Auto-Format | **Ward:** `auth` + `prisma` (if touching auth or DB)
>
> Creates Server Action with `"use server"` directive, auth check, Zod validation, Prisma query with schoolId, `revalidatePath`.

### `atom`

Fuses two or more shadcn/ui primitives into a reusable atomic component.

> **The Order:**
> **Familiar:** `atom` | **Backup:** `shadcn`, `template`, `react` | **Portal:** shadcn MCP | **Skill:** `/atom` | **Hook:** Auto-Format | **Ward:** `tailwind` | **Memory:** `atom.json`
>
> 1. Check if atom exists in `src/components/atom/`
> 2. Identify required shadcn/ui primitives (minimum 2)
> 3. Create `src/components/atom/{name}.tsx`
> 4. Apply design rules: single purpose, typed, className prop, semantic tokens, RTL
> 5. Register in `src/registry/atoms-index.ts`
> 6. Generate MDX docs at `content/atoms/(root)/{name}.mdx`

### `template`

Assembles a complete page layout — header, content, sidebar, footer — from established patterns.

> **The Order:**
> **Familiar:** `template` | **Backup:** `atom`, `block`, `tailwind` | **Portal:** shadcn MCP | **Skill:** `/template` | **Hook:** Auto-Format | **Ward:** `tailwind` | **Memory:** `template.json`
>
> 1. Check if template exists in `src/registry/default/templates/{name}/`
> 2. Identify category (hero, header, sidebar, footer, login, dashboard)
> 3. Create `src/registry/default/templates/{name}/page.tsx`
> 4. Follow naming convention `{type}-{number}` (e.g. `hero-01`)
> 5. Register in `src/registry/registry-templates.ts`
> 6. `pnpm build:templates` — rebuild registry

### `block`

The most ambitious conjuration: a full UI component with integrated business logic, data fetching, and state.

> **The Order:**
> **Familiar:** `block` | **Backup:** `atom`, `template`, `react`, `shadcn`, `prisma` | **Portal:** shadcn MCP + GitHub MCP + Neon MCP | **Skill:** `/block` | **Hook:** Auto-Format | **Ward:** `prisma` + `auth` + `tailwind` | **Memory:** `block.json`
>
> 1. Identify source type (github:, shadcn:, internal:, path)
> 2. Fetch and analyze source
> 3. Transform imports to project paths
> 4. Adapt stack: Auth (to Auth.js), DB (to Prisma), Colors (to OKLCH), Spacing (to RTL)
> 5. Create mirror-pattern structure: page + components
> 6. Add i18n support (Arabic + English)
> 7. Register in `block.json`
> 8. `pnpm tsc --noEmit` — validate
> 9. Run quality audit (100-point score)

### `feature`

Plans and creates an entire feature end-to-end — the wizard's equivalent of building a room in Hogwarts.

> **The Order:**
> **Familiar:** `orchestration` → `architecture` → `nextjs` → `react` → `prisma` → `typescript` → `test` → `build` | **Portal:** as needed per sub-task | **Hook:** Auto-Format | **Ward:** all relevant wards based on files touched
>
> Full orchestration: Schema Design → Migration → Server Actions → Components → Styling → Testing → Build Validation.

### `migration`

Sculpts a new Prisma migration — reshaping your database without losing a single record.

> **The Order:**
> **Familiar:** `prisma` | **Backup:** `architecture` | **Portal:** Neon MCP | **Hook:** Auto-Format | **Ward:** `prisma`
>
> 1. Modify `prisma/models/*.prisma` schema
> 2. `pnpm prisma migrate dev --name <description>`
> 3. `pnpm prisma generate` — regenerate client
> 4. Verify with Neon MCP if remote database

> *Transfiguration Warning: A poorly conceived `block` is like a half-transfigured hedgehog — functional but unsettling. Plan before you cast.*

---

## III. Ancient Runes

*The foundational magic that underpins all modern spellwork. These incantations invoke the deep frameworks — the ancient languages upon which everything else is built.*

### `nextjs`

Applies Next.js 16 patterns — App Router, Server Components, the latest sacred texts.

> **The Order:**
> **Familiar:** `nextjs` | **Backup:** `react`, `typescript`, `middleware`, `architecture` | **Skill:** `/nextjs`
>
> Applies: async params/searchParams, Server Components by default, Server Actions with `"use server"`, streaming with Suspense, caching strategies.

### `react`

Channels React 19 — hooks, concurrent features, the bleeding edge.

> **The Order:**
> **Familiar:** `react` | **Backup:** `nextjs`, `typescript`, `shadcn`
>
> Applies: `useActionState`, `useOptimistic`, `use()` hook, proper memoization, React Hook Form + Zod.

### `typescript`

Enforces TypeScript strict mode with the zeal of a Ministry inspector.

> **The Order:**
> **Familiar:** `typescript` | **Backup:** `react`, `nextjs`, `architecture`
>
> Applies: no `any`, Zod schemas at boundaries, discriminated unions, type guards, Prisma type integration.

### `prisma`

Invokes the database oracle — queries, relations, the full power of Prisma 6.

> **The Order:**
> **Familiar:** `prisma` | **Backup:** `architecture` | **Portal:** Neon MCP | **Ward:** `prisma`
>
> Applies: multi-tenant schoolId on all queries, relations, indexes, CRUD operations, `$extends`, regenerate client after changes.

### `tailwind`

Activates Tailwind CSS 4 — semantic tokens, responsive incantations, RTL/LTR awareness.

> **The Order:**
> **Familiar:** `tailwind` | **Backup:** `shadcn`, `semantic`, `react` | **Ward:** `tailwind`
>
> Applies: OKLCH colors, CSS-first config (no JS config), mobile-first responsive, RTL logical properties (`ms`/`me`/`ps`/`pe`), container queries. No physical `ml`/`mr`/`pl`/`pr`.

### `shadcn`

Summons components from the shadcn/ui registry — Radix primitives refined and ready.

> **The Order:**
> **Familiar:** `shadcn` | **Backup:** `atom`, `template`, `block`, `tailwind` | **Portal:** shadcn MCP
>
> Uses MCP to search/install: `search_items`, `view_items`, `get_add_command`, `list_items`, `get_examples`. Installs to `src/components/ui/`.

> *These are not spells you cast lightly. Each carries the weight of an entire framework. When you say `prisma`, you invoke not just a tool but a philosophy of data.*

---

## IV. Conjuration

*The art of summoning UI elements into existence. Each incantation calls forth a specific pattern — complete, styled, and ready for use.*

All conjuration spells share a common Order foundation, then diverge by pattern:

> **Shared Order:**
> **Portal:** shadcn MCP | **Hook:** Auto-Format | **Ward:** `tailwind` + `i18n`

### `table`

Summons a DataTable with sorting, filtering, pagination — the enchanted parchment that organizes all things.

> **Familiar:** `block` + `prisma` | Uses `@tanstack/react-table`. Generates column definitions, server-side filtering, row actions.

### `header`

Conjures a page header with navigation — the grand entrance to any view.

> **Familiar:** `template` | Pattern: `header-01`, `header-02`. Sticky top, responsive, mobile hamburger.

### `menu`

Creates a navigation menu or sidebar — the shifting staircases of your application.

> **Familiar:** `template` | Pattern: `sidebar-01`. Collapsible, icon + label, active state tracking.

### `form`

Materializes a form with validation — every field guarded, every input verified.

> **Familiar:** `react` + `block` | Uses React Hook Form + Zod + shadcn Form component. Server Action on submit.

### `modal`

Opens a dialog — a Room of Requirement that appears exactly when needed.

> **Familiar:** `shadcn` + `atom` | Uses Radix Dialog. ConfirmDialog atom pattern for destructive actions.

### `card`

Produces card variations — the chocolate frog cards of your UI.

> **Familiar:** `atom` | Composes Card + Badge + Avatar + Button. Semantic tokens for consistent theming.

### `sidebar`

Constructs a sidebar navigation — the secret passages between sections.

> **Familiar:** `template` | Pattern: `sidebar-01`. SidebarProvider, collapsible, keyboard shortcut toggle.

### `footer`

Anchors a footer component — the foundation upon which every page rests.

> **Familiar:** `template` | Pattern: `footer-01`. Multi-column, responsive, social links.

### `hero`

Raises a hero section — the grand hall entrance, the first thing any visitor sees.

> **Familiar:** `template` | Pattern: `hero-01`. Centered/split/gradient. CTA buttons, responsive typography.

### `navbar`

Erects a top navigation bar — the enchanted ceiling that follows you everywhere.

> **Familiar:** `template` | Uses NavigationMenu from Radix. Dropdown menus, mobile sheet, auth state.

> *Conjuration Mastery: Combine with a noun — `table users`, `form settings`, `modal confirm` — and the spell adapts to your intent.*

---

## V. The Dark Arts of Features

*Not dark in nature, but dark in complexity. These are N.E.W.T.-level enchantments that weave together multiple agents, MCP servers, and spell chains. Each one creates an entire system.*

### `auth`

Summons a complete authentication system — NextAuth v5, JWT, OAuth, sessions, middleware, protected routes.

> **The Order:**
> **Familiar:** `authjs` | **Backup:** `middleware`, `prisma`, `nextjs` | **Ward:** `auth`
>
> 1. Configure `auth.ts` — NextAuth v5 with PrismaAdapter
> 2. Set up OAuth providers + Credentials
> 3. JWT/session callbacks with id, role, schoolId
> 4. Route handler at `app/api/auth/[...nextauth]/route.ts`
> 5. Middleware for route protection
> 6. SessionProvider in root layout
> 7. Type extensions in `types/next-auth.d.ts`

### `saas`

The most powerful compound spell: database schema + server actions + UI components + billing integration.

> **The Order:**
> **Familiar:** `orchestration` → `architecture` → `prisma` → `nextjs` → `shadcn` → `react` | **Portal:** Stripe MCP + Neon MCP + shadcn MCP | **Skill:** `/saas` | **Ward:** `prisma` + `auth`
>
> 1. Database schema — Prisma model in `prisma/models/`
> 2. Relations to existing models + migration
> 3. Server actions with CRUD + Zod validation
> 4. UI components — DataTable, Forms, Detail views
> 5. Pages — App Router at `app/[lang]/(root)/{name}/page.tsx`
> 6. Integrations — Stripe for billing, auth checks, analytics

### `dashboard`

Conjures a dashboard layout with charts, metrics, and data visualization.

> **The Order:**
> **Familiar:** `template` + `block` | **Backup:** `react`, `prisma` | **Portal:** shadcn MCP
>
> Sidebar layout + stat cards (atom) + charts (lazy loaded) + data tables (block) + `Promise.all` for parallel data fetching.

### `landing`

Creates a landing page — hero, features, pricing, testimonials, footer.

> **The Order:**
> **Familiar:** `template` | **Backup:** `atom`, `tailwind` | **Portal:** shadcn MCP
>
> Composes multiple template sections into a single page. Each section is a separate Server Component.

### `checkout`

Constructs a payment checkout flow — cart, Stripe integration, confirmation.

> **The Order:**
> **Familiar:** `block` | **Backup:** `architecture`, `prisma` | **Portal:** Stripe MCP | **Ward:** `auth` + `prisma`
>
> Stripe integration, order model, checkout form, payment processing, webhook handler at `app/api/webhooks/stripe/route.ts`.

### `settings` / `profile` / `admin` / `onboarding`

Each creates its respective system — forms, tabs, role-based access, user data.

> **The Order:**
> **Familiar:** `nextjs` + `template` | **Backup:** `react`, `authjs`, `prisma` | **Ward:** `auth`
>
> Mirror-pattern page creation with forms, server actions, auth checks. `admin` adds role guard (`role === "ADMIN"`).

> *Proceed with Care: `saas billing` is the Patronus Charm of this spellbook — immensely powerful, but requiring clear intent and genuine need.*

---

## VI. Animation Charms

*The spells that give life to stillness. In the Muggle world, they call it "motion design." We know better — it is the ancient art of making the inanimate move with purpose.*

All animation charms share:

> **Shared Order:**
> **Backup:** `react`, `tailwind` | **Skill:** `/motion` | **Hook:** Auto-Format

### `motion`

Breathes Framer Motion into your components — the Piertotum Locomotor of the frontend.

> `motion.div` with `initial` / `animate` / `exit` / `transition` props. Variants for orchestrated sequences.

### `animation`

Applies CSS or Framer animations — subtle enchantments that guide the eye.

> CSS `@keyframes` for simple effects, Framer Motion for complex choreography.

### `transition`

Creates page transitions — the smooth apparition between views.

> `AnimatePresence` wrapping route changes. `exit` animations before new page mounts.

### `gesture`

Adds touch and drag interactions — the magic of physical response.

> `whileHover`, `whileTap`, `drag` with `dragConstraints`. Spring physics for natural feel.

### `scroll`

Triggers animations on scroll — spells that activate as the viewer journeys downward.

> `whileInView` with `viewport({ once: true })`. Intersection Observer under the hood.

> *Animation Warning: Like the Weasley twins' fireworks, animation is magnificent in moderation and catastrophic in excess.*

---

## VII. Defense Against the Dark Arts

*The spells that protect your code from the dark forces: bugs, vulnerabilities, regressions, and the slow entropy of neglect.*

### `test`

Generates tests — Vitest for units, Playwright for journeys. Your Protego against regressions.

> **The Order:**
> **Familiar:** `test` | **Backup:** `react`, `nextjs`, `build` | **Portal:** Browser MCP | **Skill:** `/test` | **Ward:** `testing`
>
> Vitest for unit/component tests. Playwright for E2E across chromium/firefox/webkit/mobile. Target: 95%+ coverage. Test accounts use password `1234`.

### `e2e`

Casts end-to-end tests — the full Patronus, testing every path a user might walk.

> **The Order:**
> **Familiar:** `test` | **Portal:** Browser MCP (headless + headed) | **Ward:** `testing`
>
> Playwright across all browsers. Uses `browser-headed` MCP for auth flows that need visible Chromium.

### `coverage`

Reveals your test coverage — like the Marauder's Map, showing you exactly what's unguarded.

> **The Order:**
> **Familiar:** `test` | **Ward:** `testing`
>
> `pnpm test --coverage` with V8 provider. Reports lines, branches, functions, statements.

### `review`

Initiates a code review — a Pensieve session examining your decisions.

> **The Order:**
> **Familiar:** `pattern` | **Backup:** `architecture`, `typescript`, `react`
>
> Checks: server/client boundaries, sequential data fetching, form validation, multi-tenant schoolId, semantic tokens, memoization.

### `security`

Performs an OWASP Top 10 security audit — the dark mark detector.

> **The Order:**
> **Familiar:** `guardian` | **Backup:** `authjs`, `pattern` | **Portal:** Sentry MCP | **Skill:** `/security` | **Ward:** `auth`
>
> OWASP Top 10 scan, code analysis (input validation, output encoding, auth flows, secrets), `pnpm audit` for dependencies, environment check.

### `audit`

Runs every quality check — the full Auror inspection.

> **The Order:**
> **Familiar:** `guardian` | **Backup:** `pattern`, `performance`, `test`, `security`
>
> Combines security + performance + code quality + accessibility + testing into one comprehensive sweep.

### `accessibility`

Checks WCAG compliance — ensuring your magic serves everyone, not just the able.

> **The Order:**
> **Familiar:** `semantic` | **Backup:** `tailwind`, `shadcn`, `react`
>
> WCAG 2.1 AA compliance: semantic HTML, ARIA labels, keyboard navigation, color contrast, focus management. Radix handles most ARIA automatically.

### `optimize` / `performance`

Measures Core Web Vitals — the precise diagnostic, like Madam Pomfrey taking vitals.

> **The Order:**
> **Familiar:** `performance` | **Backup:** `nextjs`, `react`, `prisma`, `build`, `tailwind` | **Portal:** Vercel MCP + Neon MCP | **Skill:** `/performance`
>
> 1. Core Web Vitals (LCP <2.5s, INP <200ms, CLS <0.1)
> 2. Bundle analysis (`ANALYZE=true pnpm build`)
> 3. Database query optimization (N+1 detection, JOIN strategy, indexes)
> 4. React rendering profiling
> 5. Memory leak detection
> 6. Report with 7 quality gates

> *"Constant vigilance!" — These spells are your shield. A codebase without tests is a castle without wards.*

---

## VIII. Reparo

*The mending spells. When things break — and they will — these incantations diagnose and repair with surgical precision.*

### `fix`

Auto-repairs all lint errors, type errors, and build failures — the Reparo of the digital world.

> **The Order:**
> **Familiar:** `build` | **Backup:** `typescript`, `nextjs` | **Skill:** `/fix` | **Hook:** Auto-Format
>
> TypeScript check → auto-fix type errors → lint fix → build verify. Every fixed file is auto-formatted by the Prettier hook.

### `error`

Scans for errors and fixes them — seeks out the broken and makes it whole.

> **The Order:**
> **Familiar:** `build` + `sse` | **Backup:** `typescript`, `nextjs` | **Portal:** Sentry MCP
>
> 204+ error patterns recognized. Scans: dictionary access, Prisma field types, missing schoolId, hooks in server components. 95% auto-fix rate.

### `scan`

Sweeps the entire codebase for issues — a Homenum Revelio for bugs.

> **The Order:**
> **Familiar:** `build` + `sse` | **Backup:** `typescript`
>
> Full codebase sweep for anti-patterns, type errors, unused imports, dead code.

### `lint`

Runs ESLint — enforcing the laws of clean code.

> **The Order:**
> **Familiar:** `build`
>
> `pnpm lint` → report issues with file paths and line numbers.

### `format`

Runs Prettier — because even correct code deserves to look dignified.

> **The Order:**
> **Hook:** Auto-Format (already fires on every file edit)
>
> `npx prettier --write` on target files. The Auto-Format hook means this is usually already done.

### `type-check`

Runs TypeScript strict checking — the Veritaserum of type safety.

> **The Order:**
> **Familiar:** `typescript`
>
> `pnpm tsc --noEmit` → report errors with file locations. No JavaScript emitted, pure validation.

> *A true master does not fear errors. They cast `fix` and move on.*

---

## IX. Quill Charms

*The spells of documentation — often neglected, always essential. Like Madam Pince guarding the library, these incantations ensure knowledge is preserved and accessible.*

All quill charms share:

> **Shared Order:**
> **Familiar:** `comment` | **Backup:** `pattern`, `typescript` | **Skill:** `/docs` | **Hook:** Auto-Format

### `docs`

Generates MDX documentation — comprehensive, structured, ready for publication.

> Installation, Usage, Props table, Examples, API reference. MDX format for Fumadocs.

### `readme`

Creates or updates the README — the introduction every repository deserves.

> Project description, installation, quick start, configuration, contributing guide.

### `api-docs`

Produces API documentation — every endpoint, every parameter, every response.

> Endpoint descriptions, request/response schemas, auth requirements, error codes.

### `storybook`

Creates component stories — the illustrated guide to your UI.

> `*.stories.tsx` files with default, variant, and interactive stories. Args table.

### `changelog`

Updates the changelog — the historical record of everything that changed and why.

> Parses conventional commit history. Groups by type (feat, fix, refactor).

> *The Quill Charms are the Memory Charms done right. Instead of erasing knowledge, they preserve it.*

---

## X. Geminio

*The duplication and summoning spells. Why build from scratch when excellent work already exists?*

### `clone`

Duplicates a component from the codebase or any GitHub repository.

> **The Order:**
> **Familiar:** `github` or `shadcn` (depends on source) | **Backup:** `architecture`, `block` | **Portal:** GitHub MCP + shadcn MCP | **Skill:** `/clone` | **Hook:** Auto-Format | **Ward:** `org-refs`
>
> 1. Fetch source code (GitHub API, shadcn registry, or local `/Users/abdout/codebase`)
> 2. Analyze dependencies
> 3. Adapt imports to local structure (`@/components/ui/`)
> 4. Apply project conventions (OKLCH, RTL, Auth.js, Prisma)
> 5. Update registry if component

### `copy`

Creates a copy of an existing component — identical but independent.

> **The Order:** Same as `clone` but source is always local.

### `fork`

Creates a variant — the original's twin, free to diverge.

> **The Order:** Same as `clone` with a rename step. Original untouched.

### `extend`

Inherits from an existing component and modifies — building upon the shoulders of giants.

> **The Order:** Same as `clone` but wraps/extends rather than duplicates.

### `sync` / `upstream`

Synchronizes with the upstream source — staying current with the original.

> **The Order:**
> **Familiar:** `git` → `github` | **Portal:** GitHub MCP | **Ward:** `multi-repo`
>
> `git fetch origin` → `git rebase origin/main` → resolve conflicts → push.

> *Geminio Note: `clone table from codebase` summons the DataTable. `clone vercel/ai` reaches across GitHub. The spell adapts to the source.*

---

## XI. Summoning Charms

*Accio, GitHub! These incantations open portals to external realms through MCP servers — each word connecting you to a powerful service beyond your local machine.*

Each summoning charm activates its corresponding MCP portal. No agents are required — the portal itself is the magic.

### `github`

> **Portal:** GitHub MCP | **Familiar:** `github` agent
> Tools: repos, issues, PRs, code search, Actions, file contents, commit history.

### `figma`

> **Portal:** Figma MCP (port 3845)
> Tools: `get_design_context`, `get_screenshot`, `get_metadata`, `create_design_system_rules`, `generate_diagram`.

### `linear`

> **Portal:** Linear MCP
> Tools: issues, projects, sprint tracking, status updates.

### `slack`

> **Portal:** Slack MCP
> Tools: messages, channels, team communication.

### `notion`

> **Portal:** Notion MCP
> Tools: documents, databases, wikis, page creation.

### `sentry`

> **Portal:** Sentry MCP | **Familiar:** `sse` agent
> Tools: error monitoring, exception traces, release tracking.

### `stripe`

> **Portal:** Stripe MCP
> Tools: payments, subscriptions, invoices, webhook events, customer management.

### `vercel`

> **Portal:** Vercel MCP | **Familiar:** `deploy` agent
> Tools: deployments, build logs, runtime logs, domains, projects, teams.

### `analytics`

> **Portal:** PostHog MCP
> Tools: user behavior, funnels, session recordings, feature flags.

### `neon`

> **Portal:** Neon MCP | **Familiar:** `prisma` agent
> Tools: `run_sql`, `create_branch`, `prepare_database_migration`, `complete_database_migration`, `explain_sql_statement`, `list_slow_queries`, `get_connection_string`.

> *Each portal stays open for the duration of your session. Use them freely.*

---

## XII. Divination

*The art of seeing ahead — planning, architecting, predicting what must be built before the first line is written.*

All divination spells channel the **BMAD method** installed at `~/.claude/bmad/`:

> **Shared Order:**
> **Familiar:** `orchestration` | **Backup:** `architecture`, `product`, `tech-lead`

### `bmad`

> Reveals the full BMAD menu. Entry point: `*menu`.

### `flow`

> Quick flow — 5 minutes to a working plan. Command: `*bmad-quick-flow`.

### `plan`

> Planning phase — architecture before implementation. Command: `*2-plan-workflows`. ~15 min.

### `architect`

> Architecture design — the blueprint of what will be. Command: `*3-solutioning`.

### `implement`

> Execute the plan — Divination complete, now the real magic. Command: `*4-implementation`.

### `story`

> User story workflow — the tales of what users need. Part of planning phase.

### `cycle`

> Full development cycle: plan → architect → implement → test → deploy.

### `loop`

> Continuous iteration — the Divination that never ends. Recurring cycle.

> *Professor Trelawney was wrong about most things, but right about one: the future belongs to those who prepare for it. `plan` before you `implement`.*

---

## XIII. Advanced Spellwork — Performance Magic

*N.E.W.T.-level incantations for the performance-obsessed. These spells do not create — they refine.*

All performance spells are handled by general context in CLAUDE.md — no dedicated skills or slash commands. They activate the `react` and `performance` familiars.

> **Shared Order:**
> **Familiar:** `react` + `performance` | **Backup:** `nextjs`, `build`, `structure`

### `parallelize`

> Transforms sequential `await` chains into `Promise.all()` — the Time-Turner of async code.
> **Impact:** 2-10x improvement.

### `waterfall`

> Detects and eliminates request waterfalls — finding the hidden chains that slow everything.
> **Technique:** Profile with React DevTools, restructure data fetching to parallel.

### `bundle`

> Analyzes bundle size and recommends splits — the Reducio charm for JavaScript.
> **Familiar adds:** `build` | **Technique:** `ANALYZE=true pnpm build`, tree-shaking, code splits.

### `lazy`

> Adds dynamic imports with `next/dynamic` — components that appear only when summoned.
> **Familiar adds:** `nextjs` | **Technique:** `dynamic(() => import('...'), { ssr: false })` for heavy components (Monaco, charts, maps).

### `suspense`

> Adds Suspense boundaries — the art of showing something while the real magic loads.
> **Familiar adds:** `nextjs` | **Technique:** `<Suspense fallback={...}>` wrapping async Server Components.

### `memo`

> Applies `useMemo` and `useCallback` — only after profiling proves the need.
> **Note:** React Compiler handles most cases automatically in React 19.

### `server-component`

> Converts a Client Component to Server Component — moving the magic server-side.
> **Familiar adds:** `nextjs` | **Technique:** Remove `"use client"`, extract hooks into child Client Components.

### `streaming`

> Adds streaming with Suspense — results arrive progressively, not all at once.
> **Familiar adds:** `nextjs` | **Technique:** Parallel async Server Components each wrapped in Suspense.

### `barrel`

> Fixes barrel file imports — eliminating the 200-800ms curse of importing everything.
> **Familiar adds:** `build` + `structure` | **Technique:** Replace `import { X } from '@/components'` with `import { X } from '@/components/ui/x'`.

### `dedup`

> Deduplicates with `React.cache()` — the spell that remembers, so the server doesn't repeat itself.
> **Technique:** Wrap shared data fetching functions in `React.cache()` for request-level memoization.

> *These spells have measurable impact. `parallelize` alone can improve performance 2-10x. This is not abstract theory — it is power.*

---

## XIV. Portkeys

*Touch a Portkey and you are transported. Speak a reference incantation and your context shifts to another repository.*

### `from codebase`

> **The Order:**
> **Skill:** `/codebase` | **Portal:** GitHub MCP (fallback) | **Ward:** `org-refs`
>
> 1. Search local `/Users/abdout/codebase` first
> 2. Check `src/components/` → `__registry__/` → `src/registry/`
> 3. Fallback to GitHub MCP: `databayt/codebase`
>
> **Contains:** 54 primitives, 62 atoms, 31 templates.

### `from shadcn`

> **The Order:**
> **Familiar:** `shadcn` | **Portal:** shadcn MCP | **Ward:** `org-refs`
>
> Search shadcn registry via MCP → view component → get install command → install to `src/components/ui/`.

### `from radix`

> **The Order:**
> **Familiar:** `shadcn` | **Portal:** shadcn MCP | **Ward:** `org-refs`
>
> Reference Radix primitives (Dialog.Root, DropdownMenu.Root, etc.) via `databayt/radix`.

### `like hogwarts`

> **The Order:**
> **Familiar:** `hogwarts` | **Backup:** `architecture`, `prisma`, `authjs` | **Portal:** GitHub MCP | **Ward:** `org-refs`
>
> Reference: multi-tenant architecture (schoolId on all models), subdomain routing, RBAC per school, Stripe billing, LMS/SIS schemas. Local: `/Users/abdout/oss/hogwarts`. Remote: `databayt/hogwarts`.

### `like souq`

> **The Order:**
> **Familiar:** `souq` | **Backup:** `architecture`, `react`, `prisma` | **Portal:** GitHub MCP | **Ward:** `org-refs`
>
> Reference: multi-vendor marketplace, Redux cart, product catalog, order management, category trees. Local: `/Users/abdout/oss/souq`. Remote: `databayt/souq`.

### `like mkan`

> **The Order:**
> **Familiar:** `mkan` | **Backup:** `architecture`, `prisma`, `nextjs` | **Portal:** GitHub MCP | **Ward:** `org-refs`
>
> Reference: property listings, booking system (date conflict checks), availability calendar, search/filters, review system. Local: `/Users/abdout/oss/mkan`. Remote: `databayt/mkan`.

### `like shifa`

> **The Order:**
> **Familiar:** `shifa` | **Backup:** `architecture`, `prisma`, `authjs` | **Portal:** GitHub MCP | **Ward:** `org-refs`
>
> Reference: patient model, appointment system (time slot generation), doctor scheduling, medical records, prescription system. Local: `/Users/abdout/oss/shifa`. Remote: `databayt/shifa`.

### `repositories` / `oss` / `contribute`

> **The Order:**
> **Skill:** `/repos` | **Portal:** GitHub MCP | **Ward:** `multi-repo` + `org-refs`
>
> `repositories` shows all 14 Databayt repos. `oss` browses open source. `contribute` starts the fork → branch → PR workflow.

> *Portkey Examples: "auth like hogwarts" transports the Hogwarts auth pattern. "table from codebase" summons the DataTable. The destination adapts to your origin.*

---

## XV. The Unforgivable Commands

*Some operations are forbidden by default. The Kun engine will refuse them — not out of spite, but out of care. These are the spells that cannot be undone.*

These are enforced by **deny rules** in `settings.json` — no agent, skill, or charm can override them:

| Forbidden Operation | The Ward That Blocks It |
|--------------------|------------------------|
| `rm -rf *` | Deny rule: catastrophic deletion — the Avada Kedavra of filesystems |
| `prisma migrate reset` | Deny rule: wipes entire database — every table, every record, gone |
| `prisma db push --accept-data-loss` | Deny rule: accepts data loss — a sacrifice no spell should demand |
| `DROP TABLE` via Neon | Deny rule: destroys table through MCP portal — forbidden even through portals |
| `git push --force` to main | Convention: overwrites shared history — the Imperius Curse of version control |

> *These restrictions exist because some magic, once cast, cannot be taken back. The Ministry of Magic had its reasons. So does Kun.*

---

## Compound Incantations

The true power of this system lies in combination. Single words are charms. Pairs are spells. Sequences are rituals.

| You Speak | The Order That Mobilizes | What Manifests |
|-----------|-------------------------|---------------|
| `dev` | `/dev` skill → Port Guardian hook → Chrome Opener hook | Server rises, Chrome opens |
| `table users` | `block` + `prisma` familiars → shadcn MCP → Neon MCP | A DataTable shaped for your users |
| `auth like hogwarts` | `authjs` + `hogwarts` familiars → GitHub MCP → `auth` ward | Hogwarts auth materializes in your project |
| `saas billing` | `orchestration` → 6 familiars → Stripe + Neon + shadcn MCPs | Entire billing system from two words |
| `test login` | `test` familiar → Browser MCP → `testing` ward | Vitest + Playwright converge on login |
| `motion hero` | `/motion` skill → `react` + `tailwind` familiars | Hero section learns to breathe |
| `clone vercel/ai` | `/clone` skill → GitHub MCP → `org-refs` ward | Component travels from Vercel to you |
| `handover auth` | `guardian` familiar → Browser MCP (headed) → all wards | 5-pass QA across 2 environments |
| `parallelize` | `react` + `performance` familiars | Sequential code bends time |
| `deploy` | `/deploy` skill → `deploy` familiar → Vercel MCP → `deployment` ward | Code travels to the edge of the world |

---

## The Enchanted Objects

Behind every spell stands an enchanted object — the agents, servers, and systems that make the magic real.

### Familiars (28 Agents)

Your agents are like Dumbledore's phoenix, Fawkes — intelligent, loyal, and capable of extraordinary things when called upon. There are 28 of them, organized into 6 chains:

| Chain | Count | Domain |
|-------|-------|--------|
| **Stack** | 7 | Next.js, React, TypeScript, Tailwind, Prisma, shadcn, Auth |
| **Design** | 4 | Orchestration, architecture, patterns, structure |
| **UI** | 4 | shadcn, atoms, templates, blocks |
| **DevOps** | 3 | Build, deploy, test |
| **VCS** | 2 | Git, GitHub |
| **Specialized** | 8 | Middleware, i18n, performance, diagnostics, and more |

### Portals (18 MCP Servers)

Each MCP server is a permanent portal to an external realm — like the Floo Network, but for code:

| Realm | Portal |
|-------|--------|
| **UI & Design** | shadcn, figma, tailwind, a11y, storybook |
| **Testing** | browser (headless), browser-headed (visible) |
| **DevOps** | github, vercel, sentry, gcloud |
| **Data** | neon, postgres, stripe, keychain |
| **Knowledge** | ref, context7, linear |

### Protective Wards (8 Rules)

Rules activate automatically when you touch certain files — like the protective enchantments around Hogwarts:

| Ward | Activates When | Protects |
|------|---------------|----------|
| auth | Touching auth files or middleware | NextAuth v5 patterns, session scoping |
| i18n | Editing Arabic/English dictionaries | RTL, single-language storage, on-demand translation |
| prisma | Modifying `.prisma` files | schoolId inclusion, `$extends`, regenerate client |
| tailwind | Changing CSS files | CSS-first v4, OKLCH colors, no physical properties |
| testing | Writing test files | Playwright/Vitest conventions, chrome-error skip |
| deployment | Editing vercel.json | pnpm, tsc before builds |
| multi-repo | Always loaded | Codebase paths, fork workflows |
| org-refs | Always loaded | Priority: codebase > shadcn > radix |

### Silent Enchantments (5 Hooks)

Hooks are nonverbal magic — they cast themselves without any incantation:

| Enchantment | When | Effect |
|-------------|------|--------|
| Session Start | You begin | Prints your model and timestamp |
| Port Guardian | Before `pnpm dev` | `lsof -ti:3000 \| xargs kill -9` |
| Chrome Opener | After `pnpm dev` | `open -a "Google Chrome" http://localhost:3000` |
| Auto-Format | After Write or Edit | Prettier on `.ts/.tsx/.js/.jsx/.json/.css/.md` |
| Session End | You finish | Log to `~/.claude/session-log.txt` |

### The Pensieve (Memory)

Six memory files preserve knowledge across sessions — like Dumbledore's Pensieve:

| Memory | Contains |
|--------|----------|
| preferences | Your settings, your ways |
| repositories | The 14 repos, their paths, their stacks |
| atom | 59 atoms across 6 categories |
| template | 31 templates across 5 categories |
| block | 4 blocks with their patterns |
| report | T&C electrical templates |

---

## Mastery Levels

Not all spells are equal in difficulty. Here is the progression:

### First Year — The Basics
`dev`, `build`, `push`, `fix`, `format`, `lint`

*You will cast these every day. They are reflexes, not decisions.*

### Third Year — Creating
`component`, `page`, `form`, `table`, `card`, `modal`, `test`

*You begin to conjure. Each spell creates something real.*

### Fifth Year (O.W.L.) — Compound Magic
`atom`, `template`, `deploy`, `security`, `docs`, `motion`

*You combine primitives. Your spells have structure and ambition.*

### Seventh Year (N.E.W.T.) — System Magic
`block`, `saas`, `auth`, `feature`, `handover`

*You create entire systems. One word, dozens of files, complete functionality.*

### Beyond Hogwarts — Performance Mastery
`parallelize`, `waterfall`, `bundle`, `streaming`, `dedup`

*You no longer just create — you optimize. You see the invisible chains of latency and break them.*

---

## Closing Words

> *"Words are, in my not-so-humble opinion, our most inexhaustible source of magic. Capable of both inflicting injury, and remedying it."*
> — Albus Dumbledore

This spellbook contains 114 incantations. Together, they can build, test, deploy, secure, optimize, and document an entire software company.

But remember: the magic is not in the words. It is in knowing *which* word, at *which* moment, for *which* purpose.

A wizard who types `saas billing` without understanding what billing means will get a billing system they cannot maintain. A wizard who types `deploy` without first casting `test` will send broken magic into the world.

**Learn the words. Understand the intent. Then speak — and watch the world rearrange itself.**

*كن — Be, and it is.*
