---
name: react-best-practices
description: React 19 + Next.js 16 performance — eliminate waterfalls, bundle bloat, re-render churn. Use when writing, reviewing, or refactoring React code. Triggers on tasks involving components, pages, data fetching, bundles, or perf.
license: MIT
metadata:
  author: kun (adapted from vercel-labs/agent-skills/skills/react-best-practices)
  version: "1.0.0"
  upstream: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
paths:
  - "src/**/*.{ts,tsx,jsx}"
  - "src/app/**"
  - "src/components/**"
---

# React Best Practices (kun edition)

Adapted from Vercel Engineering's react-best-practices skill. Covers React 19 + Next.js 16 + Server Components + Suspense.

## When to Apply

Reference these guidelines when:

- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority      | Category                    | Impact         | Prefix       |
|--------------|-----------------------------|----------------|--------------|
| 1 — CRITICAL | Eliminating Waterfalls       | 2-10× LCP      | `async-`     |
| 2 — CRITICAL | Bundle Size Optimization     | TTI, FCP       | `bundle-`    |
| 3 — HIGH     | Server-Side Performance      | Request latency| `server-`    |
| 4 — MEDIUM-HIGH | Client-Side Data Fetching | UX             | `client-`    |
| 5 — MEDIUM   | Re-render Optimization        | Runtime perf   | `rerender-`  |
| 6 — MEDIUM   | Rendering Performance        | Frame budget   | `rendering-` |
| 7 — LOW-MEDIUM | JavaScript Performance     | Microtasks     | `js-`        |
| 8 — LOW      | Advanced Patterns           | Edge cases    | `advanced-`  |

## Quick Reference (most-cited rules)

### 1. Eliminating Waterfalls (CRITICAL)

❌ Sequential awaits:
```tsx
const user = await getUser();
const posts = await getPosts(user.id);
```

✅ Parallel:
```tsx
const [user, posts] = await Promise.all([getUser(), getPosts(id)]);
```

### 2. Avoid Barrel Imports (CRITICAL)

❌ Imports everything (200–800ms cold-start):
```tsx
import { Icon } from '@/components/icons';
```

✅ Direct import:
```tsx
import { ChevronRight } from 'lucide-react';
```

### 3. Lazy-load Heavy Components (CRITICAL)

```tsx
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
```

### 4. Functional setState (MEDIUM)

❌ Stale closure:
```tsx
setItems([...items, newItem]);
```

✅ Stable:
```tsx
setItems(curr => [...curr, newItem]);
```

### 5. Lazy State Initialization (MEDIUM)

❌ Runs every render:
```tsx
const [data] = useState(expensiveComputation());
```

✅ Runs once:
```tsx
const [data] = useState(() => expensiveComputation());
```

### 6. Minimize RSC Boundary Serialization (MEDIUM-HIGH)

❌ Serializes the whole object:
```tsx
<ClientComponent data={fullObject} />
```

✅ Pass only what's needed:
```tsx
<ClientComponent name={obj.name} id={obj.id} />
```

### 7. Server Component by Default (HIGH)

Don't add `"use client"` unless the component:
- Uses hooks (`useState`, `useEffect`, `useRouter` from `next/navigation`'s client subset)
- Handles browser events (onClick, etc.)
- Reads `window` / `document` / `localStorage`

If only the leaf needs it, push `"use client"` to the leaf, not the parent.

### 8. Stream with Suspense (HIGH)

For pages with mixed fast/slow data:

```tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent />
</Suspense>
```

LCP shows immediately; SlowComponent streams in.

## Code Review Checklist

When reviewing a React PR:

- [ ] Server Component by default? Pushes `"use client"` only as far as needed?
- [ ] All `await` operations parallelized via `Promise.all` where independent?
- [ ] No request waterfalls?
- [ ] No barrel imports of heavy modules?
- [ ] Heavy client-only components dynamic'd?
- [ ] `setState` uses functional form?
- [ ] RSC boundary props are minimal (no full objects)?
- [ ] `useMemo` / `useCallback` only where measured wins exist (not by default)?
- [ ] Suspense boundaries placed at fast/slow seams?

## How to Use

1. **Read on review**: Claude auto-loads this skill when reviewing files matching `paths` (Server Components, hooks, pages).
2. **Manual invoke**: `/react-best-practices` to get the full checklist applied to current diff.
3. **Per-rule deep dive**: see `rules/<area>-<rule>.md` for rule-by-rule breakdowns (TBD — most rules inlined above).

## References

- Upstream: [vercel-labs/agent-skills/skills/react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)
- React 19 docs: https://react.dev
- Next.js AGENTS.md: https://github.com/vercel/next.js/blob/canary/AGENTS.md
- Kun sweep skill: `/react`

## Compatibility

- Targets: React 19 + Next.js 16 + TypeScript 5
- Skill schema: Anthropic SKILL.md spec + Vercel `agentskills.io` open standard
