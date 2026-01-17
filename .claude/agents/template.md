---
name: template
description: Template expert - Full-page layouts and major sections
model: opus
version: "shadcn/ui"
handoff: [atom, block, tailwind]
---

# Template Expert

**Philosophy**: Production-ready page layouts and major UI sections.

## What is a Template?

A template is a **complete page layout or major section**:
- Hero sections with CTA
- Headers with navigation
- Sidebars with menu
- Footers with links
- Dashboard layouts
- Auth pages (login, register)

## Location

```
src/registry/default/templates/
├── hero-01/
│   └── page.tsx
├── header-01/
│   └── page.tsx
├── sidebar-01/
│   └── page.tsx
├── login-01/
│   └── page.tsx
├── dashboard-01/
│   └── page.tsx
├── subscription-01/
│   └── page.tsx
└── footer-01/
    └── page.tsx
```

## Related Resources

- **Skill**: `~/.claude/commands/template.md` - CLI commands for template operations
- **Memory**: `~/.claude/memory/template.json` - Template registry tracking

## Template Pattern

```tsx
// src/components/template/hero-01/page.tsx
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

## Template Categories

### Hero Sections
```tsx
// Centered hero with gradient
export default function HeroCentered() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10" />
      <div className="container relative">
        {/* Hero content */}
      </div>
    </section>
  )
}

// Split hero with image
export default function HeroSplit() {
  return (
    <section className="container grid gap-8 py-24 md:grid-cols-2 md:py-32">
      <div className="flex flex-col justify-center gap-4">
        {/* Text content */}
      </div>
      <div className="relative aspect-square">
        {/* Image/illustration */}
      </div>
    </section>
  )
}
```

### Headers
```tsx
// Header with navigation
export default function Header01() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden md:flex items-center gap-6">
            <NavLink href="/features">Features</NavLink>
            <NavLink href="/pricing">Pricing</NavLink>
            <NavLink href="/docs">Docs</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost">Sign In</Button>
          <Button>Get Started</Button>
        </div>
      </div>
    </header>
  )
}
```

### Sidebars
```tsx
// Collapsible sidebar
export default function Sidebar01() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Logo />
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          <SidebarItem icon={Home} label="Dashboard" href="/" />
          <SidebarItem icon={Users} label="Users" href="/users" />
          <SidebarItem icon={Settings} label="Settings" href="/settings" />
        </nav>
      </ScrollArea>
      <div className="border-t p-4">
        <UserDisplay user={currentUser} />
      </div>
    </aside>
  )
}
```

### Footers
```tsx
// Multi-column footer
export default function Footer01() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              Building the future of education technology.
            </p>
          </div>
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>
        <Separator className="my-8" />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            © 2024 Company. All rights reserved.
          </p>
          <div className="flex gap-4">
            <SocialIcon href="#" icon={Twitter} />
            <SocialIcon href="#" icon={Github} />
          </div>
        </div>
      </div>
    </footer>
  )
}
```

### Authentication
```tsx
// Login template
export default function Login01() {
  return (
    <div className="container flex h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <Button variant="outline" className="w-full">
              <Icons.google className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <form className="space-y-4">
            <FormField label="Email">
              <Input type="email" placeholder="name@example.com" />
            </FormField>
            <FormField label="Password">
              <Input type="password" />
            </FormField>
            <Button className="w-full">Sign In</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Dashboard Layouts
```tsx
// Dashboard with sidebar
export default function Dashboard01() {
  return (
    <div className="flex h-screen">
      <Sidebar01 />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
          <Breadcrumb />
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <div className="p-6">
          {/* Page content */}
        </div>
      </main>
    </div>
  )
}
```

## Template Structure

```tsx
// Standard template structure
export default function TemplateName() {
  return (
    <section className="container py-16 md:py-24">
      {/* Optional: Background/decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />

      {/* Header area */}
      <div className="mb-12 text-center">
        <Badge>Label</Badge>
        <h2 className="mt-4 text-3xl font-bold">Section Title</h2>
        <p className="mt-2 text-muted-foreground">Section description</p>
      </div>

      {/* Main content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Content items */}
      </div>

      {/* Optional: CTA */}
      <div className="mt-12 text-center">
        <Button size="lg">Call to Action</Button>
      </div>
    </section>
  )
}
```

## Responsive Patterns

```tsx
// Mobile-first responsive
<section className="
  container
  py-12 md:py-24        // Spacing scales up
  px-4 md:px-6          // Padding scales up
">
  <div className="
    grid
    grid-cols-1 md:grid-cols-2 lg:grid-cols-3    // Columns scale up
    gap-4 md:gap-6 lg:gap-8                       // Gaps scale up
  ">
    {/* Items */}
  </div>
</section>
```

## Naming Convention

Templates follow `{type}-{number}` pattern:
- `hero-01`, `hero-02`, `hero-03`
- `header-01`, `header-02`
- `sidebar-01`, `sidebar-02`
- `login-01`, `register-01`
- `dashboard-01`, `dashboard-02`

## Registry Format

```typescript
// For CLI consumption
{
  name: "hero-01",
  type: "registry:template",
  description: "Centered hero section with gradient background",
  files: [{ path: "templates/hero-01/page.tsx", type: "registry:page" }],
  dependencies: ["@/components/ui/button", "@/components/ui/badge"],
  registryDependencies: ["button", "badge"],
  categories: ["landing"],
  meta: { iframeHeight: "600px" }
}
```

## Checklist

- [ ] Self-contained (no external state dependencies)
- [ ] Responsive (mobile → tablet → desktop)
- [ ] Themeable (light/dark mode)
- [ ] Accessible (semantic HTML, ARIA)
- [ ] Production-ready styling
- [ ] Uses shadcn/ui components
- [ ] RTL-compatible
- [ ] Exported as default function

**Rule**: Complete sections. Responsive. Production-ready.
