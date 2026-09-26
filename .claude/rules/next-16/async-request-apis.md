---
domain: next-16
severity: error
paths:
  [
    "**/page.tsx",
    "**/layout.tsx",
    "**/default.tsx",
    "**/route.ts",
    "**/actions.ts",
    "**/opengraph-image.tsx",
    "**/twitter-image.tsx",
    "**/icon.tsx",
    "**/apple-icon.tsx",
    "**/sitemap.ts",
  ]
since: "Next.js 16.0"
---

# Request APIs are async — await them

Next 16 removed the synchronous compatibility that 15 kept: `cookies()`, `headers()`, `draftMode()`, `params` (page, layout, route, default, and the opengraph/twitter/icon image functions, plus their `id`), `searchParams`, and the `sitemap` `id` are all Promises. Reading one synchronously is a type error and at runtime yields `undefined` or throws. Type pages with the generated global helpers `PageProps<'/route'>`, `LayoutProps<'/route'>` and `RouteContext<'/route'>` (written by `next dev`, `next build` or `next typegen`, no import) so the keys are checked against the real route.

## Good

```tsx
import { cookies } from "next/headers";

export default async function Page(props: PageProps<"/[lang]/students">) {
  const { lang } = await props.params;
  const { q } = await props.searchParams;
  const theme = (await cookies()).get("theme")?.value ?? "light";
  return <Results query={q} lang={lang} theme={theme} />;
}
```

## Bad

```tsx
export default function Page({ params }: { params: { lang: string } }) {
  const { lang } = params; // params is a Promise — lang is undefined
  const theme = cookies().get("theme"); // cookies() is async — TypeError
  return <Results lang={lang} theme={theme} />;
}
```

## Fix

Make the function `async`, type its props with `PageProps`/`LayoutProps`/`RouteContext` (or `Promise<...>`), and `await` `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` before reading them.

> Source: https://nextjs.org/docs/app/guides/upgrading/version-16#async-request-apis-breaking-change
