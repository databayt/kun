# Global Claude Code Instructions

## Preferences

- **Model**: Opus 4.6 (default)
- **Package Manager**: pnpm
- **Stack**: Next.js 16, React 19, Prisma 6, TypeScript 5, Tailwind CSS 4, shadcn/ui
- **Languages**: Arabic (RTL default), English (LTR)
- **Mode**: Full Autopilot (100-turn cycles)

---

## Keywords

One word triggers a complete workflow. Keywords are organized by power level.

### Tier 1 — Pipeline (idea to production)

The feature pipeline. Each keyword is a standalone stage. `feature` chains them all.

```
feature billing hogwarts
    ↓
IDEA → SPEC → [approve] → SCHEMA → CODE → WIRE → CHECK → SHIP → WATCH
```

| Keyword | Stage | What It Does | Exit Gate |
|---------|-------|-------------|-----------|
| `feature` | All | Chains all stages — idea to production | Feature live, issue closed |
| `idea` | Capture | Create structured GitHub issue with acceptance criteria | Issue exists |
| `spec` | Specify | Data model sketch + file plan + human approval | Spec on issue, approved |
| `schema` | Data | Prisma model + migration + Zod validation | Migration applied, types compile |
| `code` | Logic | Server actions with auth + validation + tenant isolation | `tsc --noEmit` passes |
| `wire` | UI | Pages + forms + tables + i18n wired to actions | `pnpm build` passes |
| `check` | Quality | Type-check + build + visual verification | All gates green |
| `ship` | Deploy | Commit + push + Vercel deploy + verify | Deployment Ready |
| `watch` | Monitor | Post-deploy health check + production screenshot | No errors, issue closed |

**Usage**: `/feature billing hogwarts` or enter at any stage: `/schema billing`, `/wire #42`, `/check`

**Product scope**: Append product name to activate domain context — `hogwarts`, `souq`, `mkan`, `shifa`

### Tier 2 — Standalone Tools

Powerful workflows that run independently of the pipeline.

| Keyword | What It Does |
|---------|-------------|
| `dev` | Kill port 3000, start dev server, open Chrome |
| `build` | TypeScript check + production build with auto-fix loop |
| `deploy` | Vercel deployment with error detection and retry |
| `report` | Auto-fix user-reported GitHub issues — read, verify, fix, close |
| `atom` | Create atom component (2+ shadcn/ui primitives) |
| `block` | Create block (UI + business logic) |
| `template` | Create full-page layout template |
| `test` | Generate and run tests (Vitest, Playwright) |
| `clone` | Clone patterns from codebase, shadcn, or GitHub |
| `incident` | Production incident response workflow |
| `monitor` | Cross-product deployment and health check |
| `translate` | Full-coverage translation sweep (all routes or specific block) |
| `skeleton` | Full-coverage loading state sweep (all routes or specific block) |
| `structure` | Full-coverage file convention sweep (all routes or specific block) |
| `guard` | Full-coverage security sweep (all routes or specific block) |
| `coverage` | Coverage report — what's checked, what's not |
| `package` | Cross-repo dependency audit, upgrades, version alignment |
| `learn` | Org intelligence — extract patterns, conventions, team dynamics |
| `analyze` | Repo config generator — analyze patterns, generate config PR |
| `profile` | Selective config loading — core, developer, security, per-person |

### Tier 2b — Coverage Sweeps

Full-coverage sweeps with persistent ledger tracking. Say the keyword alone for full app, or with a block name for scoped sweep. All support `--status` for coverage report.

| Keyword | What It Does | Mode |
|---------|-------------|------|
| `nextjs` | Next.js 16 App Router best practices | fix |
| `react` | React 19 patterns — waterfalls, barrel imports, setState | fix |
| `typescript` | Strict mode — no any, no ts-ignore, proper types | fix |
| `tailwind` | Semantic tokens, logical properties for RTL | fix |
| `shadcn` | Use ui/ primitives — no raw HTML elements | fix |
| `prisma` | Query best practices — select, tenant scope, N+1 | report |
| `authjs` | Auth.js v5 patterns — auth(), sessions, roles | report |
| `accessibility` | A11y — semantic HTML, keyboard, ARIA, alt text | fix |
| `barrel` | No barrel imports — direct imports only | fix |
| `waterfall` | No sequential fetching — Promise.all() | fix |

**Every sweep keyword supports:** `keyword` (full app), `keyword blockname` (scoped), `keyword --status` (report only)

**Infrastructure:** Keywords registry at `.claude/coverage/keywords.json`, sweep protocol at `.claude/coverage/sweep-protocol.md`, per-product ledger at `<product>/.claude/coverage/ledger.json`

