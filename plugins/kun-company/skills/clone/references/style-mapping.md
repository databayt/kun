# Style mapping — computed CSS → arbitrary Tailwind v4 (pixel-exact)

`/clone` url-mode is **pixel-exact**: reproduce the captured `getComputedStyle` values
_as-is_ using Tailwind **arbitrary values** (`pt-[63px]`, `text-[39px]`). Do **not** round
to the spacing scale or snap to design tokens. Tailwind v4 emits any arbitrary value
verbatim, so the clone matches the source to the pixel.

## Core rule

> Every property in a node's `styles` object becomes a Tailwind arbitrary-value class with
> the **exact** captured value. When several longhands form one shorthand, collapse them
> only if all sides are equal.

## Property → class

| Captured (styles.json)                             | Tailwind v4 (exact)                                    | Notes                                           |
| -------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `font-size: 39px`                                  | `text-[39px]`                                          |                                                 |
| `font-weight: 590`                                 | `font-[590]`                                           | numeric weights pass through                    |
| `line-height: 41px`                                | `leading-[41px]`                                       | px exact; if unitless `1.05` → `leading-[1.05]` |
| `letter-spacing: -0.39px`                          | `tracking-[-0.39px]`                                   |                                                 |
| `color: rgb(20,20,19)`                             | `text-[rgb(20,20,19)]`                                 | keep the captured color function verbatim       |
| `background-color: rgb(247,245,242)`               | `bg-[rgb(247,245,242)]`                                |                                                 |
| `background-image: linear-gradient(...)`           | `bg-[linear-gradient(...)]`                            | wrap whole value; `_` for spaces inside         |
| `padding-top: 63px` (sides differ)                 | `pt-[63px] pr-[24px] pb-[64px] pl-[24px]`              | per-side logical → see rtl-logical.md           |
| `padding-*: 16px` (all equal)                      | `p-[16px]`                                             | collapse only when equal                        |
| `margin-bottom: 16px`                              | `mb-[16px]` → logical `mb-[16px]` (block axis is safe) | inline-axis margins use `ms/me`                 |
| `width: 600px`                                     | `w-[600px]`                                            | but see **container caveat** below              |
| `height: 44px`                                     | `h-[44px]`                                             |                                                 |
| `max-width: 1200px`                                | `max-w-[1200px]`                                       |                                                 |
| `gap: 24px`                                        | `gap-[24px]`                                           |                                                 |
| `border-top-left-radius: 8px` (all corners equal)  | `rounded-[8px]`                                        | per-corner → `rounded-ss/se/es/ee-[..]`         |
| `border-*-width: 1px` + `border-*-color: rgb(...)` | `border-[1px] border-[rgb(...)]`                       | only when style≠none                            |
| `box-shadow: 0 1px 2px rgba(0,0,0,.06)`            | `shadow-[0_1px_2px_rgba(0,0,0,0.06)]`                  | spaces→`_`, drop the inner spaces in rgba       |
| `display: flex` + `flex-direction: column`         | `flex flex-col`                                        | use the standard utilities, not arbitrary       |
| `justify-content: space-between`                   | `justify-between`                                      | enumerated values → standard utilities          |
| `grid-template-columns: 1fr 1fr 1fr`               | `grid grid-cols-[1fr_1fr_1fr]`                         | `_` for spaces                                  |
| `opacity: 0.6`                                     | `opacity-[0.6]`                                        |                                                 |
| `transform: matrix(...)` / `translateY(...)`       | `[transform:translateY(-4px)]`                         | arbitrary property when no utility fits         |
| `transition: ... 0.2s`                             | `transition-[...] duration-[200ms]`                    | or `[transition:...]`                           |
| `aspect-ratio: 16/9`                               | `aspect-[16/9]`                                        |                                                 |
| `object-fit: cover`                                | `object-cover`                                         |                                                 |

## Arbitrary-value syntax reminders (Tailwind v4)

- **Spaces inside a value** must become underscores: `shadow-[0_1px_2px_#0001]`, `grid-cols-[1fr_2fr]`.
- A **literal underscore** in content is rare; escape as `\_` if needed.
- **Colors**: keep the exact captured form — `text-[rgb(20,20,19)]` or `text-[#141413]`. Both compile. Prefer the captured `rgb()`/`oklch()` string so it's a byte-for-byte match.
- **CSS variables present in the source** (`var(--x)`): the page's variable won't exist in your app — resolve to the captured _computed_ value instead (the snapshot already gives you the resolved px/color).
- When no utility exists, use the **arbitrary property** escape hatch: `[mix-blend-mode:multiply]`, `[backdrop-filter:blur(8px)]`.

## Container width caveat (the one judgment call)

`width`/`height` in `styles.json` are _used_ values (layout results). For **leaf or intrinsically-sized** elements (buttons, badges, avatars, icons, fixed media) reproduce them exactly (`w-[44px] h-[44px]`). For **layout containers** whose width is a _consequence_ of flex/grid/`max-width`, prefer reproducing the **mechanism** (`max-w-[1200px] mx-auto`, `flex-1`) rather than hardcoding `w-[1188px]` — a frozen container width breaks at other content/viewports. The `shots/` confirm you matched; the goal is "looks identical at all 3 breakpoints," not "every div has a pixel width."

## Tokens are reference-only here

`tokens.json` exists so you can author **responsive variants** from `breakpointBehavior` and _optionally note_ equivalences ("`rgb(20,20,19)` ≈ `--foreground`") in your summary. Under pixel-exact you still emit the **exact** value in the class — the note is for the human, not a substitution.
