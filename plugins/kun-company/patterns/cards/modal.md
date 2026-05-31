# Modal Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | full-system (core + CRUD + route) | production | 13 | **yes** |
| codebase | core-subset | partial | 8 | no |
| mkan | core-subset (has data param) | development | 9 | no |
| shifa | minimal-subset | development | 7 | no |
| souq | none | none | 0 | no |

## Canonical: hogwarts

### File Structure

```
src/components/atom/modal/
  types.ts              # ModalState, ModalContextProps
  context.tsx           # ModalContext, ModalProvider, useModal hook
  modal.tsx             # Full-screen overlay modal
  ui.tsx                # Simpler modal with theme-aware background
  crud-modal.tsx        # Dialog-based CRUD modal with auto-close
  crud-form.tsx         # Generic form with zod + server action + toast
  use-crud-modal.ts     # CRUD state machine (create/edit/view/delete)
  modal-form-layout.tsx # Two-column layout (description + form)
  modal-footer.tsx      # Multi-step footer with progress bar
  route-modal.tsx       # Route-aware modal (opens on mount, navigates back on close)
  carousel.tsx          # Step carousel (placeholder)
  indicator.tsx         # Dot-based step indicator
  step.ts               # Step types
```

### Architecture

Two modal systems for different use cases:

**useModal** — Global context toggle (one modal at a time)
- `openModal(id?)` → sets `{ open: true, id }`
- `closeModal()` → sets `{ open: false, id: null }`
- Used with: `Modal` (full-screen overlay), `RouteModal` (URL-based)
- Best for: simple create/edit flows, route-intercepted modals

**useCrudModal<T>** — Local typed state machine (per-consumer)
- `openCreate()`, `openEdit(data)`, `openView(data)`, `openDelete(data)`
- Tracks: `mode`, `data: T | null`, `loading`
- Boolean getters: `isCreate`, `isEdit`, `isView`, `isDelete`
- Used with: `CrudModal` (Dialog-based)
- Best for: record-level CRUD operations

### Key Types

```typescript
interface ModalState { open: boolean; id: string | null }

interface ModalContextProps {
  modal: ModalState
  openModal: (id?: string | null) => void
  closeModal: () => void
}

// CrudModal props
interface CrudModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
  loading?: boolean
  autoCloseDelay?: number  // default 500ms
  children: React.ReactNode
}
```

### Usage Example

**Simple modal (useModal):**
```tsx
const { modal, openModal, closeModal } = useModal()

<Button onClick={() => openModal()}>Create</Button>
<Button onClick={() => openModal(record.id)}>Edit</Button>

<Modal open={modal.open} onClose={closeModal}>
  <Form mode={modal.id ? "edit" : "create"} id={modal.id} />
</Modal>
```

**CRUD modal (useCrudModal):**
```tsx
const crud = useCrudModal<User>()

<Button onClick={crud.openCreate}>Create</Button>
<ActionMenu onEdit={() => crud.openEdit(user)} onDelete={() => crud.openDelete(user)} />

<CrudModal open={crud.state.open} onOpenChange={(open) => !open && crud.close()}>
  {crud.isCreate && <CreateForm />}
  {crud.isEdit && <EditForm data={crud.state.data} />}
  {crud.isDelete && <DeleteConfirm data={crud.state.data} />}
</CrudModal>
```

## Clone

```
/clone pattern:modal
/clone hogwarts:src/components/atom/modal/
```

## Migration

**From core-subset (mkan/shifa/codebase):**
1. Add missing files: crud-modal.tsx, crud-form.tsx, use-crud-modal.ts, modal-form-layout.tsx, modal-footer.tsx, route-modal.tsx
2. Rename `type.ts` to `types.ts` (mkan/shifa)
3. Add `data` param to openModal signature (hogwarts lacks this — adopt from mkan)
4. Remove redundant `provider.tsx` (mkan — context.tsx already provides)
