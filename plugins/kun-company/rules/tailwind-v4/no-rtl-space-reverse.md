---
domain: tailwind-v4
severity: error
paths: ["**/*.tsx", "**/*.jsx"]
since: "2026-09-26"
---

# Never add rtl:space-x-reverse — v4 space and divide utilities are already logical

In Tailwind v4, `space-x-*` writes `margin-inline-start/end` and `divide-x-*` writes `border-inline-start/end-width`, so both already mirror under `dir="rtl"`. `rtl:space-x-reverse` / `rtl:divide-x-reverse` is a v3-era habit (and what `shadcn migrate rtl` still inserts): it flips the spacing a second time, so the first item gains a gap at the start edge and the last two items touch. Prefer `flex gap-*`, which is direction-agnostic and is what shadcn's official skill requires.

## Good

```tsx
// gap never depends on direction (plain space-x-4 is also correct in v4)
<div className="flex items-center gap-4">
  <Avatar />
  <Name />
  <Role />
</div>
```

## Bad

```tsx
// double flip in Arabic: 16px gap moves to the start edge, last pair collapses to 0
<div className="flex items-center space-x-4 rtl:space-x-reverse">
  <Avatar />
  <Name />
  <Role />
</div>
```

## Fix

Delete every `rtl:space-x-reverse` / `rtl:divide-x-reverse` and turn `space-x-N` into `gap-N` on the flex parent; keep `space-x-reverse` only alongside `flex-row-reverse` (negative `-space-x-*` overlaps are logical too — just drop the `rtl:` reverse).

> Verified 2026-09-26: compiled with Tailwind 4.1.11 and 4.3.3 and measured in Chromium — `dir="rtl"` + reverse left a 16px start-edge gap and 0px between the last pair.
> Source: https://tailwindcss.com/docs/margin (space-x CSS; "use the gap utilities" limitation) · https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/rules/styling.md