### Tier 3 — Vocabulary

Claude understands these keywords and activates the right agents and MCPs. No dedicated command needed.

**UI patterns**: `table`, `form`, `modal`, `card`, `sidebar`, `header`, `footer`, `hero`, `navbar`, `menu`
**Features**: `auth`, `dashboard`, `landing`, `checkout`, `settings`, `profile`, `admin`, `onboarding`
**Animation**: `motion`, `animation`, `transition`, `gesture`, `scroll`
**Quality**: `security`, `performance`, `review`, `audit`, `e2e`
**Build**: `fix`, `error`, `lint`, `format`, `type-check`, `deps`, `outdated`
**React perf**: `parallelize`, `bundle`, `lazy`, `suspense`, `memo`, `streaming`, `dedup`
**Docs**: `docs`, `readme`, `api-docs`, `storybook`, `changelog`
**Services**: `github`, `figma`, `linear`, `slack`, `stripe`, `vercel`, `sentry`, `neon`, `analytics`
**Cross-repo**: `from codebase`, `from shadcn`, `like hogwarts`, `like souq`, `like mkan`, `like shifa`
**Operations**: `report`, `costs`, `pricing`, `weekly`, `dispatch`, `monitor`, `incident`, `credentials`
**Intelligence**: `learn`, `analyze`, `profile`, `conventions`, `health`, `patterns`, `drift`

---

## Component Hierarchy

| Level | Name | Description | shadcn Equivalent |
|-------|------|-------------|-------------------|
| 1 | `ui` | Radix primitives | shadcn/ui |
| 2 | `atom` | 2+ primitives | UI Components |
| 3 | `template` | Full-page layouts | Blocks |
| 4 | `block` | UI + business logic | Beyond shadcn |
| 5 | `micro` | Mini micro-services | - |

**Memory Files:** `~/.claude/memory/{atom,template,block,report}.json`

---

## Planning

For feature development, use the pipeline: `/feature <name> [product]`

The pipeline replaces BMAD for day-to-day work:
- Bug fixes → `/report`
- New features → `/feature <name>`
- Components → `/atom`, `/block`, `/template`

BMAD is still available at `~/.claude/bmad/` for enterprise-scale planning.

---

## Multi-Repo Workflows

### Environment
- `CODEBASE_PATH`: /Users/abdout/codebase (primary)
- `OSS_PATH`: /Users/abdout/oss (open source)
- `GITHUB_USER`: abdout

### Commands
| Say | Action |
|-----|--------|
| `oss` | Browse open source repos |
| `contribute` | PR workflow for OSS |
| `fork` | Fork and customize |

---

## Reference Codebase

**Local:** `/Users/abdout/codebase`
**GitHub:** `databayt/codebase`

When implementing, check codebase first:
1. `src/components/` for components
2. `__registry__/` for registry items
3. `src/registry/` for templates

---

## MCP Quick Reference

| MCP | Trigger |
|-----|---------|
| shadcn | ui, component, atom |
| browser | test, e2e, playwright |
| github | push, pr, issue |
| vercel | deploy, ship |
| neon | prisma, migration, db |
| sentry | error, debug |
| linear | issue, task |
| stripe | payment, billing |
| posthog | analytics |
| ref | docs, lookup |
| context7 | latest docs |

---

## Slash Commands

### Pipeline (idea → production)
| Command | Purpose |
|---------|---------|
| `/feature <name> [product]` | Full pipeline — idea to production |
| `/idea <name>` | Capture feature as GitHub issue |
| `/spec #N` | Generate technical spec from issue |
| `/schema #N` | Create Prisma model + migration + Zod |
| `/code #N` | Create server actions + auth + validation |
| `/wire #N` | Create pages + forms + tables + i18n |
| `/check` | Quality gate — type-check + build + visual |
| `/ship` | Commit + deploy to Vercel production |
| `/watch` | Post-deploy health check |

### Standalone Tools
| Command | Purpose |
|---------|---------|
| `/dev` | Start dev server |
| `/build` | Smart build with auto-fix |
| `/deploy` | Deploy to Vercel |
| `/report` | Auto-fix user-reported issues |
| `/atom <name>` | Create atom component |
| `/block <source>` | Create block (UI + logic) |
| `/template <name>` | Create full-page layout |
| `/test <file>` | Generate and run tests |
| `/clone <source>` | Clone from codebase/GitHub |

### Intelligence
| Command | Purpose |
|---------|---------|
| `/learn` | Org intelligence — full org, single repo, team, conventions, health |
| `/analyze <repo>` | Generate `.claude/` config PR from repo patterns |
| `/profile [name]` | Show/switch/create configuration profiles |

