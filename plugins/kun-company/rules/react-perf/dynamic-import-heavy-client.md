---
domain: react-perf
severity: error
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "directly affects TTI and LCP"
since: "2026-07-10"
---

# Dynamic-import heavy components off the critical path

A heavy client component (editor, chart, map — often 100KB+) imported statically ships in the main chunk and delays Time to Interactive and LCP for every visitor, including those who never open it. Load it with `next/dynamic` so the chunk downloads on demand. `ssr: false` is only allowed inside a Client Component — in a Server Component (the App Router default) Next.js fails with "`ssr: false` is not allowed with `next/dynamic` in Server Components", so put the `dynamic()` call in a `'use client'` wrapper and render that wrapper from the server page.

## Good

```tsx
// code-panel.tsx
"use client";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(
  () => import("./monaco-editor").then((m) => m.MonacoEditor),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

export function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />; // chunk loads on demand
}
```

## Bad

```tsx
// page.tsx (Server Component)
import dynamic from "next/dynamic";
import { MonacoEditor } from "./monaco-editor"; // ~300KB in the main chunk

const Chart = dynamic(() => import("./chart"), { ssr: false }); // build error here
```

## Fix

Replace the static import with `dynamic(() => import("./heavy").then((m) => m.Component), { ssr: false })` inside a `'use client'` file for any large component not needed on initial render.

> Source: vercel-labs/agent-skills · react-best-practices · https://nextjs.org/docs/app/guides/lazy-loading
