---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "tailwind.config.{ts,js}"
  - "src/styles/**"
description: Tailwind 4 — semantic tokens, logical properties for RTL, no raw hex
---

# Tailwind Rules

Active in any styled component path. Tailwind CSS 4 + shadcn/ui token system.

## Semantic tokens — never raw colors

Use semantic token utilities, never raw hex or palette names:

| Wrong | Right |
|-------|-------|
| `bg-white`, `bg-gray-100` | `bg-background` |
| `text-black`, `text-gray-900` | `text-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `bg-blue-500` | `bg-primary` |
| `text-red-500` | `text-destructive` |
| `border-gray-200` | `border-border` |
| `bg-[#fff]` | `bg-card` |

Theme switching (light/dark) and brand recoloring depend on this. A raw hex breaks both.

## Logical properties for RTL

Required by `.claude/rules/i18n.md`. Quick reference:

| Use | Not |
|-----|-----|
| `ms-` `me-` | `ml-` `mr-` |
| `ps-` `pe-` | `pl-` `pr-` |
| `start-0` `end-0` | `left-0` `right-0` |
| `text-start` `text-end` | `text-left` `text-right` |
| `border-s` `border-e` | `border-l` `border-r` |
| `rounded-s` `rounded-e` | `rounded-l` `rounded-r` |

Vertical (`mt-`, `mb-`, `top-`, `bottom-`) is fine — they don't flip with direction.

## Spacing scale

Use Tailwind's scale (`p-2`, `gap-4`, `space-y-6`). Never arbitrary px in classes (`p-[12px]`) unless the design system says no token applies.

## Typography

Through tokens:

- Font families: `font-sans`, `font-mono`, `font-arabic` (defined in `tailwind.config.ts`)
- Sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`
- Headings use `<h1>`–`<h6>` semantic — Tailwind sizes optional override via class

Body text default is `font-sans text-base text-foreground leading-relaxed`.

## Component composition

Prefer Tailwind utilities directly on JSX. Use `cn()` (class-variance-authority + clsx) for conditional:

```tsx
import { cn } from "@/lib/utils";

<button className={cn(
  "ms-2 px-4 py-2 rounded-md",
  "bg-primary text-primary-foreground",
  "hover:bg-primary/90",
  isLoading && "opacity-50 cursor-not-allowed",
)}>
```

No CSS modules. No `style={{ ... }}` except for dynamic values that can't be tokens (e.g., `width: ${progress}%`).

## Animations

Tailwind built-ins (`animate-in`, `fade-in`, `slide-in-from-top-2`) for simple transitions. Framer Motion via `agents/motion` for orchestrated sequences. No custom keyframes in JSX.

## Dark mode

Dark variant uses the `dark:` prefix on tokens — but in practice, semantic tokens already shift, so most components need no `dark:` at all.

## Never

- Raw hex (`bg-[#fff]`, `text-[rgb(0,0,0)]`)
- Palette literals on a token-aware component (`bg-blue-500` instead of `bg-primary`)
- Physical properties for direction-aware spacing (`ml-`, `mr-` etc.)
- Inline `style={{}}` for static values
- Arbitrary values when a scale token exists (`p-[16px]` instead of `p-4`)

## Reference

- Agent: `.claude/agents/tailwind.md`
- Sweep: `/tailwind` (mode: fix)
- Token source: `src/styles/globals.css` + `tailwind.config.ts`
