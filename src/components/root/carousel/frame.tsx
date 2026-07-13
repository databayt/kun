import type { ReactElement, ReactNode } from "react";
import { BRANDS } from "./brands";
import { THEMES } from "./palette";
import type { Deck, DeckLang, SlideTheme } from "./schema";

/** Safe inline margin inside the 1080px artboard. */
export const FRAME_PAD = 72;

export interface SlideFrameProps {
  w: number;
  h: number;
  brand: Deck["brand"];
  theme: SlideTheme;
  lang: DeckLang;
  children: ReactNode;
}

/**
 * The exact-pixel artboard every archetype renders inside. Palette is inline
 * (print-like artifact — immune to site theme); direction is self-contained
 * so a frame renders correctly regardless of the surrounding page.
 *
 * The brand mark sits alone at the bottom start — no footer strip (Abdout,
 * 2026-07-13: "use logo instead of footer"). Monochrome-ink logos invert to
 * ivory on the dark and clay canvases.
 */
export function SlideFrame({
  w,
  h,
  brand,
  theme,
  lang,
  children,
}: SlideFrameProps): ReactElement {
  const c = THEMES[theme];
  const info = BRANDS[brand];
  const invertLogo = theme === "dark" || theme === "clay";

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
            ? '"thmanyah sans", var(--font-thmanyah-sans)'
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
        className="flex shrink-0 items-center"
        style={{
          paddingInline: FRAME_PAD,
          paddingBlockEnd: FRAME_PAD - 16,
          height: 120,
        }}
      >
        {info.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.logo}
            alt=""
            style={{
              height: 64,
              width: "auto",
              filter: invertLogo ? "invert(1)" : undefined,
            }}
          />
        ) : (
          <span
            style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            {info.wordmark}
          </span>
        )}
      </footer>
    </div>
  );
}
