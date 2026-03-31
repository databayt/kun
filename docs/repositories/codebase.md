# Codebase — Pattern Library

> **The accelerator. Every product draws from this.**

---

## Overview

| Field | Value |
|-------|-------|
| **Repo** | [databayt/codebase](https://github.com/databayt/codebase) |
| **URL** | [base-coral.vercel.app](https://base-coral.vercel.app) |
| **Language** | TypeScript |
| **Size** | 33 MB |
| **Created** | 2025-11-12 |
| **Last Push** | 2026-01-31 |

---

## What It Does

Codebase is Databayt's shared component and pattern library. It provides reusable atoms, templates, and blocks that all products (Hogwarts, Mkan, Souq, Shifa) inherit from. Think "internal shadcn/ui registry" with business logic included.

### Structure

```
src/
├── components/
│   ├── ui/           # 54 shadcn/ui primitives
│   ├── atom/         # 62 atomic components (2+ primitives composed)
│   └── template/     # Full-page layouts
├── registry/         # 31 templates (shadcn registry format)
└── ...
```

### Component Hierarchy

| Level | Count | Description |
|-------|-------|-------------|
| `ui` | 54 | Radix primitives via shadcn/ui |
| `atom` | 62 | Composed components (data table, forms, cards) |
| `template` | 31 | Full-page layouts (dashboard, settings, auth) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.1, React 19.2.3 |
| Language | TypeScript 5.9 |
| Database | Prisma 6.19 |
| Auth | NextAuth v5 beta 29 |
| Payments | Stripe 18 |
| AI | Anthropic SDK, Groq, OpenAI |
| Docs | fumadocs |
| Tables | @tanstack/react-table, react-virtual |
| DnD | @dnd-kit |
| Command | cmdk |
| Carousel | embla-carousel |
| Drawer | vaul |
| OTP | input-otp |
| Toast | sonner |
| Charts | recharts |
| PDF | react-pdf, puppeteer |
| Testing | Vitest |

---

## How Products Use It

| Product | What it takes from codebase |
|---------|----------------------------|
| Hogwarts | DataTable, forms, dashboard layouts, auth flows |
| Mkan | Card layouts, search, map components |
| Souq | Product cards, vendor dashboard, cart |
| Shifa | Patient records table, appointment forms |

### Usage Pattern

```bash
# Clone a pattern into a product
# "clone table from codebase" → copies DataTable atom
# "template dashboard from codebase" → copies dashboard layout
```

---

## Recent Activity

```
475db80 fix: remove width-forcing selectors causing ButtonGroup overflow
1a96237 fix: remove extra px from PageNav
49fae94 fix: remove extra px from middle area
54ce29a Revert "fix: align PageHeader with container utilities"
a17f346 fix: align PageHeader with container utilities
```

Maintenance phase — fixing layout issues, ensuring components work across products.

---

## What Kun Does for Codebase

- Provides `/clone` skill to copy patterns into products
- Maintains atom/template/block memory files
- References codebase first when implementing any feature
- Tracks component inventory across all products
