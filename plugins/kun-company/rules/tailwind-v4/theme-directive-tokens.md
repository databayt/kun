---
domain: tailwind-v4
severity: error
applies-to:
  ["**/*.css", "**/globals.css", "**/theme.css", "**/tailwind.config.*"]
since: "Tailwind 4.0"
---

# Define design tokens with @theme, not tailwind.config.js

Tailwind v4 is CSS-first: tokens live in `@theme` inside CSS and are exposed as both utilities and CSS variables. A `tailwind.config.js` `theme.extend` block is the v3 pattern and won't generate v4 utilities/vars.

## Good

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.62 0.19 256);
  --radius-card: 0.75rem;
  --font-display: "Inter", sans-serif;
}
```

```tsx
// usable as utility AND var
<div className="bg-brand rounded-[var(--radius-card)] font-display" />
```

## Bad

```js
// tailwind.config.js (v3 pattern — ignored by v4 token engine)
module.exports = {
  theme: {
    extend: { colors: { brand: "#4f46e5" }, borderRadius: { card: "0.75rem" } },
  },
};
```

## Fix

Move each token into `@theme { --color-brand: ...; --radius-card: ...; }` in your CSS entry and delete the `theme.extend` block.
