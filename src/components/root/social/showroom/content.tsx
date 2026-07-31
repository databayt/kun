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
import { getShowroomData } from "./data";
import { ShowroomGrid } from "./grid";
import { ShowroomKeyword } from "./keyword-pill";

export async function ShowroomContent({ lang }: { lang: Locale }) {
  const t = getSocialDict(lang);
  const { assets, generatedCount, referenceCount } = getShowroomData();
  // Local-path deckDirs make this an empty list on Vercel until decks land in
  // kun's content/carousels/ — the section hides rather than faking cards.
  const decks = await listDecks().catch(() => []);

  return (
    <section className="space-y-10 py-10 md:py-14">
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

      <ShowroomGrid assets={assets} />

      <p className="text-muted-foreground text-center text-xs" dir="ltr">
        {generatedCount} generated · {referenceCount} references ·
        content/media/
      </p>
    </section>
  );
}
