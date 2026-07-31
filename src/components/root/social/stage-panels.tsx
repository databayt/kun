"use client";

// The two StageNote mounts that need live context: the keyword pill quotes the
// selected brand ("content calendar for hogwarts"), which only the provider
// knows. Kept together so the calendar and media pages stay server-thin.

import { StageNote } from "@/components/root/social/stage-note";
import { useSocial } from "@/components/root/social/provider";

export function CalendarPanel() {
  const { lang, t, product } = useSocial();
  return (
    <StageNote
      title={t.calendarNoteTitle}
      body={t.calendarNoteBody}
      keyword={`content calendar for ${product}`}
      docsHref={`/${lang}/docs/social/strategy`}
      t={t}
    />
  );
}

export function MediaPanel() {
  const { lang, t, product } = useSocial();
  return (
    <StageNote
      title={t.mediaNoteTitle}
      body={t.mediaNoteBody}
      keyword={`higgs an image for ${product}`}
      docsHref={`/${lang}/docs/social/carousel`}
      t={t}
    />
  );
}
