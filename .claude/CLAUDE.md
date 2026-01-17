# Global Claude Code Instructions

## Preferences

- **Model**: Opus 4.5 (default)
- **Package Manager**: pnpm
- **Stack**: Next.js 16, React 19, Prisma 6, TypeScript 5, Tailwind CSS 4, shadcn/ui
- **Languages**: Arabic (RTL default), English (LTR)
- **Mode**: Full Autopilot (100-turn cycles)

---

## Quick Keywords

Say any of these words to trigger the corresponding tools:

### Workflow
| Keyword | Action |
|---------|--------|
| `dev` | Start dev server, kill port 3000, open Chrome |
| `build` | Run pnpm build with error scanning |
| `push` | Full git add, commit, push workflow |
| `quick` | Fast commit (skip build validation) |
| `ship` | Deploy to Vercel production |
| `deploy` | Deploy to staging/preview |
| `validate` | Run all quality checks |

### Creation
| Keyword | Action |
|---------|--------|
| `component` | Create React component |
| `page` | Create Next.js page |
| `api` | Create Server Action |
| `atom` | Create atom (2+ primitives) |
| `template` | Create template (full-page layout) |
| `block` | Create block (UI + logic) |
| `feature` | Plan and create full feature |
| `migration` | Create Prisma migration |

### Framework
| Keyword | Action |
|---------|--------|
| `nextjs` | Apply Next.js 16 patterns |
| `react` | Apply React 19 patterns |
| `typescript` | TypeScript strict mode |
| `prisma` | Database operations |
| `tailwind` | Styling with Tailwind v4 |
| `shadcn` | shadcn/ui components |

### UI Patterns
| Keyword | Action |
|---------|--------|
| `table` | DataTable with sorting, filtering |
| `header` | Page header with navigation |
| `menu` | Navigation menu/sidebar |
| `form` | Form with validation |
| `modal` | Dialog/modal component |
| `card` | Card variations |
| `sidebar` | Sidebar navigation |
| `footer` | Footer component |
| `hero` | Hero section |
| `navbar` | Top navigation bar |

### Features
| Keyword | Action |
|---------|--------|
| `auth` | Authentication flow |
| `saas` | SaaS feature (schema + API + UI + billing) |
| `dashboard` | Dashboard layout |
| `landing` | Landing page |
| `checkout` | Payment checkout |
| `settings` | Settings page |
| `profile` | User profile |
| `admin` | Admin panel |
| `onboarding` | User onboarding flow |

### Animation
| Keyword | Action |
|---------|--------|
| `motion` | Framer Motion animations |
| `animation` | CSS/Framer animations |
| `transition` | Page transitions |
| `gesture` | Touch/drag interactions |
| `scroll` | Scroll-triggered animations |

### Quality
| Keyword | Action |
|---------|--------|
| `test` | Generate tests (Vitest) |
| `e2e` | E2E tests (Playwright) |
| `coverage` | Test coverage report |
| `review` | Code review |
| `security` | Security audit (OWASP) |
| `audit` | Full quality audit |
| `accessibility` | a11y audit (WCAG) |
| `optimize` | Performance optimization |
| `performance` | Core Web Vitals check |

### Build
| Keyword | Action |
|---------|--------|
| `fix` | Auto-fix lint/type errors |
| `error` | Scan and fix errors |
| `scan` | Scan codebase for issues |
| `lint` | Run ESLint |
| `format` | Run Prettier |
| `type-check` | TypeScript strict check |

### Documentation
| Keyword | Action |
|---------|--------|
| `docs` | Generate MDX documentation |
| `readme` | Create/update README |
| `api-docs` | API documentation |
| `storybook` | Component stories |
| `changelog` | Update changelog |

### Clone/Copy
| Keyword | Action |
|---------|--------|
| `clone` | Clone from codebase/github |
| `copy` | Copy component |
| `fork` | Create variant |
| `extend` | Inherit and modify |
| `sync` | Sync with upstream |
| `upstream` | Pull from upstream |

