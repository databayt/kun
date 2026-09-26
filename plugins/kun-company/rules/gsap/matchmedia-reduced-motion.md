---
domain: gsap
severity: warn
paths: ["**/*marketing*/**/*.tsx", "**/zenda-*/**/*.tsx", "**/animation*/**/*.tsx", "**/*gsap*.tsx", "**/*gsap*.ts"]
since: "2026-09-26"
---

# Branch on breakpoints and prefers-reduced-motion with gsap.matchMedia()

A one-off `window.matchMedia(...).matches` or `innerWidth` check inside an effect is read once at mount: resizing past a breakpoint or toggling the OS "reduce motion" setting never re-runs it. `gsap.matchMedia()` runs its setup when a query matches and automatically reverts every animation and ScrollTrigger it created when the query stops matching; the conditions object lets one setup read several queries as booleans. It creates its own context, so no extra `gsap.context()` is needed — create it inside `useGSAP`, pass the scope ref as the third argument, and return `() => mm.revert()`. Keep breakpoints in sync with Tailwind (`md` = 48rem = 768px).

## Good

```tsx
useGSAP(
  () => {
    const mm = gsap.matchMedia();
    mm.add(
      {
        isDesktop: "(min-width: 768px)",
        isMobile: "(max-width: 767px)",
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
      (ctx) => {
        const { isDesktop, reduceMotion } = ctx.conditions!;
        gsap.from(".card", {
          autoAlpha: 0,
          y: reduceMotion ? 0 : isDesktop ? 80 : 40,
          stagger: reduceMotion ? 0 : 0.1,
        });
      },
      container, // scope selector text
    );
    return () => mm.revert();
  },
  { scope: container },
);
```

## Bad

```tsx
useEffect(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // read once
  const ctx = gsap.context(() => {
    gsap.from(".card", { y: window.innerWidth > 768 ? 80 : 40 }); // breakpoint frozen at mount
  });
  return () => ctx.revert();
}, []);
```

## Fix

Move each breakpoint or motion branch into `gsap.matchMedia().add(conditions, setup, scope)` inside `useGSAP`, so GSAP reverts and re-runs it whenever a query flips.

> Source: https://gsap.com/docs/v3/GSAP/gsap.matchMedia() · https://gsap.com/resources/a11y
