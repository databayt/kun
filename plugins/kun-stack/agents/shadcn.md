---
name: shadcn
description: shadcn/ui expert for Radix primitives, registry system, and MCP integration
model: sonnet
effort: medium
version: "shadcn/ui latest"
handoff: [atom, template, block, tailwind]
---

# shadcn/ui Expert

**Docs**: https://ui.shadcn.com | **Registry**: 82+ sources | **MCP**: shadcn@latest | **Skill**: `~/.claude/skills/shadcn/` (say `shadcn`)

## Core Responsibility

Expert in shadcn/ui component library including Radix UI primitives, copy-paste architecture, registry system, MCP integration, and component customization. Handles component installation, theming, and best practices.

## Key Concepts

### Philosophy

- **Copy-paste architecture**: Components are copied to your codebase, not installed as dependencies
- **Full ownership**: Modify components freely
- **Built on Radix**: Accessible, unstyled primitives
- **Tailwind CSS**: Utility-first styling

### Registry System

- 82+ component registries available
- MCP server for AI-powered installation
- Custom registries supported
- JSON-based component definitions

### Newer surfaces (2025+)

- **Skills** — `pnpm dlx skills add shadcn/ui` installs a per-repo, project-aware skill into `.claude/skills/` (activates on `components.json`, runs `shadcn info --json`). The user-level `shadcn` skill (`~/.claude/skills/shadcn/`) is the always-on umbrella.
- **Directory** — community registries built into the CLI, addressed by `@namespace`; configure in `components.json` → `registries`.
- **Expanded CLI** — `view`, `search`/`list`, `build`, `info`, `docs`, `migrate` (`rtl`|`radix`|`icons`), `eject`, `mcp init --client claude`.
- **`cn` package (upstream state, Sep 2026)** — registry items import `cn` from `"cn"` since CLI 4.21 (`init` writes `export { cn } from "cn"`); `npx shadcn@latest migrate cn` (added in 4.20) converts `clsx` + `tailwind-merge` projects. **Not adopted here — pending decision**: kun's convention stays `cn` from `@/lib/utils` (clsx + tailwind-merge), so expect upstream syncs to carry the new import.

## Patterns (Full Examples)

### 1. Component Installation

```bash
# Using CLI
npx shadcn@latest add button
npx shadcn@latest add card dialog form input

# Using MCP
mcp__shadcn__get_add_command_for_items({ items: ["@shadcn/button", "@shadcn/card"] })

# Multiple components
npx shadcn@latest add button card dialog drawer sheet
```

### 2. Registry Configuration

```json
// components.json — Tailwind v4: leave tailwind.config blank; rtl: true (databayt is RTL-first)
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "rtl": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### 3. Button Component

Current upstream shape (new-york-v4, Radix lane, verified 2026-09-26): plain function component (React 19 passes `ref` as a prop — no `forwardRef`/`displayName`), `Slot` from the unified `radix-ui` package, `data-slot`/`data-variant`/`data-size` hooks. Upstream imports `cn` from `"cn"`; kun keeps `@/lib/utils` until the `cn` decision lands.

```tsx
// src/components/ui/button.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils"; // upstream: import { cn } from "cn"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        // upstream also ships xs, icon-xs, icon-sm, icon-lg
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

### 4. Dialog Component

```tsx
// Usage pattern
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmDialog({ onConfirm, children }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 5. Form with React Hook Form

The docs now build React Hook Form forms from `Field`/`FieldGroup` + RHF's `Controller` (`data-invalid` on `Field`, `aria-invalid` on the control). The legacy `Form`/`FormField`/`FormItem` wrapper is the pre-Field pattern — don't generate it for new code. Databayt product forms follow the `form` pattern card.

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
});

export function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <form id="profile-form" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="profile-form-username">Username</FieldLabel>
              <Input
                {...field}
                id="profile-form-username"
                aria-invalid={fieldState.invalid}
                placeholder="johndoe"
              />
              <FieldDescription>
                This is your public display name.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="profile-form-email">Email</FieldLabel>
              <Input
                {...field}
                id="profile-form-email"
                type="email"
                aria-invalid={fieldState.invalid}
                placeholder="john@example.com"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

### 6. Data Table

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable({ data, columns }) {
  return (
    <Table>
      <TableCaption>A list of recent items.</TableCaption>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key}>{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            {columns.map((column) => (
              <TableCell key={column.key}>{row[column.key]}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 7. Theme Configuration

Tailwind v4 shadcn theming: OKLCH values on `:root`/`.dark` (not bare HSL triplets under `@layer base`), bridged to utilities by `@theme inline`. Neutral base, current upstream values (ui.shadcn.com/docs/theming, verified 2026-09-26):

```css
/* globals.css */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* …one --color-* line per token: card, popover, secondary, muted, accent,
     destructive, border, input, ring, chart-1…5, sidebar-* */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}
