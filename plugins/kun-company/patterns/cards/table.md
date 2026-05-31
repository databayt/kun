# Table Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | full-block (14 sub-components + URL sync) | production | 41 | **yes** |
| codebase | dual-system (table/ + tablecn/) | partial | 129 | no |
| shifa | basic DataTable | development | 8 | no |
| mkan | primitive-only (shadcn table) | none | 1 | no |
| souq | none | none | 0 | no |

## Canonical: hogwarts

### File Structure

```
src/components/table/
  data-table.tsx              # Core DataTable (React.memo)
  use-data-table.ts           # URL-synced state via nuqs
  config.ts                   # Operators, pagination config
  types.ts                    # ColumnMeta augmentation, Option, FilterVariant
  actions.ts                  # Server action helpers for table data
  validation.ts               # Table validation utilities
  utils.ts                    # getCommonPinningStyles
  select-column.tsx           # Row selection column
  bulk-actions-toolbar.tsx    # Toolbar for bulk row actions
  data-table-action-bar.tsx   # Floating action bar on selection
  data-table-advanced-toolbar.tsx
  data-table-column-header.tsx
  data-table-date-filter.tsx
  data-table-enhanced.tsx
  data-table-faceted-filter.tsx
  data-table-filter-list.tsx
  data-table-filter-menu.tsx
  data-table-load-more.tsx    # Load-more pagination
  data-table-pagination.tsx   # Standard pagination
  data-table-range-filter.tsx
  data-table-see-more.tsx
  data-table-skeleton.tsx     # Loading skeleton
  data-table-slider-filter.tsx
  data-table-sort-list.tsx
  data-table-toolbar.tsx
  data-table-view-options.tsx
  use-auto-refresh.ts
  use-see-more.ts
  lib/
    parsers.ts                # URL param parsing
    export.ts                 # CSV/Excel export
    prisma-filter-columns.ts  # Prisma where clause builder
    db-utils.ts               # DB utilities
```

### Architecture

The table block follows the **triplet pattern**: `content.tsx` + `table.tsx` + `columns.tsx`

```
content.tsx (Server Component)
  ├── Fetches data from Prisma
  ├── Parses search params via nuqs/server
  ├── Transforms to flat row type
  └── Renders <Table initialData={data} total={total} />

table.tsx (Client Component)
  ├── Calls getColumns() inside useMemo
  ├── Creates table via useDataTable({ data, columns, pageCount })
  └── Renders <DataTable table={table} />

columns.tsx (Client Component)
  └── Exports getColumns(dictionary, lang, options) → ColumnDef<T>[]
```

### Key Types

```typescript
// DataTable props
interface DataTableProps<TData> {
  table: TanstackTable<TData>
  actionBar?: React.ReactNode
  paginationMode?: "pagination" | "load-more"
  hasMore?: boolean
  isLoading?: boolean
  onLoadMore?: () => void
  translations?: { loadMore?; loading?; noResults?; rowsSelected? }
}

// useDataTable params
interface UseDataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  pageCount: number
  debounceMs?: number              // default 300
  enableAdvancedFilter?: boolean
  enableClientFiltering?: boolean  // default false (server-side)
}

// Column meta augmentation
interface ColumnMeta {
  label?: string
  variant?: "text" | "number" | "range" | "date" | "select" | "multiSelect" | "boolean"
  options?: Option[]
  align?: "start" | "center" | "end"
}

// Config operators
dataTableConfig.textOperators     // iLike, notILike, eq, ne, isEmpty, isNotEmpty
dataTableConfig.numericOperators  // eq, ne, lt, lte, gt, gte, isBetween
dataTableConfig.dateOperators     // eq, ne, lt, gt, lte, gte, isBetween, isRelativeToToday
dataTableConfig.selectOperators   // eq, ne, isEmpty, isNotEmpty
```

### Usage Example

**columns.tsx:**
```tsx
"use client"
export type UserRow = { id: string; name: string; email: string; role: string }

export const getUserColumns = (
  dictionary?: Dictionary["users"],
  lang?: Locale
): ColumnDef<UserRow>[] => [
  { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title={dictionary?.name ?? "Name"} /> },
  { accessorKey: "email", header: ({ column }) => <DataTableColumnHeader column={column} title={dictionary?.email ?? "Email"} />,
    enableColumnFilter: true, meta: { variant: "text" } },
  { accessorKey: "role", header: ({ column }) => <DataTableColumnHeader column={column} title={dictionary?.role ?? "Role"} />,
    enableColumnFilter: true, meta: { variant: "select", options: roleOptions } },
]
```

**table.tsx:**
```tsx
"use client"
const columns = useMemo(() => getUserColumns(dictionary, lang), [dictionary, lang])
const { table } = useDataTable({ data, columns, pageCount })
return <DataTable table={table} />
```

**content.tsx:**
```tsx
export default async function UsersContent({ searchParams }) {
  const params = usersSearchParams.parse(searchParams)
  const { data, total } = await prisma.user.findMany({ where: buildWhere(params) })
  return <UsersTable initialData={data} total={total} />
}
```

## Clone

```
/clone pattern:table
/clone hogwarts:src/components/table/
```

## Migration

**From basic DataTable (shifa):**
1. Replace simple DataTable with canonical version
2. Add useDataTable hook for URL-synced state
3. Convert static columns to getColumns() factory for i18n
4. Add filter meta to columns for advanced filtering

**From no table (mkan/souq):**
1. Install table block from codebase
2. Create columns.tsx with getColumns() factory
3. Create table.tsx with useDataTable hook
4. Create content.tsx as server component for data fetching
