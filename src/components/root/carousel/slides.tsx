import type { CSSProperties, ReactElement } from "react";
import { Art } from "./art";
import { THEMES, type ThemeColors } from "./palette";
import type { Bilingual, DeckLang, Slide } from "./schema";

/**
 * The six slide archetypes, drawn in the Anthropic design language:
 * generous whitespace, ink on ivory, one Clay accent, one illustration.
 * All type sizes are absolute px against the fixed 1080px artboard.
 * Arabic never gets letter-spacing (it breaks the connected script) and
 * always gets taller line-height for diacritic clearance.
 */

function t(field: Bilingual, lang: DeckLang): string {
  return field[lang];
}

function eyebrowStyle(c: ThemeColors, lang: DeckLang): CSSProperties {
  return lang === "ar"
    ? { fontSize: 28, fontWeight: 500, color: c.accent }
    : {
        fontSize: 25,
        fontWeight: 600,
        color: c.accent,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      };
}

function headlineStyle(size: number, lang: DeckLang): CSSProperties {
  return {
    fontSize: lang === "ar" ? Math.round(size * 0.94) : size,
    fontWeight: 650,
    lineHeight: lang === "ar" ? 1.4 : 1.12,
    letterSpacing: lang === "ar" ? undefined : "-0.02em",
  };
}

function bodyStyle(c: ThemeColors, lang: DeckLang, size = 33): CSSProperties {
  return {
    fontSize: size,
    lineHeight: lang === "ar" ? 1.75 : 1.5,
    color: c.muted,
    fontWeight: 400,
  };
}

interface SlideProps<S extends Slide> {
  slide: S;
  lang: DeckLang;
}

function CoverSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "cover" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {slide.eyebrow ? (
        <p style={eyebrowStyle(c, lang)}>{t(slide.eyebrow, lang)}</p>
      ) : null}
      <h1
        className="text-balance"
        style={{ ...headlineStyle(88, lang), marginBlockStart: 40 }}
      >
        {t(slide.headline, lang)}
      </h1>
      {slide.sub ? (
        <p
          className="text-balance"
          style={{
            ...bodyStyle(c, lang, 36),
            marginBlockStart: 36,
            maxWidth: 780,
          }}
        >
          {t(slide.sub, lang)}
        </p>
      ) : null}
      <div
        className="flex min-h-0 flex-1 items-end justify-between"
        style={{ paddingBlockEnd: 40 }}
      >
        <span
          className="flex items-center gap-3"
          style={{ fontSize: 26, color: c.muted }}
        >
          {lang === "ar" ? "اسحب" : "swipe"}
          <span aria-hidden style={{ color: c.accent, fontSize: 30 }}>
            {lang === "ar" ? "←" : "→"}
          </span>
        </span>
        {slide.art ? (
          <Art
            name={slide.art}
            style={{ height: 420, maxWidth: 560, objectFit: "contain" }}
          />
        ) : null}
      </div>
    </div>
  );
}

function PointSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "point" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {slide.kicker ? (
        <p style={eyebrowStyle(c, lang)}>{t(slide.kicker, lang)}</p>
      ) : null}
      <h2
        className="text-balance"
        style={{ ...headlineStyle(64, lang), marginBlockStart: 36 }}
      >
        {t(slide.headline, lang)}
      </h2>
      {slide.body ? (
        <p
          style={{ ...bodyStyle(c, lang), marginBlockStart: 32, maxWidth: 820 }}
        >
          {t(slide.body, lang)}
        </p>
      ) : null}
      {slide.art ? (
        <div
          className="flex min-h-0 flex-1 items-end justify-end"
          style={{ paddingBlockEnd: 36 }}
        >
          <Art
            name={slide.art}
            style={{ height: 360, maxWidth: 520, objectFit: "contain" }}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "stat" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center"
      style={{ paddingBlockEnd: 56 }}
    >
      <p
        className="text-start"
        style={{
          fontSize: 230,
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
        style={{ ...headlineStyle(52, lang), marginBlockStart: 36 }}
      >
        {t(slide.label, lang)}
      </p>
      {slide.support ? (
        <p style={{ ...bodyStyle(c, lang), marginBlockStart: 28 }}>
          {t(slide.support, lang)}
        </p>
      ) : null}
    </div>
  );
}

function QuoteSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "quote" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center"
      style={{ paddingBlockEnd: 48 }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 120,
          lineHeight: 1,
          color: c.accent,
          fontWeight: 650,
        }}
      >
        {lang === "ar" ? "«" : "“"}
      </span>
      <blockquote
        className="text-balance"
        style={{ ...headlineStyle(60, lang), marginBlockStart: 8 }}
      >
        {t(slide.text, lang)}
      </blockquote>
      {slide.attribution ? (
        <p style={{ ...bodyStyle(c, lang, 30), marginBlockStart: 40 }}>
          — {t(slide.attribution, lang)}
        </p>
      ) : null}
      {slide.art ? (
        <div className="flex justify-end" style={{ marginBlockStart: 24 }}>
          <Art
            name={slide.art}
            style={{ height: 260, maxWidth: 420, objectFit: "contain" }}
          />
        </div>
      ) : null}
    </div>
  );
}

function StepsSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "steps" }>>): ReactElement {
  const c = THEMES[slide.theme];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-balance" style={headlineStyle(56, lang)}>
        {t(slide.headline, lang)}
      </h2>
      <ol className="flex flex-col" style={{ marginBlockStart: 48, gap: 36 }}>
        {slide.items.map((item, i) => (
          <li key={i} className="flex items-start gap-6">
            <span
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
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
                paddingBlockStart: 6,
              }}
            >
              {t(item, lang)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CtaSlide({
  slide,
  lang,
}: SlideProps<Extract<Slide, { type: "cta" }>>): ReactElement {
  const c = THEMES[slide.theme];
  const host = new URL(slide.url).host;
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"
      style={{ paddingBlockEnd: 56 }}
    >
      <h2
        className="text-balance"
        style={{ ...headlineStyle(72, lang), maxWidth: 860 }}
      >
        {t(slide.headline, lang)}
      </h2>
      <span
        className="rounded-full"
        style={{
          marginBlockStart: 64,
          paddingInline: 56,
          paddingBlock: 26,
          backgroundColor: c.accent,
          color: slide.theme === "clay" ? THEMES.ivory.bg : c.bg,
          fontSize: 36,
          fontWeight: 600,
        }}
      >
        {t(slide.action, lang)}
      </span>
      <p
        dir="ltr"
        style={{ marginBlockStart: 44, fontSize: 30, color: c.muted }}
      >
        {host}
      </p>
    </div>
  );
}

export function SlideRenderer({
  slide,
  lang,
}: {
  slide: Slide;
  lang: DeckLang;
}): ReactElement {
  switch (slide.type) {
    case "cover":
      return <CoverSlide slide={slide} lang={lang} />;
    case "point":
      return <PointSlide slide={slide} lang={lang} />;
    case "stat":
      return <StatSlide slide={slide} lang={lang} />;
    case "quote":
      return <QuoteSlide slide={slide} lang={lang} />;
    case "steps":
      return <StepsSlide slide={slide} lang={lang} />;
    case "cta":
      return <CtaSlide slide={slide} lang={lang} />;
  }
}
