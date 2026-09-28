---
name: skeleton
description: Skeleton loading states — layout-matching shimmer while data loads
when_to_use: "Use when a route or section needs a loading state while DATA loads — loading.tsx, Suspense fallbacks, the skeleton kit + shimmer, replacing spinners, routes that flash blank. Not `blur` (image bytes). Triggers on: skeleton, loading state, loading.tsx, shimmer, page flashes blank, replace the spinner, هيكل التحميل."
argument-hint: "[audit|kit|route <path>|convert <component>] [repo]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm *), Bash(node *), Bash(git *)
model: opus
---

# Skeleton — the page's shape, before its data

While data loads, show the page's **shape**: the same grid, the same card sizes, the same
table columns — drawn as soft blocks that shimmer. When the data lands, content drops into
exactly those boxes and nothing moves. A skeleton that doesn't match its page is worse than
none: it adds a layout shift on top of the wait.

Canonical file layout, per-repo adoption, and the route list: pattern card
`.claude/patterns/cards/skeleton.md`. Enforced ambiently by `.claude/rules/loading/skeleton-loading.md`.

## The three rules

1. **Match the layout.** Copy the real page's container, grid and spacing classes into the
   skeleton; swap text for bars and media for boxes of the same aspect ratio. Same `gap-*`,
   same `p-*`, same breakpoints.
2. **Skeletons for data, spinners for actions.** A page, section, table or card waiting on
   data → skeleton. A button that submitted a form → `Loader2 animate-spin` inside the button.
   A full-page centered spinner is never the answer.
3. **Accessible and quiet.** The wrapper is `role="status" aria-busy="true"` with an
   `sr-only` translated "Loading…" / "جارٍ التحميل…"; every bar is `aria-hidden`. Reduced
   motion stops the shimmer (`motion-reduce:animate-none`), the shapes stay.

## The kit — canonical: hogwarts

hogwarts is the reference implementation (300 `loading.tsx`, one kit, zero `animate-pulse`).
Clone its shape, don't reinvent it:

| File                                   | Role                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/components/ui/skeleton.tsx`       | the shadcn primitive, className swapped to the shimmer (the one deliberate deviation from upstream shadcn) |
| `src/app/globals.css`                  | `@keyframes shimmer` + `@utility animate-shimmer` (reduced-motion → static at 0.7 opacity)                 |
| `src/components/atom/loading.tsx`      | the kit — one file of composable skeletons, static (no hooks, no state, no fetching)                       |
| `src/components/<feature>/loading.tsx` | the feature's page skeleton, composed from the kit with the page's real layout classes                     |
| `src/app/**/loading.tsx`               | a one-liner delegating to the feature skeleton                                                             |
| `.claude/rules/skeleton.md` (repo)     | the repo-local ward, path-scoped to loading files                                                          |

The kit's recurring shapes (hogwarts names — reuse them so skeletons read the same across repos):

| Atom                                          | Draws                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `SkeletonDataTable columns rows`              | toolbar + header + N rows — pass the real table's column count        |
| `SkeletonStats` / `SkeletonStatsRow`          | dashboard KPI tiles                                                   |
| `SkeletonChart type`                          | bar/line/pie/area placeholder at the chart's real height              |
| `SkeletonList` / `SkeletonActivityFeed`       | avatar + two bars per row                                             |
| `SkeletonForm` / `SkeletonFormGrid`           | label bar + input box per field + submit                              |
| `SkeletonCard` / `SkeletonCardCompact`        | card chrome                                                           |
| `SkeletonCalendar` / `SkeletonMonthCalendar`  | week/month grids                                                      |
| `SkeletonPageNav tabs`                        | the tab strip under a page header                                     |
| `SkeletonImage aspect` · `SkeletonHero` (add) | media box at a fixed aspect ratio · marketing hero — for public pages |

Marketplace repos (mkan) also need `SkeletonListingCard` + `SkeletonListingGrid` — media box at
the card's aspect ratio, title bar, two meta bars, inside the page's real grid classes.

### The shimmer

```css
/* globals.css — Tailwind v4 */
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@utility animate-shimmer {
  animation: shimmer 1.8s ease-in-out infinite;
  &:where([dir="rtl"], [dir="rtl"] *) {
    animation-direction: reverse;
  } /* sweep in reading direction */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.7;
  }
}
```

```tsx
// src/components/ui/skeleton.tsx
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-gradient-to-r from-accent via-accent/40 to-accent bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
```

### Accessible wrapper

A page-level skeleton's outermost element carries the status, the bars stay silent:

```tsx
<div role="status" aria-busy="true" className="space-y-6">
  <span className="sr-only">{label ?? "Loading…"}</span>
  …kit atoms…
