---
domain: react-perf
severity: error
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "200-800ms import cost, slow builds"
since: "2026-07-10"
---

# Neutralize barrel-file imports

Barrel entry points (an `index.js` re-exporting everything) in icon/component libraries can carry up to 10,000 re-exports — importing one icon loads them all, costing 200-800ms per cold start and seconds of dev boot. Tree-shaking doesn't save you: external packages aren't optimized, and bundling them slows builds instead. List heavy libraries in `optimizePackageImports` so Next.js rewrites the barrel import to direct imports at build time (keeps TypeScript types, unlike manual deep paths).

## Good

```ts
// next.config.ts — Next.js transforms barrel imports to direct imports
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons", "date-fns"],
  },
};

// component — keep the ergonomic import, now compiled to direct paths
import { Check, X, Menu } from "lucide-react";
```

## Bad

```tsx
// no optimizePackageImports entry — pulls the whole barrel
import { Check, X, Menu } from "lucide-react";
// loads ~1,583 modules, ~2.8s extra in dev, 200-800ms per cold start
```

## Fix

Add every barrel-heavy dependency (`lucide-react`, `react-icons`, `@radix-ui/react-*`, `lodash`, `date-fns`, `rxjs`, …) to `experimental.optimizePackageImports` in next.config.

> Source: vercel-labs/agent-skills · react-best-practices