### Coverage Sweeps (all support `[block]` scoping)
| Command | Purpose |
|---------|---------|
| `/translate [block]` | Find and fix hardcoded strings |
| `/nextjs [block]` | Enforce Next.js 16 App Router patterns |
| `/react [block]` | Fix waterfalls, barrel imports, setState |
| `/typescript [block]` | Remove `any`, fix types |
| `/tailwind [block]` | Semantic tokens, logical properties for RTL |
| `/shadcn [block]` | Replace raw HTML with ui/ primitives |
| `/prisma [block]` | Audit queries — select, tenant, N+1 |
| `/authjs [block]` | Audit auth — auth(), sessions, roles |
| `/skeleton [block]` | Check/create loading.tsx |
| `/structure [block]` | Verify mirror pattern conventions |
| `/guard [block]` | Verify auth + validation + tenant |
| `/waterfall [block]` | Parallelize sequential fetching |
| `/barrel [block]` | Replace barrel imports |
| `/accessibility [block]` | Fix a11y — keyboard, ARIA, alt text |
| `/coverage [product] [keyword]` | Coverage report |

### Patterns
| Command | Purpose |
|---------|---------|
| `/pattern` | List all canonical patterns with status |
| `/pattern <keyword>` | Show pattern card (form, table, modal, auth, etc.) |
| `/clone pattern:<keyword>` | Clone canonical pattern to current repo |

### Utilities
| Command | Purpose |
|---------|---------|
| `/codebase` | Search reference codebase |
| `/screenshot` | View recent screenshot |
| `/monitor` | Cross-product health check |
| `/incident` | Production incident response |
| `/package` | Dependency audit and upgrades |
| `/docs` | Generate documentation |
| `/security` | Security audit |
| `/performance` | Performance audit |

---

## Behavior

When you see a keyword:
1. **Pipeline keywords** → execute the corresponding pipeline stage command
2. **Tool keywords** → execute the standalone tool command
3. **Sweep keywords** → run full-coverage sweep with ledger tracking (all routes or scoped to block)
4. **Vocabulary keywords** → activate the right agent(s) and MCP tools

### Examples

| You Say | What Happens |
|---------|-------------|
| `feature billing hogwarts` | Full pipeline: idea → spec → schema → code → wire → check → ship → watch |
| `spec #42` | Generate technical spec for issue #42 |
| `schema` | Create Prisma model + migration from latest spec |
| `wire billing` | Create pages + forms + tables for billing feature |
| `check` | Type-check + build + visual verification |
| `ship` | Commit + deploy to Vercel + verify |
| `dev` | Kill port 3000 → pnpm dev → Open Chrome |
| `report hogwarts` | Auto-fix open report issues in hogwarts |
| `table users` | block agent → DataTable → prisma |
| `auth like hogwarts` | Reference hogwarts auth patterns |
| `clone vercel/ai` | Clone and adapt from GitHub |
| `learn` | Full org intelligence scan — all repos, team, conventions |
| `learn hogwarts` | Deep dive into hogwarts patterns and conventions |
| `learn team` | Who works on what, when, expertise areas |
| `learn health` | Velocity metrics, fix:feature ratio, trends |
| `analyze hogwarts` | Generate `.claude/` config PR from hogwarts patterns |
| `analyze . --dry-run` | Preview config generation without PR |
| `profile ali` | Switch to Ali's QA + Sales profile |
| `profile show core` | Show what's in the core profile |
| `translation` | Sweep ALL routes for hardcoded strings, fix them |
| `translation admission` | Sweep admission block only |
| `nextjs` | Enforce Next.js 16 best practices across all routes |
| `nextjs finance` | Enforce Next.js patterns in finance block only |
| `react` | Fix waterfalls, barrel imports, setState across all components |
| `react admission` | Fix React anti-patterns in admission block |
| `typescript` | Remove `any`, `ts-ignore`, fix types across all files |
| `tailwind` | Semantic tokens, logical properties for RTL across all components |
| `shadcn` | Replace raw HTML with shadcn/ui primitives |
| `prisma` | Audit all queries for select, tenant scope, N+1 |
| `skeleton` | Check/create loading.tsx for every page |
| `structure` | Verify mirror pattern conventions |
| `guard` | Verify auth + validation + tenant isolation |
| `waterfall` | Find and parallelize sequential data fetching |
| `barrel` | Replace barrel imports with direct imports |
| `accessibility` | Fix clickable divs, missing alt, ARIA |
| `authjs` | Audit auth patterns — auth(), sessions, roles |
| `coverage hogwarts` | Show coverage status for all keywords |
| `coverage hogwarts react` | Detailed per-module React breakdown |

---

## React Best Practices (Vercel)

Source: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

### Priority Order

