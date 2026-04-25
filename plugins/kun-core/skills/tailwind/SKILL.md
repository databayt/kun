---
name: tailwind
description: Tailwind — Full Coverage CSS Sweep
paths: ["src/**/*.{tsx,jsx,css}","tailwind.config.{ts,js}"]
---

# Tailwind — Full Coverage CSS Sweep

Sweep every component for Tailwind CSS 4 anti-patterns: inline styles, hardcoded colors, non-logical properties (breaking RTL), raw hex values.

## Usage

- `tailwind` — sweep ALL components in current product
- `tailwind admission` — sweep only the admission block
- `tailwind --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `tailwind` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **Inline color styles** (`style={{color: ...}}`) → Tailwind class
2. **Inline spacing styles** (`style={{margin: ...}}`) → Tailwind spacing classes
3. **Hardcoded hex** (`#fff`, `#1a2b3c`) → semantic token (`bg-primary`, `text-foreground`)
4. **Raw color functions** (`rgb()`, `hsl()`) → Tailwind color classes
5. **Physical properties** (`ml-`, `mr-`, `pl-`, `pr-`) → logical (`ms-`, `me-`, `ps-`, `pe-`) for RTL
6. **`text-left`/`text-right`** → `text-start`/`text-end` for RTL
7. **`left-`/`right-`** → `start-`/`end-` for RTL

### Mode: Fix

This keyword finds AND fixes Tailwind issues.

### RTL Priority

Physical-to-logical property conversion is the highest priority because it directly affects Arabic users:
- `ml-4` → `ms-4` (margin-inline-start)
- `mr-4` → `me-4` (margin-inline-end)
- `pl-4` → `ps-4` (padding-inline-start)
- `text-left` → `text-start`
- `left-0` → `start-0`
- `rounded-l-lg` → `rounded-s-lg`

### Exceptions

- `ltr:` and `rtl:` prefixes are valid — they handle directional overrides
- `dir="ltr"` on phone/email/URL inputs is correct
- Code blocks (`<pre>`, `<code>`) should always be LTR
