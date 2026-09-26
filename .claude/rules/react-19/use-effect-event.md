---
domain: react-19
severity: warn
paths: ["**/*.tsx", "**/hooks/**/*.ts", "**/use-*.ts"]
since: "React 19.2"
---

# Split non-reactive Effect logic into `useEffectEvent` instead of silencing exhaustive-deps

An `eslint-disable-next-line react-hooks/exhaustive-deps` above an Effect hides a stale closure: the Effect keeps reading the props and state of the render that created it. React 19.2 made `useEffectEvent` stable for exactly the case the disable usually covers — logic fired from an Effect that must see the latest values without re-running it (the locale in a toast, a callback prop, analytics context). Only the reactive values stay in the dependency array. The Effect Event is declared in the same component or hook as its Effect, called only from inside Effects, never passed to children, and never listed as a dependency; current eslint-plugin-react-hooks (7.x in hogwarts, codebase, mkan) enforces this. It is not a way to drop a real dependency — a value that should re-run the Effect stays in the array.

## Good

```tsx
"use client";
import { useEffect, useEffectEvent } from "react";

export function LiveAttendance({ classId, lang }: Props) {
  const onUpdate = useEffectEvent((count: number) => {
    toast(t(lang, "attendance.updated", { count })); // latest lang, no re-subscribe
  });

  useEffect(() => {
    const channel = subscribe(`attendance:${classId}`, onUpdate);
    return () => channel.close();
  }, [classId]); // reactive values only
}
```

## Bad

```tsx
"use client";
export function LiveAttendance({ classId, lang }: Props) {
  useEffect(() => {
    const channel = subscribe(`attendance:${classId}`, (count: number) =>
      toast(t(lang, "attendance.updated", { count })),
    );
    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]); // lang is stale after a language switch
}
```

## Fix

Move the non-reactive part of the Effect into `const onX = useEffectEvent(...)`, call it from the Effect, keep only reactive values in the dependency array, and delete the `eslint-disable` line.

> Source: https://react.dev/reference/react/useEffectEvent
