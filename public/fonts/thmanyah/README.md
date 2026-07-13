# Thmanyah — خط ثمانية

Arabic (plus Latin) type family by [Thmanyah](https://font.thmanyah.com):
**Sans** (digital/UI), **Serif Display** (headlines), **Serif Text** (long-form).

Generation pinned: **original** — the families the specimen site itself
typesets with. Its signature headline recipe is **serif display Black (900)
with `font-feature-settings: "ss01"`** (the calligraphic stylistic set);
without ss01 the alternates stay off and the face reads generic. The "1.2"
files on the same page are a partial improvement preview (display ships only
Regular there) — switch generations only when Thmanyah rolls 1.2 out across
all weights, by updating the manifest + `MANIFEST_VERSION` in
`scripts/fetch-thmanyah.mjs`.

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
  **real internal family names** (`thmanyah sans`, `thmanyah serif display`,
  `thmanyah serif text`), because next/font scopes names and Figma captures
  must bind to the desktop-installed fonts.

**Figma / desktop**: install the TTFs so Figma renders Thmanyah — either from
the official zip (emailed on download) or by unwrapping these woff2 files
(`fontTools`: load, `flavor = None`, save `.ttf`) into `~/Library/Fonts/`.
Restart Figma after installing. In Figma, the ss01 alternates live under
Type settings → Stylistic sets.

First consumer: the carousel engine's Arabic slides
(`src/components/root/carousel/`). Other databayt repos adopt by copying
`scripts/fetch-thmanyah.mjs` + the `fonts.ts` block + `fonts.css`.
