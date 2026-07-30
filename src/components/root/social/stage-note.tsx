// A pipeline stage the Hub does not implement.
//
// Plan and Media are real stages (docs/social) with no in-app state: the
// calendar's output is a dated table nothing here persists, and /higgs writes to
// the CDN. Leaving their tabs out would hide two sevenths of the pipeline from
// whoever is learning it; inventing a surface for them would be worse. So the
// tab says where the stage actually runs, and hands over the words to say.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SocialDict } from "@/components/root/social/dictionary";

interface StageNoteProps {
  title: string;
  body: string;
  /** The prose a contributor says to a session, e.g. "content calendar for hogwarts". */
  keyword: string;
  docsHref: string;
  t: SocialDict;
}

export function StageNote({
  title,
  body,
  keyword,
  docsHref,
  t,
}: StageNoteProps) {
  return (
    <section className="mx-auto max-w-xl py-16 text-center md:py-24">
      <h3 className="text-primary text-base font-medium">{title}</h3>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed font-light">
        {body}
      </p>

      <p className="text-muted-foreground/70 mt-8 text-xs">
        {t.stageNoteKeyword}
      </p>
      <p className="bg-muted text-foreground mt-2 inline-block rounded-lg px-3 py-1.5 font-mono text-sm">
        {keyword}
      </p>

      <p className="mt-6">
        <Link href={docsHref} className="text-primary text-sm hover:underline">
          {t.stageNoteDocs}
          <ArrowRight className="ms-1 inline size-4 align-middle rtl:rotate-180" />
        </Link>
      </p>
    </section>
  );
}
