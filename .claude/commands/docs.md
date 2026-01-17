# Documentation Generator

Generate documentation for components and APIs.

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

## Usage
```
/docs component Button
/docs api /api/users
/docs readme
```

Generate documentation: $ARGUMENTS
