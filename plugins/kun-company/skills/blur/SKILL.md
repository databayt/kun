---
name: blur
description: Blur-up images — photos arrive blurred and sharpen into focus as they load
when_to_use: "Use when images should load blurred then sharpen — the BlurImage atom, converting <img>/next/image surfaces, LQIP at upload, or auditing images that pop in. Not `skeleton` (data loading shapes). Triggers on: blur, blur-up, blur while loading, lqip, images pop in, fade in images, صور ضبابية."
argument-hint: "[audit|atom|convert <surface>|lqip] [repo]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm *), Bash(node *), Bash(git *)
model: opus
---

# Blur — images that sharpen into focus

An image should never pop out of a gray box. It arrives as a soft, blurred version of itself
and sharpens into place over ~700 ms. The effect is one CSS transition (`blur` + `scale`) on
the real image, optionally sitting on a tiny LQIP (low-quality image
placeholder) so the colors are right from the first paint.

Canonical file layout, per-repo adoption, and the surface list: pattern card
`.claude/patterns/cards/blur.md`. Enforced ambiently by `.claude/rules/loading/blur-image.md`.

## The atom — `BlurImage`

One client component wraps `next/image`. It is a drop-in: same props, same `fill`/`sizes`
contract, plus the blur-up. Place it at `src/components/atom/blur-image.tsx`.

```tsx
"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/** Neutral 16×10 LQIP for images with no stored blur — reads fine in light + dark. */
export const NEUTRAL_BLUR =
  "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoQAAwAA4BaJaQAA3AA/vEAgAA=";

export type BlurImageProps = ImageProps & {
  /** Skip the blur-up (fade only, no placeholder). Use for tiny icons and logos. */
  plain?: boolean;
};

export function BlurImage({
  className,
  onLoad,
  plain = false,
  placeholder,
  blurDataURL,
  alt,
  ...props
}: BlurImageProps) {
  const [loaded, setLoaded] = React.useState(false);

  // Static imports carry their own blurDataURL; remote images use the stored one or the neutral.
  const staticBlur =
    typeof props.src === "object" && "blurDataURL" in props.src;
  const blur = blurDataURL ?? (staticBlur ? undefined : NEUTRAL_BLUR);

  return (
    <Image
      {...props}
      alt={alt}
      placeholder={placeholder ?? (plain ? "empty" : "blur")}
      blurDataURL={plain ? undefined : blur}
      data-loaded={loaded ? "" : undefined}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn(
        "transition-[filter,scale,opacity] duration-700 ease-out",
        "motion-reduce:transition-none",
        loaded
          ? "blur-none scale-100 opacity-100"
          : plain
            ? "opacity-0"
            : "blur-xl scale-105 motion-reduce:blur-none motion-reduce:scale-100",
        className,
      )}
    />
  );
}
```

Why each piece:

