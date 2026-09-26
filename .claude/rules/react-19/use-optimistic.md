---
domain: react-19
severity: info
paths: ["**/content.tsx", "**/*-list.tsx", "**/form.tsx"]
since: "React 19.0"
---

# Optimistic UI with useOptimistic

For mutations whose result is predictable (toggle, add row, delete), render the optimistic value immediately with `useOptimistic` instead of awaiting the round-trip. The optimistic value lives only while its Action is pending: when the Action settles — success, returned error, or throw — React renders the `rows` prop again. So a failure reverts on its own, but a success only sticks if the Server Action refreshes what feeds `rows` (`updateTag`, `revalidatePath` or `refresh()`); without that the toggle flips back after a successful write. Call the setter inside an Action or `startTransition`, never from a plain handler.

## Good

```tsx
"use client";
import { useOptimistic } from "react";
import { toggleEnrollment } from "./actions"; // calls updateTag() after the write

export function EnrollList({ rows }: { rows: Enrollment[] }) {
  const [optimistic, toggleOptimistic] = useOptimistic(
    rows,
    (state, id: string) =>
      state.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
  );
  return optimistic.map((r) => (
    <form
      key={r.id}
      action={async () => {
        toggleOptimistic(r.id); // inside the form Action
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
async function onToggle(id: string) {
  setLoading(true);
  setRows(await toggleEnrollment(id));
  setLoading(false);
}
```

## Fix

Wrap the list in `useOptimistic`, call the setter inside the Action before awaiting it, and make the Server Action invalidate the data behind `rows` so the confirmed state replaces the optimistic one.

> Source: https://react.dev/reference/react/useOptimistic
