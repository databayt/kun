---
domain: loading
severity: warn
paths:
  [
    "src/app/**/loading.tsx",
    "src/app/**/page.tsx",
    "src/components/**/loading*.tsx",
    "src/components/**/*skeleton*.tsx",
    "src/components/**/content.tsx",
  ]
since: "2026-09-28"
---

# Data waits show a layout-matching skeleton — never a page spinner, null, or text

While a route or section waits on data, render the page's shape from the repo's skeleton kit
(`@/components/atom/loading` in hogwarts, `@/components/atom/skeletons` in mkan) with the page's
real container/grid/spacing classes, so content drops into place with zero layout shift.
Spinners belong inside buttons that submitted something.

## Good

```tsx
// src/app/[lang]/s/[subdomain]/(school-dashboard)/students/loading.tsx
import { StudentsSkeleton } from "@/components/school-dashboard/listings/students/loading";
export default function Loading() {
  return <StudentsSkeleton />; // role="status" + sr-only label inside, same grid as content.tsx
}

<Suspense fallback={<SkeletonChart type="bar" className="h-[320px]" />}>
  <AttendanceChart />
</Suspense>;
```

## Bad

```tsx
export default function Loading() {
  return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
}
<Suspense fallback={null}>…</Suspense>
<Suspense fallback={<div>Loading...</div>}>…</Suspense>
```

## Fix

Compose the fallback from kit atoms that mirror the loaded layout (count the real table columns,
measure real card heights), wrap it in `role="status" aria-busy="true"` with an `sr-only` label,
use `bg-accent`/`bg-muted` tokens and `animate-shimmer` (never `bg-gray-*` or `animate-pulse` in
hogwarts). **Never place `loading.tsx` or a Suspense boundary above a `notFound()` /
`redirect()` / `permanentRedirect()` guard** — it streams HTTP 200 first (soft-404; mkan#53). Put
the skeleton in a route group beside the guarded route, or inside the page after the guard.

> Skill: `skeleton` · card: `.claude/patterns/cards/skeleton.md`
