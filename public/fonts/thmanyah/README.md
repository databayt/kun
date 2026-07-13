# Thmanyah — خط ثمانية

Arabic (plus Latin) type family by [Thmanyah](https://font.thmanyah.com):
**Sans** (digital/UI), **Serif Display** (headlines), **Serif Text** (long-form).
Version pinned: **1.2**.

The `.woff2` files in this directory are **git-ignored on purpose** — the
[license](https://font.thmanyah.com/licenses) is free for personal and
commercial use and permits embedding in websites/apps, but forbids
redistribution: the font may only be downloaded from the official site.
Since this repo is public, the binaries must never be committed here nor
rehosted as raw files on the CDN.

They arrive automatically:

```bash
node scripts/fetch-thmanyah.mjs   # also runs via predev / prebuild — idempotent
```

Wired twice, on purpose:

- `src/components/atom/fonts.ts` — next/font/local variables
  (`--font-thmanyah-sans`, `--font-thmanyah-display`, `--font-thmanyah-text`)
  for site use.
- `src/components/root/carousel/fonts.css` — plain `@font-face` under the
  **real internal family names** (`Thmanyah sans 1.2`, `Thmanyah serif
display 1.2`, `Thmanyah serif text 1.2`), because next/font scopes names
  and Figma captures must bind to the desktop-installed fonts.

**Figma / desktop**: install the TTFs so Figma renders Thmanyah — either from
the official zip (emailed on download) or by unwrapping these woff2 files
(`fontTools`: load, `flavor = None`, save `.ttf`) into `~/Library/Fonts/`.
Restart Figma after installing.

First consumer: the carousel engine's Arabic slides
(`src/components/root/carousel/`). Other databayt repos adopt by copying
`scripts/fetch-thmanyah.mjs` + the `fonts.ts` block + `fonts.css`.