### External Services
| Keyword | MCPs Triggered |
|---------|----------------|
| `github` | github MCP |
| `figma` | figma MCP |
| `linear` | linear MCP |
| `slack` | slack MCP |
| `notion` | notion MCP |
| `sentry` | sentry MCP |
| `stripe` | stripe MCP |
| `vercel` | vercel MCP |
| `analytics` | posthog MCP |
| `neon` | neon MCP |

### Planning (BMAD)
| Keyword | Action |
|---------|--------|
| `bmad` | Show BMAD menu |
| `flow` | Quick flow (5 min) |
| `plan` | Start planning phase |
| `architect` | Architecture design |
| `implement` | Execute implementation |
| `story` | User story workflow |
| `cycle` | Full development cycle |
| `loop` | Continuous iteration |

### Report (T&C Electrical)
| Keyword | Action |
|---------|--------|
| `report` | Generate T&C report |
| `relay` | Protection relay report |
| `transformer` | Transformer report |
| `switchgear` | Switchgear report |
| `cable` | Cable testing report |
| `grounding` | Grounding report |

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

## BMAD Method

Installed globally at `~/.claude/bmad/`

### Commands
| Command | Purpose |
|---------|---------|
| `*menu` | Show all BMAD options |
| `*workflow-init` | Analyze project, recommend track |
| `*bmad-quick-flow` | Rapid development (~5 min) |
| `*2-plan-workflows` | Planning phase |
| `*3-solutioning` | Architecture design |
| `*4-implementation` | Execute plan |
| `*document-project` | Generate documentation |

### Tracks
| Track | Time | Use For |
|-------|------|---------|
| Quick Flow | ~5 min | Bug fixes, small features |
| BMad Method | ~15 min | Products, platforms |
| Enterprise | ~30 min | Compliance systems |

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

### Core
| Command | Purpose |
|---------|---------|
| `/dev` | Start dev server |
| `/build` | Smart build |
| `/push` | Full commit + push |
| `/quick` | Fast commit |
| `/deploy` | Deploy to Vercel |

### Creation
| Command | Purpose |
|---------|---------|
| `/atom <name>` | Create atom |
| `/template <name>` | Create template |
| `/block <source>` | Add block |
| `/saas <feature>` | Generate SaaS feature |
| `/clone <source>` | Clone from source |

### Quality
| Command | Purpose |
|---------|---------|
| `/test <file>` | Generate tests |
| `/review` | Code review |
| `/security` | Security audit |
| `/performance` | Performance audit |
| `/docs` | Generate docs |

### Utilities
| Command | Purpose |
|---------|---------|
| `/codebase search` | Search codebase |
| `/screenshot` | View recent screenshot |
| `/nextjs` | Apply Next.js patterns |
| `/motion` | Add animations |

---

## Behavior

When you see a keyword:
1. Reference the mapped agent(s)
2. Use relevant MCP tools
3. Apply quality checks automatically
4. Suggest relevant commands

### Examples

| You Say | Tools Activated |
|---------|-----------------|
| "dev" | Kill port 3000 → pnpm dev → Open Chrome |
| "push" | git add → commit → push → github MCP |
| "table users" | block agent → DataTable → prisma |
| "auth" | authjs agent → NextAuth setup |
| "saas billing" | orchestrate → stripe MCP → schema + UI |
| "motion hero" | framer-motion → page transitions |
| "test login" | test agent → Vitest + Playwright |
| "bmad" | Show BMAD menu → workflow selection |
| "clone vercel/ai" | github MCP → clone → adapt |
| "parallelize" | Convert sequential → Promise.all |
| "waterfall" | Detect and fix request waterfalls |
| "bundle" | Analyze and optimize bundle size |
| "lazy" | Add lazy loading with dynamic imports |
| "suspense" | Add Suspense boundaries |

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
