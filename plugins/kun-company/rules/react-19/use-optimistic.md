---
domain: react-19
severity: info
applies-to: ["**/content.tsx", "**/*-list.tsx", "**/form.tsx"]
since: "React 19.0"
---

# Optimistic UI with useOptimistic

For mutations where the result is predictable (toggle, add row, delete), render the optimistic value immediately with `useOptimistic` instead of awaiting the round-trip. React auto-reverts to real state if the action returns an error.

## Good

```tsx
"use client";
import { useOptimistic } from "react";
import { toggleEnrollment } from "./actions";

export function EnrollList({ rows }: { rows: Enrollment[] }) {
  const [optimistic, addOptimistic] = useOptimistic(rows, (state, id: string) =>
    state.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
  );
  return optimistic.map((r) => (
    <form
      key={r.id}
      action={async () => {
        addOptimistic(r.id);
        await toggleEnrollment(r.id);
      }}
    >
      <button>{r.active ? "Active" : "Paused"}</button>
    </form>
  ));
}
```

## Bad

```tsx
"use client";
// UI freezes on the spinner until the server confirms
const [rows, setRows] = useState(initial);
async function onToggle(id) {
  setLoading(true);
  const next = await toggleEnrollment(id);
  setRows(next);
  setLoading(false);
}
```

## Fix

Wrap the list in `useOptimistic`, call `addOptimistic(...)` before awaiting the action, and let React reconcile when the Server Action resolves.
