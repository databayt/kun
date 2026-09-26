---
domain: gsap
severity: error
paths: ["**/*marketing*/**/*.tsx", "**/zenda-*/**/*.tsx", "**/animation*/**/*.tsx", "**/*gsap*.tsx", "**/*gsap*.ts"]
since: "2026-09-26"
---

# Split Arabic text with GSAP's splitArabicText() helper, never raw type: "chars"

Arabic is cursive: each letter takes an isolated, initial, medial, or final form depending on its neighbours. `SplitText` with `type: "chars"` wraps every letter in its own element, the letters lose that context, and each renders in its isolated form — the word visibly falls apart on every Arabic page (our default locale). GSAP publishes a `splitArabicText()` helper that splits by words, then re-joins the letters with zero-width joiners so shaping survives; copy it verbatim into `lib/` (drop its stray `console.log`). If per-letter motion isn't needed, split Arabic by `words` or `lines` only. SplitText is free, and instances created inside `useGSAP` are reverted on unmount.

## Good

```tsx
import { SplitText } from "gsap/SplitText";
import { splitArabicText } from "@/lib/gsap/split-arabic-text"; // gsap.com helper, verbatim

gsap.registerPlugin(useGSAP, SplitText);

useGSAP(
  () => {
    const split = splitArabicText(heading.current, { type: "chars" }); // letters stay joined
    gsap.from(split.chars, { autoAlpha: 0, y: 12, stagger: 0.03 });
  },
  { scope: heading },
);
```

## Bad

```tsx
useGSAP(
  () => {
    // every Arabic letter renders isolated — "مدرسة" becomes م د ر س ة
    const split = SplitText.create(heading.current, { type: "chars" });
    gsap.from(split.chars, { autoAlpha: 0, y: 12, stagger: 0.03 });
  },
  { scope: heading },
);
```

## Fix

Route any character split of Arabic (or `lang="ar"`) text through `splitArabicText()`, or split by `words`/`lines` only.

> Source: https://gsap.com/docs/v3/HelperFunctions/helpers/splitArabicText · https://gsap.com/docs/v3/Plugins/SplitText
