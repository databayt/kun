---
domain: react-19
severity: error
applies-to: ["**/form.tsx", "**/*-form.tsx", "**/components/**/form/*.tsx"]
since: "React 19.0"
---

# Forms drive mutations with useActionState

Wire forms to a Server Action through `useActionState`, not `useState` + an `onSubmit` handler. The hook owns pending and returned-error state, so you stop hand-rolling loading flags and the form keeps working before hydration.

## Good

```tsx
"use client";
import { useActionState } from "react";
import { createStudent } from "./actions";

export function StudentForm() {
  const [state, formAction, isPending] = useActionState(createStudent, null);
  return (
    <form action={formAction}>
      <input name="name" />
      {state?.error && <p className="text-destructive">{state.error}</p>}
      <button disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
    </form>
  );
}
```

## Bad

```tsx
"use client";
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
async function onSubmit(e) {
  e.preventDefault();
  setLoading(true);
  const res = await createStudent(new FormData(e.currentTarget));
  if (res?.error) setError(res.error);
  setLoading(false);
}
return <form onSubmit={onSubmit}>…</form>;
```

## Fix

Replace the manual `useState`/`onSubmit` plumbing with `const [state, formAction, isPending] = useActionState(action, null)` and bind `<form action={formAction}>`.
