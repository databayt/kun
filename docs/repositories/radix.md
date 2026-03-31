# Radix — UI Primitives

> **Fork of radix-ui/primitives. The accessibility foundation.**

---

## Overview

| Field | Value |
|-------|-------|
| **Repo** | [databayt/radix](https://github.com/databayt/radix) |
| **Upstream** | [radix-ui/primitives](https://github.com/radix-ui/primitives) (18.7K stars) |
| **URL** | [radix-ui.com/primitives](https://radix-ui.com/primitives) |
| **Language** | TypeScript |
| **License** | MIT |
| **Size** | 21 MB |
| **Created** | 2025-08-08 |
| **Last Push** | 2025-12-07 |

---

## What It Does

Databayt's fork of Radix UI primitives — the low-level, unstyled, accessible components that underpin shadcn/ui. Dialog, Popover, Select, Tabs, Tooltip, etc.

### Why a Fork

- Patch RTL/direction issues before upstream fixes
- Customizations for Arabic accessibility
- Stay ahead of breaking changes

---

## Relationship to Stack

```
radix (this) → shadcn → codebase → products
```

The deepest layer. Changes here propagate through the entire UI stack.

---

## Recent Activity

```
2bab24a Direction: Added `use client` directive to module entrypoint
8fe4a28 Collection: Updated `unstable_createCollection` signature
a34698c New release
```

Synced from upstream. Updated when new Radix releases drop.

---

## What Kun Does for Radix

- References radix when debugging primitive behavior
- Keeps fork in sync with upstream releases
- Lowest priority — changes are rare and upstream-driven