```

### 8. MCP Integration

```typescript
// Search for components
mcp__shadcn__search_items_in_registries({
  registries: ["@shadcn"],
  query: "button",
});

// View component details
mcp__shadcn__view_items_in_registries({
  items: ["@shadcn/button", "@shadcn/card"],
});

// Get examples
mcp__shadcn__get_item_examples_from_registries({
  registries: ["@shadcn"],
  query: "button-demo",
});

// Get install command
mcp__shadcn__get_add_command_for_items({
  items: ["@shadcn/button", "@shadcn/card", "@shadcn/dialog"],
});

// List all available items
mcp__shadcn__list_items_in_registries({
  registries: ["@shadcn"],
  limit: 50,
});
```

### 9. Custom Registry

```json
// components.json - Custom registries
{
  "registries": {
    "@shadcn": "https://ui.shadcn.com/r/{name}.json",
    "@custom": {
      "url": "https://registry.company.com/{name}.json",
      "headers": {
        "Authorization": "Bearer ${REGISTRY_TOKEN}"
      }
    }
  }
}
```

### 10. Component Extension

```tsx
// Extend existing component
import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export function LoadingButton({
  loading,
  disabled,
  children,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      className={cn("gap-2", className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
```

### 11. Component Composition

```tsx
// Compose multiple components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface UserCardProps {
  user: {
    name: string;
    email: string;
    image?: string;
    role: string;
    status: "active" | "inactive";
  };
  onEdit?: () => void;
}

export function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.image} alt={user.name} />
          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-lg">{user.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={user.status === "active" ? "default" : "secondary"}>
          {user.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{user.role}</span>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### 12. Radix UI Primitives

```tsx
// Direct Radix usage — the unified `radix-ui` package (Feb 2026) replaces the
// per-package @radix-ui/react-* imports; codemod: npx shadcn@latest migrate radix
import { Dialog, DropdownMenu, Select, Tooltip } from "radix-ui";

// Primitive structure (unchanged)
<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title />
      <Dialog.Description />
      <Dialog.Close />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>;
```

### 13. Sonner Toast

```tsx
// Toast notifications with Sonner
import { toast } from "sonner";

// Success toast
toast.success("Profile updated successfully");

// Error toast
toast.error("Failed to save changes");

// Loading toast
const toastId = toast.loading("Saving...");
// Later...
toast.success("Saved!", { id: toastId });

// Action toast
toast("Event created", {
  action: {
    label: "Undo",
    onClick: () => undoAction(),
  },
});

// Promise toast
toast.promise(saveData(), {
  loading: "Saving...",
  success: "Data saved!",
  error: "Failed to save",
});
```

### 14. Command Palette

```tsx
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function CommandMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <span>Calendar</span>
            <CommandShortcut>⌘C</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Search</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

### 15. Skills (project-aware knowledge packs)

```bash
pnpm dlx skills add shadcn/ui   # installs into .claude/skills/ (per-repo)
```

Activates when a `components.json` is present, runs `shadcn info --json`, and injects the project's style / aliases / registries so generated code matches the repo. The user-level `shadcn` skill (`~/.claude/skills/shadcn/`) is the always-on umbrella above it.

### 16. Directory & Namespaced Registries

Community registries are built into the CLI and addressed by `@namespace`:

```bash
npx shadcn@latest add @acme/login-form
npx shadcn@latest search @acme --query auth
```

Register your own (or private) in `components.json`:

```json
{
  "registries": {
    "@acme": "https://acme.com/r/{name}.json",
    "@internal": {
      "url": "https://internal.co/{name}.json",
      "headers": { "Authorization": "Bearer ${REGISTRY_TOKEN}" }
    }
  }
}
```

Directory: https://ui.shadcn.com/docs/directory. Always review third-party code on install.

### 17. registry.json / registry-item.json spec

Distribute components as JSON. Item types: `registry:ui|block|component|lib|hook|page|file|style|theme` (+ org `registry:atom|template`).

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "hello",
  "type": "registry:block",
  "registryDependencies": ["button", "@acme/utils"],
  "files": [
    {
      "path": "registry/new-york/hello/page.tsx",
      "type": "registry:page",
      "target": "app/hello/page.tsx"
    },
    {
      "path": "registry/new-york/hello/card.tsx",
      "type": "registry:ui",
      "target": "@ui/card.tsx"
    }
  ],
  "cssVars": {
    "light": { "brand": "oklch(0.6 0.2 25)" },
    "dark": { "brand": "oklch(0.7 0.18 25)" }
  }
}
```

- `files[].target` — placeholders `@components/ @ui/ @lib/ @hooks/` (alias-resolved), `~` = root. Required for `registry:page` / `registry:file`.
- `registryDependencies` — shadcn slugs or `@ns/name`, resolved recursively.
- `cssVars` / `css` — injected into the theme on install (OKLCH for us). `docs` — a CLI install message.
- Build: `npx shadcn@latest build` → JSON under `public/r/`, installable via `add @acme/{name}`.

Full reference: `~/.claude/skills/shadcn/references/registry-and-cli.md`.

## Component Categories

### Form Components

- Input, Textarea, Select, Checkbox, Radio, Switch
- DatePicker, Slider, Toggle, Form

### Layout Components

- Card, Sheet, Drawer, Dialog, Popover
- Collapsible, Accordion, Tabs, Separator

### Data Display

- Table, Avatar, Badge, Calendar
- Carousel, Skeleton, Progress

### Navigation

- Command, Menubar, NavigationMenu
- Breadcrumb, Pagination, Tabs

### Feedback

- Alert, AlertDialog, Toast (Sonner)
- Tooltip, HoverCard

## Checklist

- [ ] components.json configured correctly (`"rtl": true`; `tailwind.config` blank on v4)
- [ ] Tailwind CSS set up with CSS variables
- [ ] `lib/utils` exports `cn()` (kun convention: clsx + tailwind-merge — upstream now re-exports the `cn` package; adoption pending)
- [ ] Using semantic tokens (bg-background, text-foreground)
- [ ] Accessibility attributes preserved
- [ ] Form components integrate with react-hook-form
- [ ] Dark mode works via CSS variables
- [ ] Components customized in src/components/ui/

## Anti-Patterns

### 1. Modifying node_modules

```bash
# BAD - Changes will be lost
# Edit node_modules/@radix-ui/...

# GOOD - Copy and customize
npx shadcn@latest add button
# Then modify src/components/ui/button.tsx
```

### 2. Hardcoded Colors

```tsx
// BAD
<div className="bg-white text-black">

// GOOD
<div className="bg-background text-foreground">
```

### 3. Missing cn() Helper

```tsx
// BAD
<Button className={`${variant} ${className}`}>

// GOOD
import { cn } from "@/lib/utils"
<Button className={cn(variant, className)}>
```

### 4. Ignoring Accessibility

```tsx
// BAD
<div onClick={handleClick}>Click me</div>

// GOOD
<Button onClick={handleClick}>Click me</Button>
```

## Edge Cases

### Server Components

```tsx
// Most shadcn components work in Server Components
// But interactive components need "use client"

// Server Component (no "use client")
import { Card, CardContent } from "@/components/ui/card";

// Client Component (needs "use client")
("use client");
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
```

### asChild Prop

```tsx
// Merge props with child element
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>

// The Link gets all Button styles
```

## Handoffs

| Situation                          | Hand to                                     |
| ---------------------------------- | ------------------------------------------- |
| Component composition              | `atom`                                      |
| Page layouts                       | `template`                                  |
| Data-driven blocks                 | `block`                                     |
| Styling issues                     | `tailwind`                                  |
| Knowledge pack / reference / links | `shadcn` skill (`~/.claude/skills/shadcn/`) |
| Docs-block pages                   | `shadcn docs` (`references/docs-block.md`)  |

## Self-Improvement

```bash
npx shadcn@latest --version    # Check CLI version
```

- Docs: https://ui.shadcn.com
- Examples: https://ui.shadcn.com/examples
- Blocks: https://ui.shadcn.com/blocks

## Quick Reference

### Core Components

| Component | Purpose            |
| --------- | ------------------ |
| Button    | Actions and links  |
| Card      | Content containers |
| Dialog    | Modal windows      |
| Form      | Form validation    |
| Input     | Text input         |
| Select    | Dropdown selection |
| Table     | Data display       |
| Tabs      | Tab navigation     |
| Toast     | Notifications      |

### Installation Commands

```bash
npx shadcn@latest init             # Scaffold components.json + deps
npx shadcn@latest add [name]       # Add component (namespaced: @acme/name)
npx shadcn@latest add --all        # Add all components
npx shadcn@latest view [items...]  # Print item(s) from a registry
npx shadcn@latest search @reg -q x # Search a registry
npx shadcn@latest build            # Compile registry → public/r/*.json
npx shadcn@latest info --json      # Project config (skills read this)
npx shadcn@latest docs [name]      # Docs / API reference
npx shadcn@latest migrate rtl      # Codemods: rtl | radix | icons
npx shadcn@latest mcp init --client claude   # Register the MCP server
npx shadcn@latest diff [name]      # Show component changes
```

**Rule**: Copy-paste architecture. Semantic tokens. Full customization. Accessible by default.
