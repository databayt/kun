---
name: Docs
description: Generate documentation - component MDX, API docs, Storybook stories
argument-hint: "<component|api|readme> [name]"
model: claude-opus-4-7
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep"]
---

# Documentation Generator

Generate documentation for components and APIs.

## Usage
```
/docs component Button
/docs api /api/users
/docs readme
```

## Argument: $ARGUMENTS

## Types

### Component MDX
```mdx
---
title: ComponentName
description: Brief description
---

## Installation
## Usage
## Props
## Examples
```

### API Documentation
- Endpoint descriptions
- Request/response schemas
- Authentication requirements
- Error codes

### Storybook Stories
```tsx
export const Default: Story = {
  args: { ... }
};
```

## Output Locations
- `docs/` - MDX documentation
- `*.stories.tsx` - Storybook
- `README.md` - Package readme
