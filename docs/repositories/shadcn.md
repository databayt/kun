# shadcn — UI Component Library

> **Fork of shadcn-ui/ui. Foundation for all Databayt UI.**

---

## Overview

| Field | Value |
|-------|-------|
| **Repo** | [databayt/shadcn](https://github.com/databayt/shadcn) |
| **Upstream** | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) (111K stars) |
| **URL** | [ui.shadcn.com](https://ui.shadcn.com) |
| **Language** | TypeScript |
| **License** | MIT |
| **Size** | 38 MB |
| **Forks** | 1 |
| **Created** | 2025-03-27 |
| **Last Push** | 2025-12-01 |

---

## What It Does

This is Databayt's fork of shadcn/ui — the component library that provides the `ui` layer (Level 1) in the component hierarchy. All 54 primitives (Button, Dialog, Select, Table, etc.) come from here.

### Why a Fork

- Customization for Arabic RTL support
- Integration with Databayt's design tokens
- Ability to patch upstream issues before they're merged
- Registry system for internal component distribution

---

## Relationship to Stack

```
radix (primitives) → shadcn (components) → codebase (atoms/templates) → products
```

- **radix** provides the accessible primitives
- **shadcn** wraps them into styled components
- **codebase** composes them into atoms and templates
- **Products** (Hogwarts, Mkan, etc.) consume the final components

---

## Recent Activity

```
8a5027a feat: add @shadcraft to directory.json and registries.json
8032063 chore(release): version packages
d0fb73a fix: do not install baseStyle when adding registry:theme
62218c1 feat: update color value detection for cssVars
```

Synced from upstream. Mostly passive — pull updates as needed.

---

## What Kun Does for shadcn

- Triggers shadcn MCP when adding UI components
- Keeps fork in sync with upstream
- References shadcn registry when building atoms
