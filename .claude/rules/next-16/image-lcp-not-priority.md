---
domain: next-16
severity: warn
paths: ["**/*.tsx"]
since: "Next.js 16.0"
---

# Mark the LCP image with `fetchPriority`/`loading`, not the deprecated `priority`

Next 16 deprecated the `next/image` `priority` prop in favor of `preload`, and the docs steer most cases to plain `fetchPriority="high"` or `loading="eager"` instead: `preload` injects a `<link>` into `<head>` and only fits a single image that is the LCP element on every viewport — never alongside `loading` or `fetchPriority`. Mark one image per route; flagging a whole card grid eager only competes with the real LCP on slow mobile links. Two related 16.0 defaults: `images.qualities` is now `[75]`, so any other `quality` prop is coerced to the closest listed value with only a dev-time warning (add it to `qualities`), and `minimumCacheTTL` rose to 4 hours.

## Good

```tsx
export function Listing({ hero, cards }: Props) {
  return (
    <>
      {/* the one LCP image on this route */}
      <Image src={hero} alt="" fetchPriority="high" sizes="100vw" />
      {cards.map((c) => (
        <Image key={c.id} src={c.src} alt={c.title} width={320} height={200} />
      ))}
    </>
  );
}
```

## Bad

```tsx
export function Listing({ hero, cards }: Props) {
  return (
    <>
      {/* `priority` is deprecated since Next 16 */}
      <Image src={hero} alt="" priority />
      {/* every card eager: they compete with the real LCP image */}
      {cards.map((c) => (
        <Image key={c.id} src={c.src} alt={c.title} priority />
      ))}
    </>
  );
}
```

## Fix

Replace `priority` with `fetchPriority="high"` (or `loading="eager"`) on the single LCP image, use `preload` only for a known single LCP image with neither of those props, and remove it everywhere else.

> Source: https://nextjs.org/docs/app/api-reference/components/image#preload
