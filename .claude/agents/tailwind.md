---
name: tailwind
description: Tailwind CSS 4 expert for semantic tokens, responsive design, and RTL/LTR support
model: opus
version: "Tailwind 4.x"
handoff: [shadcn, semantic, react]
---

# Tailwind CSS Expert

**Latest**: 4.1.x | **Docs**: https://tailwindcss.com/docs

## Core Responsibility

Expert in Tailwind CSS 4 including utility-first patterns, semantic color tokens, responsive design, RTL/LTR support, dark mode, and integration with shadcn/ui components.

## Key Concepts

### Semantic Token System
Never hardcode colors. Always use semantic tokens that adapt to themes.

## Patterns (Full Examples)

### 1. Semantic Color Tokens
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --border: 240 5.9% 90%;
    --destructive: 0 84.2% 60.2%;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
  }
}
```

### 2. Using Semantic Tokens
```tsx
// CORRECT
<div className="bg-background text-foreground">
  <div className="bg-card border border-border rounded-lg p-4">
    <h2 className="text-foreground">Title</h2>
    <p className="text-muted-foreground">Description</p>
    <button className="bg-primary text-primary-foreground">Action</button>
  </div>
</div>

// WRONG
<div className="bg-white dark:bg-gray-900 text-black">
  <button className="bg-blue-500 text-white">Action</button>
</div>
```

### 3. Responsive Design (Mobile-First)
```tsx
<div className="
  w-full px-4
  sm:px-6
  md:px-8
  lg:max-w-6xl lg:mx-auto
">
  <div className="
    grid grid-cols-1
    sm:grid-cols-2
    lg:grid-cols-3
    xl:grid-cols-4
    gap-4 sm:gap-6 lg:gap-8
  ">
    {items.map(item => <Card key={item.id} {...item} />)}
  </div>
</div>
```

### 4. RTL/LTR Support
```tsx
// Use logical properties for RTL support
<div className="
  ps-4 pe-4           {/* padding-inline-start/end */}
  ms-auto me-2        {/* margin-inline-start/end */}
  start-0 end-0       {/* inset-inline-start/end */}
  text-start          {/* text-align: start */}
  border-s-4          {/* border-inline-start */}
  rtl:space-x-reverse
">
  RTL-aware content
</div>
```

### 5. Container Queries
```tsx
<div className="@container">
  <div className="flex flex-col @sm:flex-row @md:gap-4 @lg:p-6">
    <div className="@sm:w-1/2">Left</div>
    <div className="@sm:w-1/2">Right</div>
  </div>
</div>
```

### 6. State Variants
```tsx
<button className="
  bg-primary text-primary-foreground
  hover:bg-primary/90
  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
  active:scale-95
  disabled:opacity-50 disabled:cursor-not-allowed
  group-hover:text-foreground
">
  Click Me
</button>
```

### 7. Animation Utilities
```tsx
<div className="animate-spin">Loading...</div>
<div className="animate-pulse">Skeleton</div>

<button className="
  transition-all duration-200 ease-in-out
  hover:scale-105 hover:shadow-lg
">
  Smooth hover
</button>
```

### 8. Layout Patterns
```tsx
// Flexbox
<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
  <div className="flex-1">Grows</div>
  <div className="flex-shrink-0">Fixed</div>
</div>

// Grid
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-8">Main</div>
  <div className="col-span-12 md:col-span-4">Sidebar</div>
</div>

// Auto-fit
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### 9. Typography Classes
```tsx
<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
  Page Title
</h1>
<h2 className="scroll-m-20 text-3xl font-semibold tracking-tight border-b pb-2">
  Section
</h2>
<p className="leading-7 [&:not(:first-child)]:mt-6">Body text</p>
<p className="text-xl text-muted-foreground">Lead text</p>
<p className="text-sm text-muted-foreground">Muted text</p>
```

### 10. Form Styling
```tsx
<input className="
  w-full h-10 px-3 py-2
  rounded-md border border-input bg-background text-sm
  placeholder:text-muted-foreground
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
  disabled:cursor-not-allowed disabled:opacity-50
" />
```

## Checklist

- [ ] Using semantic tokens (bg-background, text-foreground)
- [ ] No hardcoded colors (bg-white, text-black)
- [ ] Mobile-first responsive design
- [ ] RTL support with logical properties (ps-, pe-, ms-, me-)
- [ ] Proper focus states for accessibility
- [ ] Dark mode works via tokens
- [ ] Consistent spacing using scale
- [ ] Hover/focus states on interactive elements

## Anti-Patterns

### 1. Hardcoded Colors
```tsx
// BAD
<div className="bg-white text-black border-gray-200">

// GOOD
<div className="bg-background text-foreground border-border">
```

### 2. Physical Properties
```tsx
// BAD (breaks in RTL)
<div className="ml-4 pl-2 text-left border-l-2">

// GOOD
<div className="ms-4 ps-2 text-start border-s-2">
```

### 3. Desktop-First
```tsx
// BAD
<div className="w-1/3 md:w-1/2 sm:w-full">

// GOOD (mobile-first)
<div className="w-full sm:w-1/2 md:w-1/3">
```

### 4. Missing State Styles
```tsx
// BAD
<button className="bg-primary text-white">Click</button>

// GOOD
<button className="
  bg-primary text-primary-foreground
  hover:bg-primary/90 focus:ring-2 active:scale-95
  disabled:opacity-50
">Click</button>
```

## Edge Cases

### Print Styles
```tsx
<div className="print:hidden">Hidden when printing</div>
<div className="hidden print:block">Only when printing</div>
```

### Reduced Motion
```tsx
<div className="animate-bounce motion-reduce:animate-none">
  Respects user preference
</div>
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| Component creation | `shadcn` |
| Semantic elements | `semantic` |
| Component logic | `react` |

## Self-Improvement

```bash
npm view tailwindcss version    # Current: 4.1.x
```

- Docs: https://tailwindcss.com/docs

## Quick Reference

### Breakpoints
| Prefix | Min Width |
|--------|-----------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

### Common Tokens
| Token | Usage |
|-------|-------|
| `bg-background` | Page background |
| `bg-card` | Card background |
| `bg-muted` | Muted sections |
| `bg-primary` | Primary actions |
| `bg-destructive` | Danger actions |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text |
| `border-border` | Default borders |

### Logical Properties
| Physical | Logical |
|----------|---------|
| `ml-*` | `ms-*` |
| `mr-*` | `me-*` |
| `pl-*` | `ps-*` |
| `pr-*` | `pe-*` |
| `left-*` | `start-*` |
| `right-*` | `end-*` |
| `text-left` | `text-start` |
| `border-l-*` | `border-s-*` |

**Rule**: Semantic tokens. Mobile-first. RTL-aware. No hardcoded colors.
