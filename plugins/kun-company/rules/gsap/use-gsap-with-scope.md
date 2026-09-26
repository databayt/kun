---
domain: gsap
severity: error
paths: ["**/*marketing*/**/*.tsx", "**/zenda-*/**/*.tsx", "**/animation*/**/*.tsx", "**/*gsap*.tsx", "**/*gsap*.ts"]
since: "2026-09-26"
---

# Run GSAP inside useGSAP() with a scope ref, plugins registered once per client module

GSAP writes inline styles and creates ScrollTriggers outside React, so anything started in a bare effect outlives the component unless it is reverted — and Strict Mode runs effects twice, stacking duplicate `from()` tweens. `useGSAP()` from `@gsap/react` is GSAP's drop-in for `useEffect`/`useLayoutEffect`: every tween, timeline, ScrollTrigger, Draggable and SplitText created in the callback is reverted on unmount, and `scope` confines selector text to the component's own subtree. It is SSR-safe but needs `"use client"` in the App Router. Call `gsap.registerPlugin(useGSAP, ...plugins)` once at module scope — registration is what stops bundlers tree-shaking a plugin away. Without `@gsap/react`, GSAP's sanctioned fallback is `gsap.context(fn, scopeRef)` inside `useEffect`, returning `() => ctx.revert()`.

## Good

```tsx
"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger); // once, at module scope

export function Features() {
  const container = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      gsap.from(".card", { autoAlpha: 0, y: 40, stagger: 0.1 }); // scoped + auto-reverted
    },
    { scope: container },
  );
  return <section ref={container}>{/* .card × n */}</section>;
}
```

## Bad

```tsx
useEffect(() => {
  gsap.registerPlugin(ScrollTrigger); // re-registered on every mount
  gsap.from("[data-card]", { autoAlpha: 0, y: 40 }); // unscoped: hits every match on the page
}, []); // nothing reverted: tweens + inline styles outlive the component
```

## Fix

Move the effect body into `useGSAP(fn, { scope: ref })` (or `gsap.context(fn, ref)` + `return () => ctx.revert()`), and hoist `gsap.registerPlugin(useGSAP, …)` to module scope in the `"use client"` file.

> Source: https://gsap.com/resources/React · https://gsap.com/docs/v3/GSAP/gsap.registerPlugin() · https://github.com/greensock/gsap-skills/blob/main/skills/gsap-react/SKILL.md
