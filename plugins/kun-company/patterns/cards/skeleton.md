# Skeleton Pattern

## Status

| Repo     | Pattern                                   | Maturity    | loading.tsx / pages | Canonical |
| -------- | ----------------------------------------- | ----------- | ------------------- | --------- |
| hogwarts | one-file kit + shimmer + repo ward        | production  | 300 / 491           | **yes**   |
| mkan     | `atom/skeletons.tsx` kit, `animate-pulse` | development | 18 / ~70            | no        |
| codebase | shadcn primitive only                     | partial     | —                   | no        |

Audited 2026-09-28. Skill: `skeleton` · ward: `.claude/rules/loading/skeleton-loading.md`.

## Canonical: hogwarts

### File Structure

```
src/components/ui/skeleton.tsx        # shadcn primitive → animate-shimmer gradient (deliberate deviation)
src/app/globals.css                   # @keyframes shimmer + @utility animate-shimmer (reduced motion → static)
src/components/atom/loading.tsx       # the kit: SkeletonDataTable, SkeletonStats(Row|Large), SkeletonChart(Grid),
                                      #   SkeletonList(Compact), SkeletonActivityFeed, SkeletonForm(Grid|Section),
                                      #   SkeletonCard(Compact), SkeletonStatCard, SkeletonCalendar, SkeletonMonthCalendar,
                                      #   SkeletonPageNav(Wide) — static, no hooks
src/components/<feature>/loading.tsx  # feature page skeleton composed from the kit
src/app/**/loading.tsx                # delegates to the feature skeleton
.claude/rules/skeleton.md             # repo ward (bans animate-pulse, text fallbacks, return null)
```

### Architecture

- **Skeleton = the page's shape.** Same container, grid, gaps and breakpoints as `content.tsx`;
  text → bars, media → boxes at the real aspect ratio.
- **Data → skeleton, action → spinner.** `Loader2` only inside a submitting button.
- **Placement.** Whole segment → `loading.tsx`; one slow section → `<Suspense fallback>` around
  just that async component; client fetch → render the same atom while loading; `next/dynamic`
  → `loading: () => <Skeleton className="h-[…]" />` at the real height.
- **Guards first.** No `loading.tsx` / Suspense above `notFound()` or a redirect — soft-404 (mkan#53).
- **A11y.** Outer wrapper `role="status" aria-busy="true"` + `sr-only` label; bars `aria-hidden`.
- **RTL.** Shimmer sweeps in reading direction (`animation-direction: reverse` under `[dir=rtl]`).

## Gaps (2026-09-28)

### hogwarts

Phase 1 shipped 2026-09-28 (`2d4049b04`): shimmer sweeps in reading direction (RTL reverse),
primitive `aria-hidden`; attendance ai/analytics/gamification/hall-pass/recent/letters/reports/
bulk-upload, finance receipt, Lumos, dashboard loading → layout skeletons; `AuthFormSkeleton`
replaces the 8 `h-10` fallbacks; banking text fallback → banking skeleton. Null fallbacks around
render-nothing components (`ResumeTokenFromUrl`, `AccessCheck`) are correct and stay.

Phase 2:

- No `loading.tsx` in `(saas-marketing)`, `(school-marketing)`, `(thmanyah)`, `kiosk`, `verify`,
  `certificate`, `report-card`, `invoice`; thin in `finance` 26/81, `parent` 1/11, `live` 1/7.
- **Soft-404:** `[lessonId]` has a `loading.tsx` above its `notFound()`; Lumos slug redirect sits under a loading boundary.
- `Math.random` in the banking skeleton + the kit's bar chart → hydration mismatch risk.

### mkan

Phase 1 shipped 2026-09-28 (`a20e47e`): shimmer primitive + `@utility animate-shimmer` (RTL reverse);
`SkeletonStatus` + page skeletons replace the full-screen overlays on hosting, host, travel-host and
travel-host overview; listing-detail text fallbacks and travel search `null` → section skeletons.

Phase 2:

- Generic `TableSkeleton` on `(dashboard)`, `dashboard`, `managers`, `offices`, `tenants`; `favorites`
  (card grid) and hosting messages/calendar need their own shapes.
- `travel/loading.tsx` **soft-404s `travel/offices/[id]`** — move into a route group.
- Missing: `bookings/[id]`, `bookings/[id]/checkout`, `listings/[id]/photos` (spinner), `admin/*`;
  ~10 dashboard `<Loading />` spinners; `HeroSectionSkeleton` still `animate-pulse`.
- Home 0→100 counter splash (`home-loader/loading-wrapper.tsx`) hides the skeleton — product decision.
- **Hard constraint:** no `listings/[id]/loading.tsx`, no `listings/loading.tsx`, no Suspense in
  the `[lang]` layout or `DictionaryProvider` (commit `e8df1d8`).

## Clone

`/skeleton kit <repo>` — copies hogwarts' primitive + shimmer + `atom/loading.tsx` + ward, prunes unused atoms.
