---
domain: tailwind-v4
severity: warn
paths:
  ["**/*.tsx", "**/page.tsx", "**/content.tsx", "**/form.tsx", "**/table.tsx"]
since: "Tailwind 4.0"
---

# No hardcoded colors in className

Arbitrary color values (`bg-[#4f46e5]`, `text-[rgb(...)]`) bypass the `@theme` token system, so they ignore dark mode, miss OKLCH uniformity, and drift from the design system. Reference semantic tokens instead.

## Good

```tsx
// resolves through @theme — adapts to .dark, stays on-brand
<Card className="bg-card text-card-foreground border-border">
  <Badge className="bg-primary text-primary-foreground">{status}</Badge>
</Card>
```

## Bad

```tsx
// frozen color — no dark variant, drifts from tokens
<Card className="bg-[#ffffff] text-[#111827] border-[#e5e7eb]">
  <Badge className="bg-[#4f46e5] text-white">{status}</Badge>
</Card>
```

## Fix

Replace each `bg-[#...]`/`text-[rgb(...)]` with the matching `@theme` token utility (`bg-primary`, `text-card-foreground`); add the token to `@theme` first if it's missing.
