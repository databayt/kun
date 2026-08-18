// The showroom — the Media stage grown from a StageNote into the gallery the
// cdn.mdx open question asked for: what we generated (library.json) and what
// we keep as reference (references.json), one grid, plus the rendered decks.
// Server component: both registries are static imports, decks come from the
// brand deckDirs at request time.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/components/local/config";
import { getSocialDict } from "@/components/root/social/dictionary";
import { listDecks } from "@/components/root/carousel/content";
import {
  chatgptTypes,
  listPendingBriefs,
  listRenderedBriefs,
} from "@/lib/social-media-brief";
import { briefAsAsset, getShowroomData } from "./data";
import { BrandShelves } from "./brand-shelf";
import { BriefQueue } from "./brief-queue";
import { MediaStudio } from "./media-studio";
import { ShowroomGrid } from "./grid";
import { ShowroomKeyword } from "./keyword-pill";

// The brand the seat lane files against. One brand today by deliberate scope
// (hogwarts is the pilot); the picker appears the day a second brand has a kit.
const SEAT_BRAND = "hogwarts";

export async function ShowroomContent({ lang }: { lang: Locale }) {
  const t = getSocialDict(lang);
  // Three independent reads — the decks list touches the filesystem and the two
  // brief reads touch the database, so they overlap rather than queue.
  const [decks, pending, rendered] = await Promise.all([
    // Local-path deckDirs make this an empty list on Vercel until decks land in
    // kun's content/carousels/ — the section hides rather than faking cards.
    listDecks().catch(() => []),
    listPendingBriefs(),
    listRenderedBriefs(),
  ]);
  const { assets, generatedCount, referenceCount } = getShowroomData(
    rendered.map(briefAsAsset),
  );

  return (
    <section className="space-y-12 py-8 md:py-12">
      {/* Media Studio — the Prompt Area for generating images, video reels, and cards */}
      <MediaStudio />

      <div id="showroom-gallery" className="space-y-10 border-t pt-10">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-primary text-base font-medium">
            {t.showroomTitle}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed font-light">
            {t.showroomIntro}
          </p>
          <ShowroomKeyword />
          <p>
            <Link
              href={`/${lang}/docs/media`}
              className="text-primary text-sm hover:underline"
            >
              {t.stageNoteDocs}
              <ArrowRight className="ms-1 inline size-4 align-middle rtl:rotate-180" />
            </Link>
          </p>
        </div>

        <BriefQueue
          briefs={pending}
          types={chatgptTypes(SEAT_BRAND)}
          brand={SEAT_BRAND}
        />
      </div>

      {decks.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {t.decksTitle}
          </h4>
          <div className="flex flex-wrap gap-2">
            {decks.map((deck) => (
              <Link
                key={`${deck.brand}/${deck.slug}`}
                href={`/${lang}/carousel/${deck.brand}/${deck.slug}`}
                className="bg-muted hover:bg-muted/80 px-3 py-1.5 font-mono text-xs transition-colors"
              >
                {deck.brand}/{deck.slug}
              </Link>
            ))}
          </div>
        </div>
      )}

      <BrandShelves assets={assets} />

      <ShowroomGrid assets={assets} />

      <p className="text-muted-foreground text-center text-xs" dir="ltr">
        {generatedCount} generated · {referenceCount} references ·
        content/media/
      </p>
    </section>
  );
}
