import * as React from "react";

/**
 * AnthropicHero — pixel-exact clone of the anthropic.com hero
 * ("AI research and products that put safety at the frontier").
 *
 * Captured at 1440px (pixel-exact). Values are mirrored verbatim from the
 * snapshot's computed styles as Tailwind arbitrary values; inline-axis spacing
 * uses logical utilities so the section also mirrors correctly under dir="rtl".
 *
 * Fonts: the source uses the proprietary "Anthropic Sans" (headline) and
 * "Anthropic Serif" (paragraph). Those are cataloged-but-not-downloadable, so
 * this component renders through the CSS variables --font-anthropic-sans /
 * --font-anthropic-serif (set them on an ancestor; the scratch preview wires
 * nearest next/font substitutes). Fallbacks match the captured stacks.
 */

type AnthropicHeroProps = {
  className?: string;
};

const sansFamily =
  "var(--font-anthropic-sans, ui-sans-serif), Arial, sans-serif";
const serifFamily = "var(--font-anthropic-serif, ui-serif), Georgia, serif";

export function AnthropicHero({
  className,
}: AnthropicHeroProps): React.JSX.Element {
  return (
    <header
      className={
        "flex flex-col text-start text-[rgb(20,20,19)] bg-[rgb(240,238,230)]" +
        (className ? ` ${className}` : "")
      }
    >
      {/* top section spacer — captured 150.594px @1440 (smaller on mobile) */}
      <div className="h-[88px] md:h-[120px] lg:h-[150.594px]" aria-hidden />

      {/* u-container: max-width ~1284.54px, centered. Side inset shrinks on
          smaller viewports (375 → 32px, 768 → ~47px, 1440 → 77.7344px). */}
      <div className="relative mx-auto w-full max-w-[1284.54px] px-[32px] md:px-[47.4px] lg:px-[77.7344px]">
        {/* home_hero_grid: stacks on mobile (375), 12-col grid from 768.
            Items bottom-aligned, gap 31.4776px. */}
        <div className="flex flex-col gap-[31.4776px] md:grid md:grid-cols-[repeat(12,minmax(0,1fr))] md:items-end">
          {/* u-column-7 — headline */}
          <div className="md:col-[auto/span_7]">
            <h1
              className="text-[40px] font-[700] leading-[1.1] text-start md:text-[47.6996px] md:leading-[1.1] lg:text-[60.8653px] lg:leading-[66.9518px]"
              style={{ fontFamily: sansFamily }}
            >
              {/* visually-hidden accessible sentence (source u-sr-only) */}
              <span className="sr-only">
                AI <a href="https://www.anthropic.com/research">research</a> and{" "}
                <a href="https://claude.com/product/overview">products</a> that
                put safety at the frontier
              </span>

              {/* visible word run — aria-hidden so SR reads the clean sentence above */}
              <span aria-hidden="true">
                <span className="inline-block">AI</span>{" "}
                <a
                  href="https://www.anthropic.com/research"
                  data-cta-copy="Research"
                  data-cta="Home page"
                  data-cta-position="Hero section"
                >
                  <span className="inline-block underline">research</span>
                </a>{" "}
                <span className="inline-block">and</span>{" "}
                <a
                  href="https://claude.com/product/overview"
                  target="_blank"
                  rel="noreferrer"
                  data-cta-copy="Products"
                  data-cta="Home page"
                  data-cta-position="Hero section"
                >
                  <span className="inline-block underline">products</span>
                </a>{" "}
                <span className="inline-block">that</span>{" "}
                <span className="inline-block">put</span>{" "}
                <span className="inline-block">safety</span>{" "}
                <span className="inline-block">at</span>{" "}
                <span className="inline-block">the</span>{" "}
                <span className="inline-block">frontier</span>
              </span>
            </h1>
          </div>

          {/* u-column-5 — paragraph, bottom-aligned with 5px baseline bump */}
          <div className="md:col-[auto/span_5]">
            <div className="pb-[5px]">
              <p
                className="max-w-[594.229px] text-[24px] leading-[33.6px] text-start"
                style={{ fontFamily: serifFamily }}
              >
                AI will have a vast impact on the world. Anthropic is a public
                benefit corporation dedicated to securing its benefits and
                mitigating its risks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* bottom section spacer — captured 60.8594px */}
      <div className="h-[60.8594px]" aria-hidden />
    </header>
  );
}

export default AnthropicHero;
