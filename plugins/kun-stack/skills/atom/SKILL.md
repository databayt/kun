---
name: Atom
description: Create atoms - compositions of 2+ shadcn/ui primitives
argument-hint: "<name|list|preview|docs> [name]"
model: claude-opus-4-7
allowed-tools: ["Bash(pnpm *)", "Read", "Write", "Edit", "Glob", "Grep", "mcp__shadcn__*"]
---

# Atom Command

Create and manage atoms - compositions of 2+ shadcn/ui primitives.

## Usage
```
/atom <name>           - Create new atom
/atom list             - List all registered atoms
/atom preview <name>   - Preview atom with code
/atom docs <name>      - Generate MDX documentation
```

## Argument: $ARGUMENTS

## Atom Pattern

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

## Design Rules
- Single purpose
- TypeScript props interface
- className prop for customization
- Semantic color tokens
- RTL-compatible (ms/me, ps/pe)

## Categories
- card - Card-based displays
- form - Form inputs and fields
- display - Data presentation
- interactive - Clickable/actionable
- navigation - Nav elements
- ai - AI-related patterns
