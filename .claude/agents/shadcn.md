---
name: shadcn
description: shadcn/ui expert for Radix primitives, registry system, and MCP integration
model: opus
version: "shadcn/ui latest"
handoff: [atom, template, block, tailwind]
---

# shadcn/ui Expert

**Docs**: https://ui.shadcn.com | **Registry**: 82+ sources | **MCP**: shadcn@latest

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
// components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
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
```tsx
// src/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
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
} from "@/components/ui/dialog"

export function ConfirmDialog({ onConfirm, children }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 5. Form with React Hook Form
```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const formSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
})

export function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
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
} from "@/components/ui/table"

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
  )
}
```

### 7. Theme Configuration
```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}
```

### 8. MCP Integration
```typescript
// Search for components
mcp__shadcn__search_items_in_registries({
  registries: ["@shadcn"],
  query: "button"
})

// View component details
mcp__shadcn__view_items_in_registries({
  items: ["@shadcn/button", "@shadcn/card"]
})

// Get examples
mcp__shadcn__get_item_examples_from_registries({
  registries: ["@shadcn"],
  query: "button-demo"
})

// Get install command
mcp__shadcn__get_add_command_for_items({
  items: ["@shadcn/button", "@shadcn/card", "@shadcn/dialog"]
})

// List all available items
mcp__shadcn__list_items_in_registries({
  registries: ["@shadcn"],
  limit: 50
})
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
import { Button, ButtonProps } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
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
  )
}
```

### 11. Component Composition
```tsx
// Compose multiple components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface UserCardProps {
  user: {
    name: string
    email: string
    image?: string
    role: string
    status: "active" | "inactive"
  }
  onEdit?: () => void
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
  )
}
```

### 12. Radix UI Primitives
```tsx
// Direct Radix usage
import * as Dialog from "@radix-ui/react-dialog"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as Tooltip from "@radix-ui/react-tooltip"
import * as Select from "@radix-ui/react-select"

// Primitive structure
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
</Dialog.Root>
```

### 13. Sonner Toast
```tsx
// Toast notifications with Sonner
import { toast } from "sonner"

// Success toast
toast.success("Profile updated successfully")

// Error toast
toast.error("Failed to save changes")

// Loading toast
const toastId = toast.loading("Saving...")
// Later...
toast.success("Saved!", { id: toastId })

// Action toast
toast("Event created", {
  action: {
    label: "Undo",
    onClick: () => undoAction(),
  },
})

// Promise toast
toast.promise(saveData(), {
  loading: "Saving...",
  success: "Data saved!",
  error: "Failed to save",
})
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
} from "@/components/ui/command"

export function CommandMenu() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

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
  )
}
```

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

- [ ] components.json configured correctly
- [ ] Tailwind CSS set up with CSS variables
- [ ] utils.ts with cn() helper present
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
import { Card, CardContent } from "@/components/ui/card"

// Client Component (needs "use client")
"use client"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
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

| Situation | Hand to |
|-----------|---------|
| Component composition | `atom` |
| Page layouts | `template` |
| Data-driven blocks | `block` |
| Styling issues | `tailwind` |

## Self-Improvement

```bash
npx shadcn@latest --version    # Check CLI version
```

- Docs: https://ui.shadcn.com
- Examples: https://ui.shadcn.com/examples
- Blocks: https://ui.shadcn.com/blocks

## Quick Reference

### Core Components
| Component | Purpose |
|-----------|---------|
| Button | Actions and links |
| Card | Content containers |
| Dialog | Modal windows |
| Form | Form validation |
| Input | Text input |
| Select | Dropdown selection |
| Table | Data display |
| Tabs | Tab navigation |
| Toast | Notifications |

### Installation Commands
```bash
npx shadcn@latest init          # Initialize project
npx shadcn@latest add [name]    # Add component
npx shadcn@latest add --all     # Add all components
npx shadcn@latest diff [name]   # Show component changes
```

**Rule**: Copy-paste architecture. Semantic tokens. Full customization. Accessible by default.