| Piece                                | Reason                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder="blur"` + `blurDataURL` | next/image paints the LQIP as a blurred background on the `<img>` from the first HTML byte — the colors are there before JS runs                                                                                                                                                                        |
| `blur-xl scale-105` → sharp          | the real image paints _through_ the blur and sharpens instead of snapping; `scale-105` hides the transparent halo `filter: blur` leaves at the edges. **No `opacity-0` in blur mode** — next/image paints the LQIP as the `<img>`'s own `background-image`, so hiding the img hides the placeholder too |
| `onLoad` via next/image              | next/image also fires it for images that were already `complete` when the ref attached (cache hits, fast networks) — no stuck-blurred images                                                                                                                                                            |
| `motion-reduce:`                     | reduced-motion users get no zoom and no blur travel — the image simply appears over its LQIP                                                                                                                                                                                                            |
| `plain`                              | logos, icons and avatars under ~48 px only fade in (`opacity-0` is safe here — no placeholder) — a blur on a 24 px glyph reads as a rendering bug                                                                                                                                                       |

**The parent owns the box.** `fill` images need a `relative overflow-hidden` parent with an
aspect ratio (`aspect-[4/3]`, `aspect-square`) and a `bg-muted` so the frame is visible
before the LQIP decodes. `overflow-hidden` is required — without it the `scale-105` spills.

## Where the LQIP comes from — in order of preference

1. **Static import** (`import hero from "@/public/hero.jpg"`) — Next generates `blurDataURL`
   at build. Nothing to store.
2. **Stored per image** — generate a ~16 px WebP data URL **at upload** and save it next to
   the URL (`blurDataURL String?` on the model, or a `{ url, blur }` JSON on image arrays).
   Client-side (canvas, before the S3 PUT) is the house default — zero server cost, works on
   Workers. Reference: `mkan/src/lib/image-optimize.ts → generateBlurDataURL`.
3. **Build-time map for a fixed stock set** — a script walks the seed/stock URLs once with
   `sharp` and writes `{ [url]: dataURL }`. Reference: `mkan/src/lib/stock-blur-map.ts`.
4. **Neutral** — `NEUTRAL_BLUR`. Colors are wrong but the blur-up still reads as intentional.

Never fetch-and-downscale at request time to make an LQIP: it costs a full image download per
render and defeats the point. Backfill stored LQIPs with a one-off script, not in the page.

## $ARGUMENTS

### `audit [repo]` — which image surfaces still pop in

```bash
cd ~/<repo>
grep -rln '<img\b' src --include='*.tsx' | wc -l                  # raw <img>
grep -rln 'from "next/image"' src | xargs grep -L 'BlurImage' | wc -l # next/image without the atom
grep -rn 'placeholder="blur"' src | wc -l                         # LQIP already in play
grep -rniE 'blur(DataURL|Hash)?|lqip' prisma/ | head              # stored blur columns
```

Report a table — surface · file · element (`<img>` / `Image` / `Avatar`) · src kind (static /
remote / CDN) · LQIP source available (yes/no) · visibility rank. Rank by who sees it first:
landing hero → listing/catalog cards → detail galleries → avatars → dashboards.

### `atom [repo]` — install `BlurImage`

1. If the repo already has an image primitive (mkan `PropertyImage`), **extend it** with the
   blur-up state instead of adding a parallel atom — then add `BlurImage` for the generic
   case and have the primitive render it.
2. Write `src/components/atom/blur-image.tsx` from the block above (match the repo's quote
   style and `cn` import path).
3. `pnpm tsc --noEmit` on the file's consumers.

### `convert <surface> [repo]` — move a surface onto the atom

- `Image` → `BlurImage`: change the import, keep every prop. Add `blurDataURL` if the row has one.
- `<img>` → `BlurImage`: needs `width`/`height` or `fill` + a sized parent; add the host to
  `images.remotePatterns` if it is remote. Keep `<img>` only for SVG sprites, email templates,
  PDF/print views, and `data:`/`blob:` previews in upload widgets.
- shadcn `Avatar`: leave `AvatarImage` alone — its `AvatarFallback` (initials) is the
  loading state. Blur-up is for photos with a real frame, not 32 px circles.
- `priority` (LCP hero): keep the blur-up but make sure it has a **real** LQIP (static import
  or stored) — a neutral blur on the LCP image looks like a broken hero for 700 ms.

### `lqip [repo]` — store blurs at upload + backfill

1. Add `blurDataURL String?` (or extend the image JSON) — `/schema` owns the migration.
2. Call the generator in the upload hook before/alongside the S3 PUT; persist with the URL.
3. Thread it through the query → props → `BlurImage blurDataURL`.
4. Backfill existing rows with a script (`sharp(buffer).resize(16).webp({ quality: 50 })`),
   batched, idempotent (skip rows that already have one).

## Gotchas

- **Tailwind v4 has no `blur-0`.** The class silently generates nothing, so the image stays blurred
  forever. The loaded state is `blur-none` (verified 2026-09-28 against tailwindcss 4.2 — mkan caught it).
- **`placeholder="blur"` alone is not the effect.** It swaps a blurred background for the
  image abruptly. The transition on the `<img>` is what makes it sharpen.
- **`unoptimized` / custom loaders are fine.** The effect is CSS; it works whether the bytes
  come from `/_next/image`, a CDN variant loader, or straight from S3.
- **Server components can't pass `onLoad`.** That is why the atom is `"use client"` — import
  it from server components freely; only the atom hydrates.
- **Don't blur-up inside a carousel slide that isn't visible** — `loading="lazy"` (the default)
  already defers it; don't set `priority` on every slide to "fix" a blurred first frame.
- **Arabic/RTL**: nothing directional here — no logical-property work needed.

## After

- Update the repo row in `.claude/patterns/cards/blur.md` + `.claude/patterns/registry.json`.
- Verify in the browser with network throttled to Slow 4G (Playwright:
  `page.route('**/*.{jpg,png,webp,avif}', r => setTimeout(() => r.continue(), 1500))`) and
  screenshot mid-load: the image must be blurred, not blank and not sharp.
