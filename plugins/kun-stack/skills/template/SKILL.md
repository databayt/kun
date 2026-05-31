---
name: Template
description: Create templates - full-page layouts and major UI sections
argument-hint: "<name|list|preview|build> [name]"
model: claude-opus-4-7
allowed-tools: ["Bash(pnpm *)", "Read", "Write", "Edit", "Glob", "Grep", "mcp__shadcn__*"]
---

# Template Command

Create and manage templates - full-page layouts and major UI sections.

## Usage
```
/template <name>           - Create new template
/template list             - List all registered templates
/template preview <name>   - Preview template with code
/template build            - Rebuild template registry
```

## Argument: $ARGUMENTS

## Template Pattern

Templates follow `{type}-{number}` pattern: `hero-01`, `header-01`, `sidebar-01`, etc.

```
src/registry/default/templates/{name}/
├── page.tsx              # Main template component
└── components/           # Supporting components (if needed)
```

## Design Rules
- Self-contained (no external state dependencies)
- Responsive (mobile → tablet → desktop)
- Themeable (light/dark mode)
- Uses shadcn/ui components
- RTL-compatible (ms/me, ps/pe)
- Semantic color tokens

## Categories
- hero, header, sidebar, footer, login, dashboard, pricing, feature, testimonial, cta
