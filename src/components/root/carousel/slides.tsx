import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Art } from "./art";
import { plateColor, THEMES, type ThemeColors } from "./palette";
import type { Bilingual, DeckLang, Slide } from "./schema";

/**
 * The six slide archetypes, drawn in the Anthropic editorial language:
 * ink on ivory, one Clay accent, generous whitespace, and illustrations
 * sitting on soft tinted plates cycled from the accent family (the same
 * section-theming pattern anthropic.com uses).
 *
 * All type sizes are absolute px against the fixed 1080px artboard.
 * Arabic never gets letter-spacing (it breaks the connected script) and
 * always gets taller line-height for diacritic clearance.
 */

function t(field: Bilingual, lang: DeckLang): string {
  return field[lang];
}

function eyebrowStyle(c: ThemeColors, lang: DeckLang): CSSProperties {
  return lang === "ar"
    ? { fontSize: 27, fontWeight: 500, color: c.accent }
    : {
        fontSize: 24,
        fontWeight: 600,
        color: c.accent,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
      };
}

function headlineStyle(size: number, lang: DeckLang): CSSProperties {
  return lang === "ar"
    ? {
        // The font.thmanyah.com headline recipe: serif display BLACK with the
        // ss01 stylistic set — that pairing is the signature calligraphic
        // look; without ss01 the alternates stay off and the face reads
        // generic. Display sets more compact than the Latin Geist, so Arabic
        // keeps the full size for equal hierarchy.
        fontFamily: '"thmanyah serif display", var(--font-thmanyah-display)',
        fontSize: size,
        fontWeight: 900,
        fontFeatureSettings: '"ss01"',
        lineHeight: 1.42,
      }
    : {
        fontSize: size,
        fontWeight: 650,
        lineHeight: 1.1,
        letterSpacing: "-0.025em",
      };
}

function bodyStyle(c: ThemeColors, lang: DeckLang, size = 32): CSSProperties {
  return {
    fontSize: size,
    lineHeight: lang === "ar" ? 1.75 : 1.5,
    color: c.muted,
    fontWeight: 400,
  };
}

/** Soft tinted plate under an illustration — the Anthropic card look. */
function ArtPlate({
  file,
  index,
  canvas,
  height,
  artHeight,
  width,
  radius = 40,
}: {
  file: string;
  index: number;
  canvas: string;
  height: number;
  artHeight: number;
  width?: number | string;
  radius?: number;
}): ReactElement {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        backgroundColor: plateColor(index, canvas),
        borderRadius: radius,
        height,
        width: width ?? "100%",
      }}
    >
      <Art
        name={file}
        style={{ height: artHeight, maxWidth: "82%", objectFit: "contain" }}
      />
    </div>
  );
}

function SlideShell({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ paddingBlockEnd: 44 }}
    >
      {children}
    </div>
  );
}

interface SlideProps<S extends Slide> {
  slide: S;
  lang: DeckLang;
  index: number;
}

function CoverSlide({
  slide,
  lang,
  index,
}: SlideProps<Extract<Slide, { type: "cover" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <SlideShell>
      {slide.eyebrow ? (
        <p style={eyebrowStyle(c, lang)}>{t(slide.eyebrow, lang)}</p>
      ) : null}
      <h1
        className="text-balance"
        style={{ ...headlineStyle(92, lang), marginBlockStart: 30 }}
      >
        {t(slide.headline, lang)}
      </h1>
      {slide.sub ? (
        <p
          className="text-balance"
          style={{
            ...bodyStyle(c, lang, 34),
            marginBlockStart: 28,
            maxWidth: 720,
          }}
        >
          {t(slide.sub, lang)}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 items-end">
        <span
          className="flex items-center gap-3 rounded-full"
          style={{
            fontSize: 25,
            color: c.muted,
            border: `2px solid ${c.hairline}`,
            paddingInline: 26,
            paddingBlock: 12,
            marginBlockEnd: 28,
          }}
        >
          {lang === "ar" ? "اسحب" : "swipe"}
          <span aria-hidden style={{ color: c.accent, fontSize: 28 }}>
            {lang === "ar" ? "←" : "→"}
          </span>
        </span>
      </div>
      {slide.art ? (
        <ArtPlate
          file={slide.art}
          index={index}
          canvas={c.bg}
          height={500}
          artHeight={392}
        />
      ) : null}
    </SlideShell>
  );
}

function PointSlide({
  slide,
  lang,
  index,
}: SlideProps<Extract<Slide, { type: "point" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <SlideShell>
      {slide.kicker ? (
        <p style={eyebrowStyle(c, lang)}>{t(slide.kicker, lang)}</p>
      ) : null}
      <h2
        className="text-balance"
        style={{ ...headlineStyle(62, lang), marginBlockStart: 28 }}
      >
        {t(slide.headline, lang)}
      </h2>
      {slide.body ? (
        <p
          style={{ ...bodyStyle(c, lang), marginBlockStart: 24, maxWidth: 780 }}
        >
          {t(slide.body, lang)}
        </p>
      ) : null}
      {slide.art ? (
        <div className="flex min-h-0 flex-1 items-end justify-end">
          <ArtPlate
            file={slide.art}
            index={index}
            canvas={c.bg}
            height={430}
            artHeight={330}
            width={640}
          />
        </div>
      ) : null}
    </SlideShell>
  );
}

function StatSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "stat" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <SlideShell>
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <span
          aria-hidden
          style={{
            width: 120,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.accent,
            marginBlockEnd: 52,
          }}
        />
        <p
          className="text-start"
          style={{
            fontSize: 240,
            fontWeight: 650,
            lineHeight: 1,
            color: c.accent,
            letterSpacing: "-0.03em",
          }}
        >
          {/* inner span keeps digit order LTR while the paragraph aligns with the slide's direction */}
          <span dir="ltr">{slide.value}</span>
        </p>
        <p
          className="text-balance"
          style={{ ...headlineStyle(50, lang), marginBlockStart: 34 }}
        >
          {t(slide.label, lang)}
        </p>
        {slide.support ? (
          <p style={{ ...bodyStyle(c, lang, 30), marginBlockStart: 24 }}>
            {t(slide.support, lang)}
          </p>
        ) : null}
      </div>
    </SlideShell>
  );
}

