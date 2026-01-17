# Atom Command

Create and manage atoms - compositions of 2+ shadcn/ui primitives.

## Usage
```
/atom <name>           → Create new atom
/atom list             → List all registered atoms
/atom preview <name>   → Preview atom with code
/atom docs <name>      → Generate MDX documentation
```

## Argument: $ARGUMENTS

## Instructions

Parse the argument and execute accordingly:

### If argument is a name (e.g., "stat-card"):

1. **Check if atom exists**
   - Look in `src/components/atom/{name}.tsx` or `src/components/atom/{name}/index.tsx`
   - If exists, show preview with code

2. **Create new atom**
   - Identify required shadcn/ui primitives
   - Create component following atom pattern:
     ```
     src/components/atom/{name}.tsx
     ```
   - Apply design rules:
     - Single purpose
     - TypeScript props interface
     - className prop for customization
     - Semantic color tokens
     - RTL-compatible (ms/me, ps/pe)

3. **Register in atoms-index.ts**
   - Add lazy-loaded entry to `src/registry/atoms-index.ts`

4. **Generate MDX documentation**
   - Create `content/atoms/(root)/{name}.mdx`

### If argument is "list":

1. Read `src/registry/atoms-index.ts`
2. Display all registered atoms with categories
3. Show total count

### If argument is "preview <name>":

1. Read atom source code
2. Display with syntax highlighting
3. Show props interface
4. List shadcn/ui dependencies

### If argument is "docs <name>":

1. Read atom source code
2. Generate MDX with:
   - Title and description
   - Installation command
   - Usage example
   - Props table
   - Preview component

## Atom Pattern

```tsx
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface {Name}Props {
  // Required props
  title: string
  // Optional props
  className?: string
}

export function {Name}({ title, className }: {Name}Props) {
  return (
    <Card className={cn("", className)}>
      <CardContent>
        {title}
      </CardContent>
    </Card>
  )
}
```

## Output

```
✅ Atom "{name}" created successfully!

📁 Files created:
  - src/components/atom/{name}.tsx
  - content/atoms/(root)/{name}.mdx

📦 Primitives used:
  - card (shadcn)
  - badge (shadcn)

🔗 Preview at: /en/atoms/{name}
```

## Categories

When creating atoms, classify into:
- card - Card-based displays
- form - Form inputs and fields
- display - Data presentation
- interactive - Clickable/actionable
- navigation - Nav elements
- ai - AI-related patterns
