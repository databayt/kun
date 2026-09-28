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

- No `loading.tsx` in `(saas-marketing)` 0/9, `(school-marketing)` 0/6, `(thmanyah)` 0/3,
  `internal-onboarding`, `kiosk`, `verify`, `certificate`, `report-card`, `invoice`; thin in
  `finance` 26/81, `parent` 1/11, `live` 1/7.
- Page-body spinners: 7 × `attendance/*/content.tsx`, `lumos/loading.tsx`,
  `school-dashboard/dashboard/loading.tsx`, `finance/receipt/content.tsx`, `exams/take/exam-player.tsx`.
- Weak fallbacks: 8 × `<div className="h-10" />` (auth pages), 3 × `null`, 1 text
  (`school-marketing/application/application-context.tsx:632`).
- Duplicates to fold into the kit: `table/data-table-skeleton.tsx`, `dashboard/loading.tsx` `TableSkeleton`.
- Kit lacks `SkeletonImage` / `SkeletonHero` for public pages. Shimmer doesn't reverse in RTL.

### mkan

- Primitive is `animate-pulse`, no shimmer keyframe.
- Generic `TableSkeleton` on `(dashboard)`, `dashboard`, `managers`, `offices`, `tenants`;
  `favorites` is a card grid; `hosting` covers messages + calendar with one card grid;
  `travel/loading.tsx` covers search/booking/ticket and **soft-404s `travel/offices/[id]`**.
- Missing: `bookings/[id]`, `bookings/[id]/checkout`, `listings/[id]/photos` (spinner), `admin/*`.
- Full-screen `Loading` overlays: `hosting/content.tsx:72`, `host/content.tsx:92`,
  `travel-host/content.tsx:52`, `travel-host/overview/page.tsx:28`.
- Text fallbacks in `listings/[id]/page.tsx:334,374,380,390`; `null` in `travel/search/page.tsx:162`.
- Home wraps content in a 0→100 counter splash (`home-loader/loading-wrapper.tsx`) that defeats the skeleton.
- **Hard constraint:** no `listings/[id]/loading.tsx`, no `listings/loading.tsx`, no Suspense in
  the `[lang]` layout or `DictionaryProvider` (commit `e8df1d8`).

## Clone

`/skeleton kit <repo>` — copies hogwarts' primitive + shimmer + `atom/loading.tsx` + ward, prunes unused atoms.
