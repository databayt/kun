# Handover: Thmanyah Font Website Clone (`font.thmanyah.com`)

**Date:** 2026-08-30  
**Repo:** `/Users/abdout/thmanyah`  
**Live Target Reference:** https://font.thmanyah.com  
**Stack:** Next.js 16 (App Router + Turbopack), React 19, TypeScript 5, Tailwind CSS 4, Radix UI primitives, Framer Motion, JSZip, Canvas Confetti, Lottie Web.

---

## 1. Exact Section-by-Section Mirror Implementation

The structure and exact CSS styles provided from the reference HTML have been implemented:

### 1. Hero Section (`data-framer-name="Hero"`, `id="خط-ثمانيـة"`)
- Background: `#00bc6d`, `min-height: 100vh`, `padding: 132px 60px 60px`.
- Subtitle: `خط ثمانيــة` using `thmanyah sans Regular` with OpenType features `'blwf' on, 'cv09' on, 'cv03' on, 'cv04' on, 'cv11' on`.
- Typography Header (`.framer-ht94lv`):
  - `لماذا` (`thmanyah serif display Black`, 80px, 900, `ss01`)
  - `قـرّرنا` (`thmanyah serif display Black`, 80px, 900, `ss01`)
  - `في` (`thmanyah serif display Black`, 80px, 900, `ss01`)
  - `ثمانيــة` (`thmanyah serif display Black`, 80px, 900, `ss01`)
  - `أن نُصمم` (`thmanyah serif display Black`, 80px, 900)
  - `خطًّـا عربيًّــــا؟` with absolute background highlight pill (`#9fe5b1`).
- CTA Button (`.framer-3lvoni`):
  - Black rounded pill (`#000`, border-radius 20px, height 40px, padding 0 16px).
  - Text `احصل على الخط` with SVG arrow down bounce animation.

### 2. The Answer Section (`data-framer-name="The Answer"`, `id="2"`)
- Row 1: Paragraph 1 (`منذ بدأنا قصّة إثراء المحتوى العربي في 2017...`) alongside giant high-res sculpted letter "ح" artwork (`/images/ha-compare-1.png`).
- Centerpiece (`id="8"`): Sculpted letter "8" container with `#afe4b6` mint background and animated vector strokes.
- Row 2: Paragraph 2 (`الخط هو العامل القادر على تحويل أي تصميم...`) with `thmanyah sans Medium` highlighted ending alongside the second sculpted letter "ح" angle (`/images/ha-compare-2.png`).

### 3. Trials Section (`data-framer-name="Trials"`)
- Pitch-black background (`#000000`).
- Header: `رحلة بناء` + `خــط عـربي غير مسبوق` (44px, 900, `ss01`) + `أصبح رسم حرف الحاء أكثر انسيابية، بزوايا حادة تعكس قوة الحرف وحضوره.` (26px, 300).
- Center: `JAMLIA` animated vector character morph.
- 3 Stats Cells (`data-framer-name="No."`):
  - `Cell 1`: `دراسة أكثر من` -> **`45`** (`Thmanyah sans 1.2 Bold`, 32px, `ss01`) -> `خطًّا عربيًّا في سعينا لتصميم خط عربي أنيق ومميز.`
  - `Cell 2`: `أكثر من` -> **`1,200`** (`Thmanyah sans 1.2 Bold`, 32px, `ss01`) -> `ساعة من البحث والتجارب للوصول إلى خط أصيل مرن فريد عصري.`
  - `Cell 3`: `أكثر من` -> **`80`** (`Thmanyah sans 1.2 Bold`, 32px, `ss01`) -> `نسخة من الخط مع تحسين مستمر للوصول إلى نسخة تنسجم مع هوية ثمانية.`

### 4. Authenticity Section (`data-framer-name="الصفـات"`, `id="jamal"`)
- Title: `خط أصيل` + `كما لو أن خطاطًا كتبــه.` (44px, 900) + `يجمع بين أصالة اليد ودقّة التقنية، كأنّها امتداد ليد خطاطٍ ماهر.`
- Comparison: Side-by-side cards:
  - `بخط ثمانيــة للعناويــن` with dark manuscript card.
  - `بخط زكي الهاشمي` with light manuscript card.

---

## 2. Verification

- **Production Build:** `pnpm build` completed with **0 errors**.
- **Dev Server:** Running on `http://localhost:3000` returning `HTTP 200 OK`.
- **Git:** Atomic conventional commits on `main`.

---

## Iteration 4 — second-half sections mirrored (2026-08-30)

Session continued in Claude Code after the Antigravity quota cutoff. All prior commits had landed; nothing was lost.

**Rewritten against the reference DOM (copy verbatim):**

| Block | Reference | Notes |
|---|---|---|
| `FeaturesBlock` | `مرن` + "New design - wireframe" | MARN Lottie (`lottie-hero-ha-v2`, 2970×1060) then 6 full-width panels: feature-1/2/3, `video-1.mp4`, feature-4/5 at reference aspect ratios |
| `FontFamiliesBlock` | `#8-fonts` accordion | 3 family rows, one open (Serif Display default), 5 weight columns (300→900) with AR+EN specimen at 20px |
| `InteractiveTesterBlock` | "B Display" tester | `#fafafa` wrapper, black rounded panel, controls column (الخط/الوزن/المحاذاة/الحروف مرسلة), 68px serif textarea (`field-sizing: content`), floating pill with black/green/white swatches |
| `ModernShowcaseBlock` | "Modern" | title block + auto-scrolling draggable marquee; item 01 = `video-3.webm`, 02–10 = new `poster-*.png` (downloaded) |
| `FaqBlock` | `#faq` | open 3-column grid, all 7 Q&As |
| `DownloadCtaBlock` + `FooterBlock` | `#footer` | 52px Light/Black headline, black pill → email field, thmanyah wordmark SVG, الترخيص, ⓒ line |

**Fixes found along the way**
- `StatsMetricsBlock` was playing the MARN Lottie; JAMLIA is `lottie-hero-ha.json` (3840×2160 green path). Corrected.
- `CalligraphyComparisonBlock` referenced `calligraphy-manuscript-1/2.png` which never existed (400s in console). Downloaded the two 1547×756 reference images under those names.
- `HomeTemplate` reordered to reference flow: اصيل → مرن → Try → Modern → FAQ → Footer. Nav anchors updated (`#2`, `#الصفـات`, `#8-fonts`).

**Asset map (framer → local)**
- `Yf10bNu0…mp4` = `video-1.mp4` (byte-exact), `ZCod2tu1…webm` = `video-3.webm`
- Not yet mirrored: `DownloadModalBlock` still exists (reference uses `#footer` anchor + inline email form); CTA form currently opens the modal on submit.

**Verification**: `pnpm build` clean (4 routes), `tsc --noEmit` clean, dev server on :3000, all six section ids mount, marquee advances at 40px/s, 6 Lottie SVGs render, no console errors after the image fix.

**Gotcha**: running `next build` while `next dev` is up on :3000 hangs the dev server (shared `.next`). Restart dev after builds.
