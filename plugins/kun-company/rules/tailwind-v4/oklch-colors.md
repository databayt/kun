---
domain: tailwind-v4
severity: warn
applies-to: ["**/*.css", "**/globals.css", "**/theme.css"]
since: "Tailwind 4.0"
---

# Color tokens use OKLCH, not hex/HSL

Define `@theme` color tokens in OKLCH so lightness is perceptually uniform — light/dark pairs and hover/active shades stay legible without per-shade hand-tuning, which hex and HSL can't guarantee.

## Good

```css
@theme {
  --color-primary: oklch(0.62 0.19 256); /* L C H */
  --color-primary-hover: oklch(0.56 0.19 256); /* same hue/chroma, lower L */
  --color-bg: oklch(0.98 0 0);
}
.dark {
  --color-bg: oklch(0.18 0 0); /* flip lightness, keep token name */
}
```

## Bad

```css
@theme {
  --color-primary: #4f46e5;
  --color-primary-hover: #4338ca; /* eyeballed shade — drifts in hue */
  --color-bg: hsl(0 0% 98%);
}
```

## Fix

Convert tokens to `oklch(L C H)` and derive hover/dark variants by adjusting only L (and toggling it under `.dark`).
