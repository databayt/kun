# Video Pattern

One way to ship a video on a page, for every repo: the same file names on the CDN, the same
manifest, the same player behaviour. A loop on a feature page, a tutorial in the docs and a
product film on the home page differ in length and controls, not in how they are stored or
loaded.

## Status

| Repo      | Pattern                                                  | Maturity                                 | Canonical |
| --------- | -------------------------------------------------------- | ---------------------------------------- | --------- |
| hogwarts  | manifest + `HeroVideo` / `StoryVideo` / `MediaView`      | production (18 feature loops, tutorials) | **yes**   |
| codebase  | `story-video.tsx`, two hero blocks with inline `<video>` | partial                                  | no        |
| mkan      | six hand-written `<video>` tags                          | none                                     | no        |
| farm      | two hand-written `<video>` tags                          | none                                     | no        |
| marketing | one hand-written `<video>` tag                           | none                                     | no        |

## The contract

### 1. Files (the media studio writes them, never a person)

```
cdn.databayt.org/<repo>/<lang>/<route>[/<flow>]/
  video.mp4            H.264, faststart — the fallback every browser plays
  video.av1.mp4        AV1 — listed first, smaller
  video.poster.webp    the first thing the visitor sees
  video.vtt            captions (tutorials and films; a silent loop has none)
```

- The path is the page's own URL with the CDN host: the film on `/ar` lives under
  `<repo>/ar/`, a feature loop under `<repo>/ar/features/<id>/`.
- Fixed names, no hash, repo name not brand name (`hogwarts`, never `balqalam`). A re-render
  overwrites the object and invalidates exactly that key.
- One master per video per language. Other ratios (9:16, 1:1) are derived from the master,
  never edited separately.

### 2. Manifest (pages never hard-code a URL)

A page asks the product's media manifest for an id and gets a typed entry back.

```ts
// hogwarts: src/components/docs/media.ts
interface VideoMedia {
  sources: VideoSource[]; // AV1 first, then H.264
  poster: string;
  captions?: CaptionTrack[];
  // width, height, duration
}
getVideo("feature-admission/video-ar"); // throws if missing
findVideo("…"); // undefined if missing — for optional media
```

The manifest (`media-manifest.json`) is written by `shoot/scripts/publish.mjs`; URLs carry
`?v=<sha8>` so a browser refetches when the bytes change.

### 3. Player behaviour

| Rule                                                                               | Why                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| Poster first, `preload="metadata"`                                                 | the page paints before a byte of video is fetched |
| `<source>` AV1 before H.264                                                        | the browser takes the first it can play           |
| Play only while on screen (IntersectionObserver, threshold 0.2), pause when off    | no decoding below the fold                        |
| `prefers-reduced-motion: reduce` → stay on the poster                              | accessibility; also saves the download            |
| `muted loop playsInline`, no controls — **loops**                                  | background motion; it must never make a sound     |
| controls, captions track, not autoplaying with sound — **tutorials and films**     | the visitor chooses to watch                      |
| `aria-label` from the dictionary, in the page's language                           | a video is content                                |
| the box is sized by the caller (`className`); the video covers it (`object-cover`) | one component, any layout                         |
| RTL: controls and any overlay text follow the page direction                       | Arabic first                                      |

Canonical component: `hogwarts/src/components/saas-marketing/features/sections/hero-video.tsx`.

### 4. Kinds

| Kind     | Length   | Sound                              | Made with                                     |
| -------- | -------- | ---------------------------------- | --------------------------------------------- |
| loop     | 8–12 s   | none                               | `shoot/scripts/hero.mjs`                      |
| tutorial | 30–120 s | narration                          | `/record`, `/shoot` sims, `media.sh`          |
| film     | 45–90 s  | narration, optional licensed music | existing loops + HyperFrames type, `media.sh` |

### 5. Budgets and checks (engine.json → media)

H.264 8 MB a minute, AV1 5 MB a minute, a loop under 3 MB; VMAF 95 (H.264) and 93 (AV1);
loudness −16 LUFS on the web, −14 for social, true peak under −1.5 dB. `media.sh qa-pack`
measures; the `media-qa` agent judges by eye (Arabic shaping, RTL motion, brand, personal
data, safe areas) and never edits.

## Anti-patterns

- A hand-written `<video src="https://cdn…/something.abc123.mp4">` in a component.
- A hash, a brand name or a version in a file name (`hero-v2-final.mp4`).
- An autoplaying video with sound.
- A second edit for the vertical cut instead of a derivation.
- A video file committed to git (the media guard blocks it).

## Adopting it in a repo

1. Copy `media.ts` and `hero-video.tsx` from hogwarts (they have no hogwarts-specific code).
2. Publish through the media studio so the manifest is written for you.
3. Replace each hand-written `<video>` when its page is next touched; do not sweep.