</div>
```

`loading.tsx` receives no `params`, so it can't load the dictionary; an English `sr-only`
label is acceptable, a missing one is not. Where the feature skeleton is rendered from a
Suspense fallback inside a page that already has `dictionary`, pass the translated label.

## Where the skeleton goes — Next 16

| Situation                                           | Placement                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A whole route segment awaits data                   | `loading.tsx` beside `page.tsx`, rendering the page's skeleton                         |
| One slow section in an otherwise fast page          | `<Suspense fallback={<SectionSkeleton />}>` around that async server component only    |
| Client component fetching after mount (SWR, action) | render the skeleton while `isLoading`, same atom                                       |
| `next/dynamic` heavy widget (chart, map, editor)    | `loading: () => <Skeleton className="h-[360px] w-full" />` at the widget's real height |
| Images                                              | not a skeleton — see the `blur` skill; the frame is `bg-muted`                         |

Colocate: `src/components/<feature>/loading.tsx` or `<feature>-skeleton.tsx` next to the
feature's `content.tsx` (mirror pattern), then the route's `loading.tsx` is a one-line
re-export. One skeleton per page layout, reused by every route that shares that layout.

## $ARGUMENTS

### `audit [repo]` — which routes flash blank or spin

```bash
cd ~/<repo>
find src/app -name page.tsx | wc -l;  find src/app -name loading.tsx | wc -l
# page dirs with no loading.tsx on the path up to the route group:
find src/app -name page.tsx -exec dirname {} \; | while read d; do
  p="$d"; hit=; while [ "$p" != "src/app" ]; do [ -f "$p/loading.tsx" ] && hit=1 && break; p=$(dirname "$p"); done
  [ -z "$hit" ] && echo "$d"; done | head -40
grep -rn 'Suspense fallback={null}' src | wc -l
grep -rln 'Loader2' src/app --include='loading.tsx'           # spinner-as-page-loader
grep -rn 'return null' src/app --include='loading.tsx' | wc -l
```

Report per route group: routes · with loading.tsx · layout-matching vs generic · spinners ·
`fallback={null}`. Rank by traffic: public/landing → list pages → detail pages → dashboards → settings.

### `kit [repo]` — install the atoms + shimmer

Check `src/components/atom/` first — extend what exists, don't fork it (fold stray
`data-table-skeleton.tsx`-style duplicates into the kit). Missing entirely → copy hogwarts'
`atom/loading.tsx`, the shimmer utility and `.claude/rules/skeleton.md`, then prune atoms the
repo has no page for. `pnpm tsc`.

### `route <path> [repo]` — one route, layout-exact

1. Read the route's `page.tsx` + its `content.tsx`: the container, grid, card, table shape.
2. Build `<feature>-skeleton.tsx` from kit atoms with **the same layout classes**.
3. `loading.tsx` → `export { default } from "@/components/<feature>/loading"` or render it.
4. Verify: throttle, screenshot the skeleton and the loaded page at the same viewport, and
   compare box positions — they should overlap. Check `ar` (RTL) too.

### `convert <component> [repo]` — spinner or null → skeleton

Replace the centered `Loader2` / `fallback={null}` / `"Loading..."` text with the matching
kit atom at the same height. Keep spinners inside buttons.

## Gotchas

- **`loading.tsx` above `notFound()` turns a 404 into a 200.** The boundary streams the shell
  with status 200 before the page decides it doesn't exist — a soft-404 that search engines
  index. For detail routes (`[id]`, `[slug]`) that call `notFound()`, validate existence
  **before** the boundary (in the layout or a parent segment without `loading.tsx`) or put the
  Suspense _inside_ the page below the existence check. mkan hit this on the listing route
  (mkan#53 — two Suspense boundaries had to go); do not reintroduce them.
- **`loading.tsx` wraps the page, not the layout.** Sidebars and headers from the layout stay
  real; the skeleton only draws the page area. Don't redraw the sidebar inside it.
- **Route groups share one `loading.tsx` at the group root** only if every page in the group
  has the same shape; a generic table skeleton on a form page is a layout shift.
- **Heights, not guesses.** Measure a real row/card height (`h-[72px]`) rather than eyeballing
  `h-16`; the whole point is zero shift.
- **Dark mode**: use `bg-accent`/`bg-muted` tokens, never `bg-gray-200`.
- **RTL**: widths like `w-2/3` align to the start edge automatically in a flex/grid with
  `dir="rtl"`; use `ms-auto`/`me-auto`, never `ml-auto`/`mr-auto`, to push bars.

## After

- Update the repo row in `.claude/patterns/cards/skeleton.md` + `.claude/patterns/registry.json`.
- Block protocol: when the route belongs to a block, update its README/ISSUE records.
