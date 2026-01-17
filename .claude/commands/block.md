# Block Command

Create and manage blocks - UI components with integrated business logic. Beyond shadcn/ui: authentication, data tables, payments, dashboards with full stack integration.

## Usage
```
/block <source>            → Add block from source
/block refactor <name>     → Refactor existing block
/block audit <name>        → Quality audit (100-point score)
/block list                → List all registered blocks
/block update <name>       → Update block from source
/block remove <name>       → Unregister block
```

## Argument: $ARGUMENTS

## What is a Block?

Blocks are **UI + Business Logic** - the third category after Atoms and Templates:

| Category | shadcn Equivalent | Description |
|----------|-------------------|-------------|
| UI | shadcn/ui primitives | Radix-based, minimal |
| Atoms | UI Components | 2+ primitives combined |
| Templates | Blocks | Full-page layouts |
| **Blocks** | *Beyond shadcn* | **UI + Business Logic** |

Examples: Invoice, Data Table, Auth, Payment, Dashboard Analytics

## Instructions

Parse the argument and execute accordingly:

### If argument is a source URL/path (e.g., "github:tanstack/table"):

1. **Identify Source Type**
   - `github:user/repo` or full GitHub URL
   - `shadcn:sidebar-07` or just `sidebar-07`
   - `magicui:animated-card`
   - `aceternity:spotlight`
   - `./local/path` or absolute path

2. **Fetch & Analyze**
   - Download block files
   - Analyze dependencies (shadcn/ui, npm packages)
   - Identify auth/database requirements

3. **Transform Imports**
   ```typescript
   // FROM (external)
   import { Button } from "@/registry/default/ui/button"

   // TO (project)
   import { Button } from "@/components/ui/button"
   ```

4. **Adapt Stack**
   - Auth: Clerk/Auth0 → Auth.js (reuse `src/components/auth/`)
   - Database: MongoDB/Supabase → Prisma + Neon
   - Styling: hex/rgb → OKLCH theme variables
   - Margins: ml/mr → ms/me (RTL-compatible)

5. **Create Mirror-Pattern Structure**
   ```
   src/app/[lang]/(root)/blocks/{name}/
   └── page.tsx

   src/components/root/block/{name}/
   ├── content.tsx        # Main composition
   ├── config.ts          # Configuration
   ├── types.ts           # TypeScript types
   ├── actions.ts         # Server actions (if needed)
   ├── validation.ts      # Zod schemas (if needed)
   └── README.md          # Documentation
   ```

6. **Add i18n Support**
   - Extract strings to `en.json` and `ar.json`
   - Add `dir` attribute for RTL

7. **Register Block**
   - Add to block memory file
   - Update navigation if needed

8. **Validate**
   - Run `pnpm tsc --noEmit`
   - Check dev server renders correctly
   - Report initial audit score

### If argument is "refactor <name>":

1. Read existing block source
2. Apply improvements:
   - Type safety (eliminate `any`)
   - i18n completeness
   - RTL support
   - Performance optimization
   - Accessibility (ARIA labels)
3. Run audit and report improvements

### If argument is "audit <name>":

1. Read block source
2. Score on 100-point scale:

   | Category | Points |
   |----------|--------|
   | Architecture | 20 |
   | Code Quality | 20 |
   | Styling | 15 |
   | i18n | 15 |
   | Accessibility | 10 |
   | Performance | 10 |
   | Security | 5 |
   | Documentation | 5 |

3. Provide grade: A (90+), B (80-89), C (70-79), D (60-69), F (<60)
4. List specific improvements needed

### If argument is "list":

1. Read block registry
2. Display all blocks grouped by category
3. Show status, audit score, last updated

### If argument is "update <name>":

1. Check original source
2. Compare with current version
3. Apply updates while preserving customizations
4. Re-run validation

### If argument is "remove <name>":

1. Confirm removal
2. Remove from registry
3. Keep files but mark as unregistered

## Source Types

| Prefix | Source | Example |
|--------|--------|---------|
| `github:` | GitHub repository | `github:tanstack/table` |
| `shadcn:` | shadcn/ui registry | `shadcn:sidebar-07` |
| `magicui:` | Magic UI | `magicui:shimmer-button` |
| `aceternity:` | Aceternity UI | `aceternity:spotlight` |
| `internal:` | Existing component | `internal:tablecn` |
| (path) | Local file | `./downloads/block` |

## Stack Adaptation Checklist

When processing external blocks:

### Authentication
- [ ] Replace Clerk/Auth0/custom → Auth.js (NextAuth v5)
- [ ] Reuse: `src/components/auth/` existing block
- [ ] Use: `currentUser()` and `useCurrentUser()` hooks

### Database
- [ ] Replace MongoDB/Supabase/Drizzle → Prisma + Neon
- [ ] Reuse: `src/lib/db.ts` singleton client
- [ ] Follow: Multi-file schema in `prisma/models/`

### Styling
- [ ] Convert hex/rgb → OKLCH theme variables
- [ ] Use existing atoms and templates
- [ ] Apply RTL support (ms/me, text-start/end)

### Structure
- [ ] Apply mirror-pattern: app/[lang]/(root)/blocks/{name}/ + components/root/block/{name}/
- [ ] Standard files: content.tsx, config.ts, types.ts, actions.ts

## Output

```
✅ Block "{name}" added successfully!

📁 Files created:
  - src/app/[lang]/(root)/blocks/{name}/page.tsx
  - src/components/root/block/{name}/content.tsx
  - src/components/root/block/{name}/config.ts
  - src/components/root/block/{name}/types.ts

📦 Dependencies:
  - button, card, table (shadcn)
  - @tanstack/react-table (npm)

🔄 Stack Adapted:
  - Auth: Clerk → Auth.js ✓
  - DB: Supabase → Prisma ✓

🌐 i18n Added:
  - en.json: blocks.{name}.*
  - ar.json: blocks.{name}.*

📊 Initial Audit: 75/100 (Grade C)

🔗 View at: /en/blocks/{name}
```

## Categories

| Category | Icon | Description |
|----------|------|-------------|
| data | Table | Data tables, grids |
| forms | FormInput | Complex form patterns |
| auth | Lock | Authentication flows |
| payment | CreditCard | Stripe, billing |
| dashboard | LayoutDashboard | Analytics, charts |
| marketing | Megaphone | Landing sections |

## Quality Audit Details

### Architecture (20 pts)
- Mirror-pattern structure (5)
- Clear separation of concerns (5)
- Proper file organization (5)
- Server/client boundary correct (5)

### Code Quality (20 pts)
- No `any` types (5)
- Proper error handling (5)
- Clean, readable code (5)
- No unused imports/vars (5)

### Styling (15 pts)
- OKLCH color tokens (5)
- RTL-compatible spacing (5)
- Responsive design (5)

### i18n (15 pts)
- All strings extracted (5)
- Arabic translations (5)
- Locale-aware formatting (5)

### Accessibility (10 pts)
- Semantic HTML (3)
- ARIA labels (4)
- Keyboard navigation (3)

### Performance (10 pts)
- No blocking renders (4)
- Lazy loading where needed (3)
- Optimized re-renders (3)

### Security (5 pts)
- Input sanitization (2)
- CSRF protection (2)
- Auth checks (1)

### Documentation (5 pts)
- README.md present (2)
- Props documented (2)
- Usage examples (1)
