---
name: SaaS
description: Generate complete SaaS feature with all layers
argument-hint: "<feature-name>"
model: claude-opus-4-7
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
