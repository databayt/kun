---
name: SaaS
description: Generate complete SaaS feature with all layers
when_to_use: "Use when a whole feature should be scaffolded across every layer at once — schema, server actions and UI — instead of walking the staged /feature pipeline. Triggers on: scaffold the whole feature, generate all layers, full CRUD for."
argument-hint: "<feature-name>"
model: opus
allowed-tools: ["Bash(pnpm *)", "Read", "Write", "Edit", "Glob", "Grep"]
---

# SaaS Feature Generator

Generate a complete SaaS feature with all layers.

## Argument: $ARGUMENTS

## Steps

1. **Database Schema** (Prisma)
   - Create model in `prisma/models/`
   - Add relations to existing models
   - Generate migration

2. **Server Actions** (`src/actions/`)
   - CRUD operations
   - Validation with Zod
   - Error handling

3. **UI Components**
   - List view with DataTable
   - Create/Edit forms
   - Detail view
   - Use shadcn/ui components

4. **Pages** (App Router)
   - `app/[lang]/(root)/$1/page.tsx`
   - `components/$1/content.tsx`

5. **Integrations** (if needed)
   - Stripe for billing
   - Auth checks
   - Analytics events
