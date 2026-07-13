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

Wired in `src/components/atom/fonts.ts` as `--font-thmanyah-sans`,
`--font-thmanyah-display`, `--font-thmanyah-text`. First consumer: the
carousel engine's Arabic slides (`src/components/root/carousel/`). Other
databayt repos adopt by copying `scripts/fetch-thmanyah.mjs` + the
`fonts.ts` block.
