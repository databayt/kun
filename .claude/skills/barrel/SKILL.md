---
name: barrel
description: Barrel — Full Coverage Import Sweep
paths: ["src/**/index.ts","src/**/index.tsx"]
---

# Barrel — Full Coverage Import Sweep

Sweep every file for barrel imports that bloat bundles: `from './index'`, `from '@/components/icons'`, `export * from`. Replace with direct imports.

## Usage

- `barrel` — sweep ALL files in current product
- `barrel admission` — sweep only the admission block
- `barrel --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `barrel` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **`from '@/components/icons'`** → `from 'lucide-react'` (200-800ms savings)
2. **`from './index'`** → import from specific file
3. **`from '../index'`** → import from specific parent file
4. **`export * from`** → export specific named items

### Mode: Fix

This keyword finds AND fixes barrel imports. Each fix saves 200-800ms of bundle parse time.

### Impact

Barrel imports are the #1 bundle performance killer in large Next.js apps. Every barrel import loads the entire module tree even if you only need one export. Direct imports enable tree-shaking.

```tsx
// FAIL — loads ALL icons (200-800ms)
import { ChevronRight } from '@/components/icons'

// PASS — loads only ChevronRight
import { ChevronRight } from 'lucide-react'
```
