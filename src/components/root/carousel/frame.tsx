import type { ReactElement, ReactNode } from "react";
import { BRANDS } from "./brands";
import { THEMES } from "./palette";
import type { Deck, DeckLang, SlideTheme } from "./schema";

/** Safe inline margin inside the 1080px artboard. */
export const FRAME_PAD = 72;

export interface SlideFrameProps {
  w: number;
  h: number;
  /** 1-based slide position. */
  index: number;
  total: number;
  brand: Deck["brand"];
  theme: SlideTheme;
  lang: DeckLang;
  children: ReactNode;
}

function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/**
 * The exact-pixel artboard every archetype renders inside. Palette is inline
 * (print-like artifact — immune to site theme); direction is self-contained
 * so a frame renders correctly regardless of the surrounding page.
 */
export function SlideFrame({
  w,
  h,
  index,
  total,
  brand,
  theme,
  lang,
  children,
}: SlideFrameProps): ReactElement {
  const c = THEMES[theme];
  const info = BRANDS[brand];
  const counter =
    lang === "ar"
      ? `${toArabicDigits(index)} / ${toArabicDigits(total)}`
      : `${index} / ${total}`;

  return (
    <div
      data-frame
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
      className="relative flex flex-col overflow-hidden"
      style={{
        width: w,
        height: h,
        backgroundColor: c.bg,
        color: c.ink,
        // Arabic slides speak Thmanyah (Sans base; headlines opt into Serif
        // Display in slides.tsx). English stays on the house Geist. The real
        // family name comes first so Figma captures bind to the installed
        // desktop font; the next/font variable is the loading fallback.
        fontFamily:
          lang === "ar"
            ? '"Thmanyah sans 1.2", var(--font-thmanyah-sans)'
            : undefined,
      }}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ paddingInline: FRAME_PAD, paddingBlockStart: FRAME_PAD }}
      >
        {children}
      </div>
      <footer
        className="flex shrink-0 items-center justify-between"
        style={{
          marginInline: FRAME_PAD,
          height: 92,
          borderBlockStart: `2px solid ${c.hairline}`,
        }}
      >
        <span
          style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          {info.wordmark}
        </span>
        <span className="flex items-baseline gap-5">
          <span dir="ltr" style={{ fontSize: 23, color: c.muted }}>
            {info.domain}
          </span>
          <span style={{ fontSize: 23, fontWeight: 600, color: c.accent }}>
            {counter}
          </span>
        </span>
      </footer>
    </div>
  );
}
