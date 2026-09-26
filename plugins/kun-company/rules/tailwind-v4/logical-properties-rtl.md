---
domain: tailwind-v4
severity: error
paths: ["**/*.tsx", "**/page.tsx", "**/content.tsx", "**/form.tsx", "**/*.css"]
since: "Tailwind 4.0 (inset-s/e: 4.2)"
---

# Use logical properties for RTL/LTR correctness

Databayt ships Arabic (RTL default) and English (LTR). Physical utilities (`ml-`, `mr-`, `left-`, `right-`, `text-left`, `rounded-l-`, `border-l-`, `float-left`) stay pinned to one side and break the mirrored layout. Logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `inset-s-`, `inset-e-`, `text-start`, `rounded-s-`, `border-s-`, `float-start`) flip automatically with `dir`. Since Tailwind 4.2 the inline-inset utilities are `inset-s-*`/`inset-e-*`; `start-*`/`end-*` still compile but are deprecated.

## Good

```tsx
// flips correctly under <html dir="rtl"> and dir="ltr" (Tailwind >= 4.2)
<nav className="relative flex">
  <Logo className="me-4" />
  <Link className="ps-3 text-start">{t("home")}</Link>
  <Button className="ms-auto rounded-s-md">{t("login")}</Button>
  <Badge className="absolute inset-e-0 top-0" />
</nav>
```

## Bad

```tsx
// always hugs the physical left/right — wrong in Arabic RTL
<nav className="relative flex">
  <Logo className="mr-4" />
  <Link className="pl-3 text-left">{t("home")}</Link>
  <Button className="ml-auto rounded-l-md">{t("login")}</Button>
  <Badge className="absolute right-0 top-0" />
</nav>
```

## Fix

Swap physical for logical: `ml-→ms-`, `mr-→me-`, `pl-→ps-`, `pr-→pe-`, `left-/right-→inset-s-/inset-e-`, `text-left→text-start`, `rounded-l-→rounded-s-`, `border-l-→border-s-`, `float-left→float-start`.

> Version gate: `inset-s-*`/`inset-e-*` need Tailwind >= 4.2 (Feb 2026) — on 4.1.x (hogwarts' lockfile resolves 4.1.11) `start-*`/`end-*` are the only option until the bump. Leave `start-*`/`end-*` inside shadcn-managed `components/ui/**`: the CLI's RTL transform emits them, and rewriting them creates upstream-sync drift. Logical utilities landed in 4.2; 4.3 (May 2026) added `scrollbar-*`.
> Source: https://tailwindcss.com/docs/top-right-bottom-left · https://tailwindcss.com/blog/tailwindcss-v4-3 · https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.2.0
