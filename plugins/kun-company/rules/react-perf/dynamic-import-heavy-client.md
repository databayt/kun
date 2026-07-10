---
domain: react-perf
severity: error
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "directly affects TTI and LCP"
since: "2026-07-10"
---

# Dynamic-import heavy components off the critical path

A heavy client component (editor, chart, map — often 100KB+) imported statically ships in the main chunk and delays Time to Interactive and LCP for every visitor, including those who never open it. Load it with `next/dynamic` so the chunk downloads on demand.

## Good

```tsx
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(
  () => import("./monaco-editor").then((m) => m.MonacoEditor),
  { ssr: false },
);

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />; // chunk loads on demand
}
```

## Bad

```tsx
import { MonacoEditor } from "./monaco-editor"; // ~300KB in the main chunk

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />;
}
```

## Fix

Replace the static import with `dynamic(() => import("./heavy").then((m) => m.Component), { ssr: false })` for any large component not needed on initial render.

> Source: vercel-labs/agent-skills · react-best-practices
