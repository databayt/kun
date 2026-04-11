# Sidebar Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | config-driven (role-based nav) | production | 3 | **yes** |
| codebase | catalog (16 variants) | production | 16 | no |
| mkan | mixed (atom + legacy row) | development | 4 | no |
| shifa | basic template | development | 2 | no |
| souq | single-file JS | development | 1 | no |

## Canonical: hogwarts

### File Structure

```
src/components/template/platform-sidebar/
  config.ts       # Navigation items, role visibility, groups
  content.tsx      # Sidebar render component
  icons.tsx        # Icon registry for sidebar items
```

### Architecture

**Config-driven navigation:**
```typescript
// config.ts
export const sidebarConfig: SidebarConfig = {
  groups: [
    {
      label: "Dashboard",
      items: [
        { title: "Overview", href: "/dashboard", icon: "LayoutDashboard", roles: ["ADMIN", "TEACHER"] },
        { title: "Analytics", href: "/analytics", icon: "BarChart", roles: ["ADMIN"] },
      ]
    },
    {
      label: "Listings",
      items: [
        { title: "Students", href: "/students", icon: "GraduationCap" },
        { title: "Teachers", href: "/teachers", icon: "Users" },
      ]
    },
  ]
}
```

The sidebar reads config, filters items by user role, and renders using shadcn's `Sidebar`, `SidebarGroup`, `SidebarMenuItem` primitives.

### Codebase Catalog

Codebase offers 16 sidebar variants (sidebar-01 through sidebar-16) for different layouts:
- Collapsible, floating, icon-only, file-tree, calendar, dialog, dual-panel, etc.
- Pick a variant, copy to your product repo, customize with your config

### Usage

1. Pick a sidebar variant from codebase catalog
2. Create `config.ts` with your navigation items and role visibility
3. Create `icons.tsx` mapping icon names to lucide-react components
4. Render in your layout

## Clone

```
/clone pattern:sidebar
/clone hogwarts:src/components/template/platform-sidebar/
/clone codebase:src/registry/default/templates/sidebar-01  # or any variant
```
