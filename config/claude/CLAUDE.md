# Kun Context

## Pattern Library
Reference patterns at: /opt/databayt/codebase/

## Component Hierarchy
```
Foundation: Radix UI → shadcn/ui → shadcn Ecosystem
Building:   UI → Atoms → Templates → Blocks → Micro → Apps
```

### Component Levels
- **UI**: 54 shadcn/ui primitives (Button, Card, Input)
- **Atoms**: 62 composed components (StatCard, ButtonGroup)
- **Templates**: 31 full-page layouts (Hero, Sidebar, Login)
- **Blocks**: UI with business logic (Invoice, DataTable, Auth)

## Architecture Principles

### 1. Mirror-Pattern
Every URL route maps 1:1 to directory structure:
```
src/
  app/[lang]/          # Routing & layouts
    (root)/
      atoms/           # Atom showcase
      templates/       # Template showcase
  components/          # Component logic (mirrors app)
    atom/              # Atomic components
    template/          # Full-page templates
    ui/                # shadcn/ui primitives
```

### 2. File Patterns
Standard file naming across features:
- `content.tsx` - Feature/page UI composition
- `actions.ts` - Server actions & API calls
- `config.ts` - Enums, option lists, labels
- `validation.ts` - Zod schemas
- `type.ts` - Domain and UI types
- `form.tsx` - Typed forms (React Hook Form)
- `card.tsx` - Card components and KPIs

### 3. Server-First
- Server components by default
- Client components only when necessary
- Server actions for mutations
- Node.js runtime for Prisma/bcrypt

### 4. Type Safety
Zod schemas → TypeScript types → Prisma models

## Anti-Patterns (DO NOT)
- No inline styles except for dynamic values
- No `console.log` in production code
- No hardcoded strings (use i18n)
- No God components (max 200 lines)
- No `any` types
- No direct commits to main branch

## Git Workflow
1. Create feature branch from main
2. Implement with conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `refactor:` - Code refactoring
3. Create PR with description
4. Request review
5. Merge after approval

## Available Agents
When implementing specific domains, reference:
- `architect.md` - System design
- `nextjs.md` - Next.js patterns
- `typescript.md` - Type safety
- `prisma.md` - Database queries
- `shadcn.md` - UI components
- `test.md` - Testing patterns

## Quick Commands
- `/spec` - Turn idea into specification
- `/plan` - Create implementation plan
- `/ship` - Create PR with summary
