---
domain: tailwind-v4
severity: error
paths:
  ["**/*.tsx", "**/page.tsx", "**/content.tsx", "**/form.tsx", "**/*.css"]
since: "Tailwind 4.0"
---

# Use logical properties for RTL/LTR correctness

Databayt ships Arabic (RTL default) and English (LTR). Physical utilities (`ml-`, `mr-`, `left-`, `text-left`) stay pinned to one side and break the mirrored layout. Logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) flip automatically with `dir`.

## Good

```tsx
// flips correctly under <html dir="rtl"> and dir="ltr"
<nav className="flex">
  <Logo className="me-4" />
  <Link className="ps-3 text-start">{t("home")}</Link>
  <Button className="ms-auto end-0">{t("login")}</Button>
</nav>
```

## Bad

```tsx
// always hugs the physical left — wrong in Arabic RTL
<nav className="flex">
  <Logo className="mr-4" />
  <Link className="pl-3 text-left">{t("home")}</Link>
  <Button className="ml-auto left-0">{t("login")}</Button>
</nav>
```

## Fix

Swap physical for logical: `ml-→ms-`, `mr-→me-`, `pl-→ps-`, `pr-→pe-`, `left/right-→start/end-`, `text-left→text-start`.
