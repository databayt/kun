# RTL-ready logical properties — the one idiomatic concession

The house stack is **Arabic-RTL by default**. Mapping a captured LTR section to
**logical** properties is _lossless in LTR_ (identical pixels) but lets the clone flip
correctly under `dir="rtl"`. This is the only place we deviate from raw computed styles —
because it doesn't change the pixel-exact result the user asked for.

## Inline-axis (the ones that flip) → use logical

| Physical (captured)          | Logical Tailwind  | Plain CSS                   |
| ---------------------------- | ----------------- | --------------------------- |
| `margin-left`                | `ms-[..]`         | `margin-inline-start`       |
| `margin-right`               | `me-[..]`         | `margin-inline-end`         |
| `padding-left`               | `ps-[..]`         | `padding-inline-start`      |
| `padding-right`              | `pe-[..]`         | `padding-inline-end`        |
| `left: 0`                    | `start-[0]`       | `inset-inline-start`        |
| `right: 0`                   | `end-[0]`         | `inset-inline-end`          |
| `text-align: left`           | `text-start`      | `text-align: start`         |
| `text-align: right`          | `text-end`        | `text-align: end`           |
| `border-left*`               | `border-s-*`      | `border-inline-start*`      |
| `border-right*`              | `border-e-*`      | `border-inline-end*`        |
| `border-top-left-radius`     | `rounded-ss-[..]` | `border-start-start-radius` |
| `border-top-right-radius`    | `rounded-se-[..]` | `border-start-end-radius`   |
| `border-bottom-right-radius` | `rounded-ee-[..]` | `border-end-end-radius`     |
| `border-bottom-left-radius`  | `rounded-es-[..]` | `border-end-start-radius`   |

## Block-axis & symmetric (DON'T flip) → keep physical

- `margin-top`/`margin-bottom` → `mt-[..]`/`mb-[..]` (block axis never flips).
- `padding-top`/`padding-bottom` → `pt-[..]`/`pb-[..]`.
- Equal left+right → collapse to `px-[..]` (symmetric, flip-safe).
- `width`/`height`, `top`/`bottom`, `gap` → unchanged.

## Directional content

- `flex-direction: row` stays `flex-row` — flexbox auto-reverses under RTL. Do **not** hardcode reversal.
- Icons that imply direction (chevron-right "next", arrows) should use `rtl:rotate-180` or logical-aware lucide usage so they point correctly when flipped. Note these in your summary; don't silently bake LTR-only direction.
- `background-position: left`/`right` → consider `start`/`end` only if the asset is directional; otherwise keep.

## Rule of thumb

> Inline-axis spacing, insets, text-align, and per-corner radii → **logical**.
> Everything block-axis or symmetric → **physical, exact**.
> Pixels are identical in LTR; the section now also works in Arabic.
