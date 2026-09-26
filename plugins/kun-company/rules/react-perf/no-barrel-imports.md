---
domain: react-perf
severity: warn
paths: ["**/*.tsx", "**/*.ts", "next.config.ts"]
impactDescription: "200-800ms import cost, slow builds"
since: "2026-07-10"
---

# Neutralize barrel-file imports — list only what Next.js doesn't already optimize

A barrel entry point (an `index.js` re-exporting hundreds of modules) makes one named import load the whole package: slower dev boot, HMR and cold starts. `experimental.optimizePackageImports` rewrites those imports to direct module paths at build time while keeping the ergonomic import and its types. Next.js already applies it by default to the common offenders — `lucide-react`, `date-fns`, `lodash-es`, `react-icons/*`, `@tabler/icons-react`, `recharts`, `rxjs`, `@mui/*`, `@headlessui/react`, `@heroicons/react/*`, `ramda`, `react-use`, `antd`, `effect` — so re-listing them is noise. Add the barrels in our stack that are not on that list (`framer-motion`/`motion`, `@tanstack/react-table`, `@assistant-ui/react`, `react-day-picker`). It cannot split a package that ships one pre-bundled file (e.g. `@radix-ui/react-icons`) or CommonJS `lodash` — import `lodash-es` or the per-method path instead.

## Good

```ts
// next.config.ts — only barrels Next.js doesn't optimize by default
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["framer-motion", "@tanstack/react-table"],
  },
};
```

```tsx
import { motion, AnimatePresence } from "framer-motion"; // rewritten to direct paths
import { Check, X } from "lucide-react"; // optimized by default, no entry needed
```

## Bad

```ts
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"], // defaults, adds nothing
  },
};
// framer-motion is not listed, so every import loads its full barrel
```

## Fix

Add non-default barrel packages (`framer-motion`, `motion`, `@tanstack/react-table`, …) to `experimental.optimizePackageImports`, and drop entries that are already on Next.js's default list.

> Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports · vercel-labs/agent-skills · react-best-practices