| Priority | Category | Impact |
|----------|----------|--------|
| **CRITICAL** | Eliminate Waterfalls | 2-10× improvement |
| **CRITICAL** | Bundle Size | Initial load time |
| **HIGH** | Server-Side | Request latency |
| **MEDIUM** | Client Data Fetching | UX responsiveness |
| **MEDIUM** | Re-render Optimization | Runtime performance |

### React Keywords

| Keyword | Action |
|---------|--------|
| `parallelize` | Convert sequential → `Promise.all()` |
| `waterfall` | Find and fix request waterfalls |
| `bundle` | Analyze bundle, suggest splits |
| `lazy` | Add `next/dynamic` lazy loading |
| `suspense` | Add Suspense boundaries |
| `memo` | Add `useMemo`/`useCallback` |
| `server-component` | Convert to Server Component |
| `streaming` | Add streaming with Suspense |
| `barrel` | Fix barrel file imports |
| `dedup` | Deduplicate with `React.cache()` |

### Critical Patterns

**1. Eliminate Waterfalls**
```tsx
// ❌ Sequential (BAD)
const user = await getUser();
const posts = await getPosts(user.id);

// ✅ Parallel (GOOD)
const [user, posts] = await Promise.all([getUser(), getPosts(id)]);
```

**2. Avoid Barrel Imports**
```tsx
// ❌ Imports everything (200-800ms)
import { Icon } from '@/components/icons';

// ✅ Direct import
import { ChevronRight } from 'lucide-react';
```

**3. Dynamic Imports for Heavy Components**
```tsx
// ✅ Lazy load Monaco Editor (~300KB)
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
```

**4. Functional setState**
```tsx
// ❌ Stale closure risk
setItems([...items, newItem]);

// ✅ Stable, safe
setItems(curr => [...curr, newItem]);
```

**5. Lazy State Initialization**
```tsx
// ❌ Runs every render
const [data] = useState(expensiveComputation());

// ✅ Runs once
const [data] = useState(() => expensiveComputation());
```

**6. Minimize RSC Serialization**
```tsx
// ❌ Serializes everything
<ClientComponent data={fullObject} />

// ✅ Only what's needed
<ClientComponent name={obj.name} id={obj.id} />
```

### Code Review Checklist

When reviewing React code:
- [ ] Server Component by default?
- [ ] Async operations parallelized?
- [ ] No request waterfalls?
- [ ] No barrel file imports?
- [ ] Heavy components lazy loaded?
- [ ] Functional setState used?
- [ ] Minimal RSC boundary serialization?

---

## Organization References (databayt)

**Full Documentation**: [kun/content/docs/repositories.mdx](https://github.com/databayt/kun/blob/main/content/docs/repositories.mdx)

### Priority Lookup Order

When building features, check these repos in order:

1. **codebase** (`databayt/codebase`) - Patterns, agents, components, templates
2. **shadcn** (`databayt/shadcn`) - UI component library (shadcn/ui fork)
3. **radix** (`databayt/radix`) - Radix UI primitives

### Core Libraries

| Repo | URL | Purpose |
|------|-----|---------|
| **codebase** | github.com/databayt/codebase | Patterns, agents, blocks |
| **shadcn** | github.com/databayt/shadcn | UI components |
| **radix** | github.com/databayt/radix | UI primitives |
| **kun** | github.com/databayt/kun | Code Machine config |

### Product References

| Repo | URL | Use For |
|------|-----|---------|
| **hogwarts** | github.com/databayt/hogwarts | Multi-tenant, LMS, billing |
| **souq** | github.com/databayt/souq | E-commerce, vendors |
| **mkan** | github.com/databayt/mkan | Rentals, booking |
| **shifa** | github.com/databayt/shifa | Medical, appointments |
| **swift-app** | github.com/databayt/swift-app | iOS/Swift mobile |
| **marketing** | github.com/databayt/marketing | Landing pages |

### Reference Keywords

| Keyword | Action |
|---------|--------|
| `from codebase` | Clone pattern from codebase |
| `from shadcn` | Use shadcn/ui component |
| `from radix` | Use Radix primitive |
| `like hogwarts` | Reference hogwarts patterns |
| `like souq` | Reference souq patterns |
| `like mkan` | Reference mkan patterns |
| `like shifa` | Reference shifa patterns |
| `repositories` | Show full repo documentation |

### Examples

| You Say | Action |
|---------|--------|
| "auth like hogwarts" | Reference hogwarts auth flow |
| "cart from souq" | Clone cart pattern from souq |
| "booking like mkan" | Reference mkan booking system |
| "table from codebase" | Clone DataTable from codebase |
| "show repositories" | Open kun/content/docs/repositories.mdx |
