import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/components/root/carousel/fonts.css";
import { readDeck } from "@/components/root/carousel/content";
import { SlideFrame } from "@/components/root/carousel/frame";
import { SlideRenderer } from "@/components/root/carousel/slides";
import type { Deck, DeckLang } from "@/components/root/carousel/schema";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Decks are read from the filesystem per request — a noindex render frame
// gains nothing from static optimization.
export const dynamic = "force-dynamic";

const SIZES: Record<string, readonly [number, number]> = {
  "1080x1350": [1080, 1350],
  "1080x1080": [1080, 1080],
  "1080x1920": [1080, 1920],
};
const DEFAULT_SIZE = "1080x1350";

export default async function CarouselPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; brand: string; slug: string }>;
  searchParams: Promise<{ slide?: string; size?: string; view?: string }>;
}) {
  const { lang: rawLang, brand, slug } = await params;
  const { slide, size, view } = await searchParams;
  const lang: DeckLang = rawLang === "ar" ? "ar" : "en";

  let deck: Deck;
  try {
    deck = await readDeck(brand, slug);
  } catch {
    notFound();
  }

  const [w, h] = SIZES[size ?? DEFAULT_SIZE] ?? SIZES[DEFAULT_SIZE];
  const total = deck.slides.length;

  // Exact-pixel frame — what Playwright screenshots.
  if (slide) {
    const index = Number(slide);
    const current = deck.slides[index - 1];
    if (!current) notFound();
    return (
      <main className="w-fit">
        <SlideFrame
          w={w}
          h={h}
          index={index}
          total={total}
          brand={deck.brand}
          theme={current.theme}
          lang={lang}
        >
          <SlideRenderer slide={current} lang={lang} index={index - 1} />
        </SlideFrame>
      </main>
    );
  }

  // Figma board — BOTH languages, every slide at FULL size as its own
  // [data-frame]: row 1 Arabic, row 2 English, nothing else (no labels, no
  // chrome). One generate_figma_design capture imports the whole deck; a
  // single Ungroup in Figma leaves 16 standalone frames on the carousels
  // page. Each new push REPLACES the previous board container — delete the
  // old one, never stack.
  if (view === "board") {
    const rows: DeckLang[] = ["ar", "en"];
    return (
      <main className="flex w-max flex-col" style={{ gap: 120 }}>
        {rows.map((rowLang) => (
          <div
            key={rowLang}
            className="flex w-max items-start"
            style={{ gap: 64 }}
          >
            {deck.slides.map((s, i) => (
              <SlideFrame
                key={i}
                w={w}
                h={h}
                index={i + 1}
                total={total}
                brand={deck.brand}
                theme={s.theme}
                lang={rowLang}
              >
                <SlideRenderer slide={s} lang={rowLang} index={i} />
              </SlideFrame>
            ))}
          </div>
        ))}
      </main>
    );
  }

  // Review sheet — every slide at 40%, the human/browser-MCP QA surface.
  const scale = 0.4;
  return (
    <main className="flex flex-col gap-8 py-10">
      <header>
        <h1 className="text-xl font-semibold">{deck.title[lang]}</h1>
        <p className="text-muted-foreground text-sm">
          {deck.brand}/{deck.slug} · {lang} · {w}×{h} · {total} slides ·{" "}
          {deck.status}
        </p>
      </header>
      <div className="flex flex-wrap gap-8">
        {deck.slides.map((s, i) => (
          <figure key={i}>
            <figcaption className="text-muted-foreground pb-2 text-sm">
              {i + 1} · {s.type} · {s.theme}
            </figcaption>
            {/* dir=ltr pins the oversized frame to the clip box's left edge even
                on the RTL page — the frame carries its own dir internally. */}
            <div
              dir="ltr"
              className="overflow-hidden rounded-md shadow-sm"
              style={{ width: w * scale, height: h * scale }}
            >
              <div
                style={{
                  width: w,
                  height: h,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <SlideFrame
                  w={w}
                  h={h}
                  index={i + 1}
                  total={total}
                  brand={deck.brand}
                  theme={s.theme}
                  lang={lang}
                >
                  <SlideRenderer slide={s} lang={lang} index={i} />
                </SlideFrame>
              </div>
            </div>
          </figure>
        ))}
      </div>
    </main>
  );
}