function QuoteSlide({
  slide,
  lang,
  index,
}: SlideProps<Extract<Slide, { type: "quote" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <SlideShell>
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <span
          aria-hidden
          style={{
            fontSize: 130,
            lineHeight: 1,
            color: c.accent,
            fontWeight: 650,
          }}
        >
          {lang === "ar" ? "«" : "“"}
        </span>
        <blockquote
          className="text-balance"
          style={{ ...headlineStyle(58, lang), marginBlockStart: 6 }}
        >
          {t(slide.text, lang)}
        </blockquote>
        {slide.attribution ? (
          <p style={{ ...bodyStyle(c, lang, 29), marginBlockStart: 36 }}>
            — {t(slide.attribution, lang)}
          </p>
        ) : null}
        {slide.art ? (
          <div className="flex justify-end" style={{ marginBlockStart: 48 }}>
            <ArtPlate
              file={slide.art}
              index={index}
              canvas={c.bg}
              height={300}
              artHeight={224}
              width={460}
              radius={32}
            />
          </div>
        ) : null}
      </div>
    </SlideShell>
  );
}

function StepsSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "steps" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <SlideShell>
      <h2 className="text-balance" style={headlineStyle(54, lang)}>
        {t(slide.headline, lang)}
      </h2>
      <ol className="flex flex-col" style={{ marginBlockStart: 52, gap: 40 }}>
        {slide.items.map((item, i) => (
          <li key={i} className="flex items-start gap-6">
            <span
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: 58,
                height: 58,
                backgroundColor: c.accent,
                color: THEMES.ivory.bg,
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                ...bodyStyle(c, lang, 34),
                color: c.ink,
                paddingBlockStart: 7,
              }}
            >
              {t(item, lang)}
            </span>
          </li>
        ))}
      </ol>
    </SlideShell>
  );
}

function CtaSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "cta" }>>): ReactElement {
  const c = THEMES[slide.theme];
  const host = new URL(slide.url).host;
  return (
    <SlideShell>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <h2
          className="text-balance"
          style={{ ...headlineStyle(76, lang), maxWidth: 840 }}
        >
          {t(slide.headline, lang)}
        </h2>
        <span
          className="rounded-full"
          style={{
            marginBlockStart: 56,
            paddingInline: 52,
            paddingBlock: 24,
            backgroundColor: c.accent,
            color: slide.theme === "clay" ? THEMES.ivory.bg : c.bg,
            fontSize: 34,
            fontWeight: 600,
          }}
        >
          {t(slide.action, lang)}
        </span>
        <p
          dir="ltr"
          style={{ marginBlockStart: 40, fontSize: 28, color: c.muted }}
        >
          {host}
        </p>
      </div>
    </SlideShell>
  );
}

export function SlideRenderer({
  slide,
  lang,
  index,
}: {
  slide: Slide;
  lang: DeckLang;
  index: number;
}): ReactElement {
  switch (slide.type) {
    case "cover":
      return <CoverSlide slide={slide} lang={lang} index={index} />;
    case "point":
      return <PointSlide slide={slide} lang={lang} index={index} />;
    case "stat":
      return <StatSlide slide={slide} lang={lang} index={index} />;
    case "quote":
      return <QuoteSlide slide={slide} lang={lang} index={index} />;
    case "steps":
      return <StepsSlide slide={slide} lang={lang} index={index} />;
    case "cta":
      return <CtaSlide slide={slide} lang={lang} index={index} />;
  }
}
