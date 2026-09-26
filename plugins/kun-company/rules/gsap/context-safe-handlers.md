---
domain: gsap
severity: warn
paths: ["**/*marketing*/**/*.tsx", "**/zenda-*/**/*.tsx", "**/animation*/**/*.tsx", "**/*gsap*.tsx", "**/*gsap*.ts"]
since: "2026-09-26"
---

# Wrap GSAP calls in event handlers with contextSafe()

`useGSAP()` only records what is created while its callback runs. A tween started later — from `onClick`/`onMouseEnter`, a timer, or an async callback — escapes the context: it is not reverted on unmount, can keep writing to a detached node, and its selector text is not scoped. `contextSafe()` (returned by `useGSAP`, or the callback's second argument) records whatever the wrapped function creates and applies the scope. Listeners you attach by hand inside `useGSAP` must be removed in the cleanup it returns.

## Good

```tsx
const root = useRef<HTMLAnchorElement>(null);
const { contextSafe } = useGSAP({ scope: root }); // config-only form

const drawIn = contextSafe(() => {
  gsap.to("path", { strokeDashoffset: 0, duration: 0.4 }); // recorded + scoped
});

return (
  <Link ref={root} href={href} onMouseEnter={drawIn}>
    {label}
  </Link>
);
```

## Bad

```tsx
const drawIn = () => {
  // created after mount: never reverted, not scoped, outlives the link
  gsap.to(pathRef.current, { strokeDashoffset: 0, duration: 0.4 });
};

return (
  <Link href={href} onMouseEnter={drawIn}>
    {label}
  </Link>
);
```

## Fix

Wrap every handler, timer, or promise callback that creates tweens in `contextSafe(...)` from the component's `useGSAP`, and remove manually added listeners in its returned cleanup.

> Source: https://gsap.com/resources/React#making-your-animation-context-safe · https://github.com/greensock/gsap-skills/blob/main/skills/gsap-react/SKILL.md
