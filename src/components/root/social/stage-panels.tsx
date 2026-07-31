"use client";

// The StageNote mount that needs live context: the keyword pill quotes the
// selected brand ("content calendar for hogwarts"), which only the provider
// knows. The media stage's note grew into the showroom (showroom/content.tsx).

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
