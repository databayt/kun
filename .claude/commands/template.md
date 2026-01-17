# Template Command

Create and manage templates - full-page layouts and major UI sections.

## Usage
```
/template <name>           → Create new template
/template list             → List all registered templates
/template preview <name>   → Preview template with code
/template build            → Rebuild template registry
```

## Argument: $ARGUMENTS

## Instructions

Parse the argument and execute accordingly:

### If argument is a name (e.g., "hero-01"):

1. **Check if template exists**
   - Look in `src/components/template/{name}/` or `src/registry/default/templates/{name}/`
   - If exists, show preview with code

2. **Create new template**
   - Identify template category (hero, header, sidebar, footer, login, dashboard)
   - Create template following the pattern:
     ```
     src/registry/default/templates/{name}/
     ├── page.tsx              # Main template component
     └── components/           # Supporting components (if needed)
     ```
   - Apply design rules:
     - Self-contained (no external state dependencies)
     - Responsive (mobile → tablet → desktop)
     - Themeable (light/dark mode)
     - Uses shadcn/ui components
     - RTL-compatible (ms/me, ps/pe)
     - Semantic color tokens

3. **Register in registry**
   - Add entry to `src/registry/registry-templates.ts`
   - Run `pnpm build:templates` to rebuild registry

4. **Generate preview**
   - Templates are previewed at `/templates/{name}`

### If argument is "list":

1. Read `src/registry/registry-templates.ts`
2. Display all registered templates with categories
3. Show total count grouped by category

### If argument is "preview <name>":

1. Read template source code
2. Display with syntax highlighting
3. Show used UI components
4. List registry dependencies

### If argument is "build":

1. Run `pnpm build:templates`
2. Report registry build results
3. Show count of templates built

## Template Pattern

```tsx
// src/registry/default/templates/hero-01/page.tsx
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function Hero01() {
  return (
    <section className="container py-24 md:py-32">
      <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-4 text-center">
        <Badge variant="secondary" className="rounded-full">
          Announcing our next round of funding
        </Badge>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Build your next project with our platform
        </h1>

        <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          The fastest way to build and deploy your applications.
          Start for free, scale as you grow.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg">Get Started</Button>
          <Button size="lg" variant="outline">
            Learn More
          </Button>
        </div>
      </div>
    </section>
  )
}
```

## Output

```
✅ Template "{name}" created successfully!

📁 Files created:
  - src/registry/default/templates/{name}/page.tsx
  - public/r/templates/default/{name}.json

📦 UI Components used:
  - button (shadcn)
  - badge (shadcn)
  - card (shadcn)

🔗 Preview at: /en/templates/{name}
```

## Categories

When creating templates, classify into:
- hero - Hero sections with CTA
- header - Navigation headers
- sidebar - Side navigation
- footer - Multi-column footers
- login - Authentication pages
- dashboard - Dashboard layouts
- pricing - Pricing sections
- feature - Feature showcases
- testimonial - Customer testimonials
- cta - Call-to-action sections

## Naming Convention

Templates follow `{type}-{number}` pattern:
- `hero-01`, `hero-02`, `hero-03`
- `header-01`, `header-02`
- `sidebar-01`, `sidebar-02`
- `login-01`, `register-01`
- `dashboard-01`, `dashboard-02`
