# Columns Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | factory-function with i18n | production | 20 | **yes** |
| codebase | example (task columns) | partial | 2 | no |
| shifa | single-file (appointments) | development | 2 | no |
| mkan | none | none | 0 | no |
| souq | none | none | 0 | no |

## Canonical: hogwarts

### Architecture

Every table feature has a `columns.tsx` file exporting a factory function:

```typescript
"use client"

export type EntityRow = {
  id: string
  name: string
  // flat, serializable fields only
}

export const getEntityColumns = (
  dictionary?: Dictionary["entity"],
  lang?: Locale,
  options?: ColumnOptions
): ColumnDef<EntityRow>[] => [
  // column definitions
]
```

### Key Rules

1. **Always a factory function** — never export pre-generated columns at module scope
2. **Call inside useMemo** — `const columns = useMemo(() => getColumns(dict, lang), [dict, lang])`
3. **Dictionary-driven labels** — `title={dictionary?.name ?? "Name"}` for i18n
4. **DataTableColumnHeader** — every sortable column uses it
5. **ActionMenu** — last column for row-level CRUD actions
6. **Filter meta** — `meta.variant` and `meta.options` for filterable columns
7. **Flat row type** — no nested objects, no Prisma relations, serializable only

### Usage Example

```typescript
"use client"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/table/data-table-column-header"

export type UserRow = { id: string; name: string; email: string; role: string; status: string }

export const getUserColumns = (
  dictionary?: Dictionary["users"],
  lang?: Locale
): ColumnDef<UserRow>[] => [
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title={dictionary?.name ?? "Name"} />,
    enableColumnFilter: true,
    meta: { label: dictionary?.name ?? "Name", variant: "text" as const },
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title={dictionary?.status ?? "Status"} />,
    cell: ({ row }) => <Badge variant={row.original.status === "active" ? "default" : "secondary"}>{row.original.status}</Badge>,
    enableColumnFilter: true,
    meta: { label: dictionary?.status ?? "Status", variant: "select" as const, options: statusOptions },
  },
]
```

## Clone

```
/clone pattern:columns
```
