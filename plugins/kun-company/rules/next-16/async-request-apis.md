---
domain: next-16
severity: error
paths:
  [
    "**/page.tsx",
    "**/layout.tsx",
    "**/actions.ts",
    "**/route.ts",
    "**/middleware.ts",
  ]
since: "Next.js 16.0"
---

# Request APIs are async — await them

In Next 16 `cookies()`, `headers()`, `params`, and `searchParams` return Promises. Reading them synchronously throws (or silently yields a Promise object), so you must `await` them before use.

## Good

```tsx
import { cookies } from "next/headers";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const lang = (await cookies()).get("NEXT_LOCALE")?.value ?? locale;
  return <Results query={q} lang={lang} />;
}
```

## Bad

```tsx
export default function Page({ params }: { params: { locale: string } }) {
  const { locale } = params; // params is a Promise — not destructurable
  const lang = cookies().get("NEXT_LOCALE"); // cookies() is async — throws
  return <Results lang={lang} />;
}
```

## Fix

Type `params`/`searchParams` as `Promise<...>`, make the function `async`, and `await cookies()`/`headers()`/`params`/`searchParams` before reading them.
