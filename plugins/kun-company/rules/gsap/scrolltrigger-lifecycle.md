---
domain: gsap
severity: error
paths: ["**/*marketing*/**/*.tsx", "**/zenda-*/**/*.tsx", "**/animation*/**/*.tsx", "**/*gsap*.tsx", "**/*gsap*.ts"]
since: "2026-09-26"
---

# Put ScrollTrigger on top-level animations and refresh from layout events, not timers

A `scrollTrigger` on a tween nested inside a timeline cannot work — the parent's playhead and the scrollbar would both drive it — so attach it to the timeline or a standalone tween. Start/end positions are measured when a trigger is created and re-measured automatically only on resize, so images, fonts, or fetched content that shift layout need `ScrollTrigger.refresh()` from the callback that caused the shift (`refresh(true)` waits a frame); a fixed `setTimeout` only guesses. `scroll-behavior: smooth` on `<html>` (Tailwind `scroll-smooth`) corrupts those measurements — GSAP's fix is `scroll-behavior: auto` on ScrollTrigger pages. Create triggers top-to-bottom (or set `refreshPriority`), and let `useGSAP` revert them on unmount so client-side navigation leaves no stale triggers.

## Good

```tsx
useGSAP(
  () => {
    gsap
      .timeline({
        scrollTrigger: { trigger: ".panel", start: "top 80%", scrub: true },
      })
      .from(".icon", { autoAlpha: 0, y: 48 })
      .from(".copy", { autoAlpha: 0, y: 48, stagger: 0.2 }, "<0.2");
    document.fonts.ready.then(() => ScrollTrigger.refresh()); // layout event, not a guess
  },
  { scope: section },
);
```

## Bad

```tsx
const tl = gsap.timeline();
tl.from(".icon", {
  autoAlpha: 0,
  scrollTrigger: { trigger: ".panel", scrub: true },
}); // nested
window.setTimeout(() => ScrollTrigger.refresh(), 600); // hopes layout settled by then
```

```css
html {
  @apply scroll-smooth;
} /* start/end markers drift after every refresh */
```

## Fix

Move `scrollTrigger` onto `gsap.timeline({ scrollTrigger })`, replace timer refreshes with `ScrollTrigger.refresh()` in the load/fetch/fonts callback, and set `scroll-behavior: auto` on routes that use ScrollTrigger.

> Source: https://gsap.com/resources/st-mistakes · https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.refresh() · https://github.com/greensock/gsap-skills/blob/main/skills/gsap-scrolltrigger/SKILL.md
