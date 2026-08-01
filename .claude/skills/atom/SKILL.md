---
name: atom
description: Create atoms - compositions of 2+ shadcn/ui primitives
when_to_use: When creating, listing, previewing, or documenting an atom in /Users/abdout/codebase — a reusable composition of 2+ shadcn/ui primitives registered at /atoms and installable via npx codebase add. Triggers on "atom <name>", "create an atom", "new atom", "register this as an atom".
argument-hint: "<name|list|preview|docs> [name]"
allowed-tools:
  ["Bash(pnpm *)", "Read", "Write", "Edit", "Glob", "Grep", "mcp__shadcn__*"]
---

# Atom Skill

Create and manage atoms in `/Users/abdout/codebase` — compositions of 2+
shadcn/ui primitives, mirrored on shadcn's "components" docs pattern.
Deep expertise: the `atom` agent (`.claude/agents/atom.md` in the repo).

## Usage

```
/atom <name>           - Create + register + document a new atom
/atom list             - List registered atoms (src/registry/default/atoms/_registry.ts)
/atom preview <name>   - Preview atom with code
/atom docs <name>      - Scaffold MDX documentation
```

## Argument: $ARGUMENTS

## Full flow (create → register → document → publish)

1. **Create** `src/components/atom/<name>.tsx` — flat file, named export:

```tsx
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface {Name}Props {
  title: string
  className?: string
}

export function {Name}({ title, className }: {Name}Props) {
  return (
    <Card className={cn("", className)}>
      <CardContent>{title}</CardContent>
    </Card>
  )
}
```

2. **Register** in `src/registry/atoms-index.ts` (`{ name, files }`) and — if
   installable — `src/registry/default/atoms/_registry.ts` (description,
   categories, registryDependencies).
3. **Document**: `pnpm generate:docs` scaffolds
   `content/atoms/(root)/<name>.mdx` and merges `meta.json`; add a live demo
   child after registering a preview in `src/mdx-components.tsx`.
4. **Publish**: `pnpm build:registry` → `public/r/styles/*/<name>.json`.

## Design rules

- Single purpose; typed props; `className` pass-through with `cn()`
- Compose from shipped primitives — `empty`, `field`, `item`, `spinner`,
  `kbd`, `button-group`, `input-group`, `combobox`, `native-select`,
  `direction`, chat set — never hand-roll them
- RTL logical properties only (`ms-/me-/ps-/pe-/start-/end-`, `text-start`);
  directional icons get `rtl:rotate-180`
- Radix via unified `radix-ui` package, never `@radix-ui/react-*`
- Semantic color tokens

## Categories

card · form · display · interactive · navigation · ai · animation · layout · data
