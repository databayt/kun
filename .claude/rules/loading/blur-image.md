---
domain: loading
severity: warn
paths: ["src/components/**/*.tsx", "src/app/**/*.tsx"]
since: "2026-09-28"
---

# Photos load through BlurImage — blurred first, then sharp

A photo that pops out of an empty box reads as slow even when it isn't. Every content photo
(listing, catalog, cover, hero, gallery, avatar larger than ~48 px) renders through the repo's
`BlurImage` atom (`src/components/atom/blur-image.tsx`), which paints a blurred LQIP and
transitions the real image from `blur-xl scale-105` to `blur-none scale-100` on load. A repo
image primitive (mkan `PropertyImage`) renders `BlurImage` inside it — use the primitive.

## Good

```tsx
import { BlurImage } from "@/components/atom/blur-image";

<div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
  <BlurImage
    src={book.coverUrl}
    blurDataURL={book.coverBlur ?? undefined}
    alt={book.title}
    fill
    sizes="(max-width: 768px) 50vw, 20vw"
    className="object-cover"
  />
</div>;
```

## Bad

```tsx
<img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />

// or: placeholder="blur" alone — swaps abruptly, never sharpens
<Image src={url} placeholder="blur" blurDataURL={SHIMMER} fill alt="" />
```

## Fix

Swap the import to `BlurImage`, keep every prop, give the parent `relative overflow-hidden bg-muted`
and an aspect ratio, and pass a stored `blurDataURL` when the row has one. Exempt: SVG icons,
logos under ~48 px (`plain`), `blob:`/`data:` upload previews, email/print/PDF views, and
shadcn `AvatarImage` (its fallback is the loading state).

> Skill: `blur` · card: `.claude/patterns/cards/blur.md`
