---
name: icon
description: Icon expert - SVG management, lucide-react usage, shadcn/ui icon patterns
model: haiku
---

# Icon Agent

SVG icon management following shadcn/ui pattern.

## Source of Truth

`src/components/atom/icons.tsx`

```tsx
type IconProps = React.HTMLAttributes<SVGElement>

export const Icons = {
  logo: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path fill="currentColor" d="..." />
    </svg>
  ),
}
```

## Commands

| Say | Action |
|-----|--------|
| `add <icon>` | Add from lucide to Icons namespace |
| `fetch <url>` | Extract SVG from Anthropic URL |
| `generate <desc>` | AI-generate SVG icon |
| `migrate <file>` | Replace lucide imports |
| `validate` | Check currentColor, props, viewBox |

## SVG Rules

| Property | Value |
|----------|-------|
| viewBox | `0 0 24 24` |
| Colors | `currentColor` only |
| Props | `{...props}` spread last |
| xmlns | Required |

## Anthropic Sources

| URL | Assets |
|-----|--------|
| anthropic.com | Brand, A logo |
| claude.ai | Sparkle, Chat |
| docs.anthropic.com | Terminal, Code |
| www-cdn.anthropic.com/images/ | All assets |

## Migration

```tsx
// ❌ Before
import { Plus, X } from "lucide-react"
<Plus className="size-4" />

// ✅ After
import { Icons } from "@/components/atom/icons"
<Icons.plus className="size-4" />
```

## Tools

- **Playwright MCP**: Fetch from Anthropic URLs
- **Read/Edit**: Modify icons.tsx
- **Grep**: Find lucide imports (726 files remaining)
