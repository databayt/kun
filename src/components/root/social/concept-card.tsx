"use client";

// The Draft stage's first value: understand the thing before writing about it.
//
// Shown above the box whenever there is something to understand — a calendar
// slot (its theme, angle, persona and the shape of the post) and the feature
// it is about (the SPOTLIGHT note written for the content team: the school's
// day without it, what happens in the product, what you can and cannot say).
// Its one button is the second value: kick the configured AI off from exactly
// this context, so the writer edits a first draft instead of a blank page.

import { useEffect, useState } from "react";
import { BookOpen, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readConcept, type ConceptReadResult } from "@/actions/post-social";
import { fill } from "@/components/root/social/dictionary";
import { ANY_FEATURE } from "@/components/root/social/post-settings";
import { useSocial } from "@/components/root/social/provider";

function Section({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <p
        dir="auto"
        className="text-foreground/90 text-sm leading-relaxed whitespace-pre-line"
      >
        {body}
      </p>
    </div>
  );
}

export function ConceptCard() {
  const { t, product, feature, planSlot, setPlanSlot, draftQueue } =
    useSocial();
  const [data, setData] = useState<ConceptReadResult | null>(null);
  const [open, setOpen] = useState(false);

  const wantedFeature = feature !== ANY_FEATURE ? feature : undefined;

  useEffect(() => {
    if (!planSlot && !wantedFeature) {
      setData(null);
      return;
    }
    let cancelled = false;
    readConcept({
      product,
      feature: wantedFeature,
      slot: planSlot ?? undefined,
    })
      .then((res) => {
        if (!cancelled) setData(res.ok ? res : null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [product, wantedFeature, planSlot]);

  const slot = data?.slot;
  const concept = data?.concept;

  if (!planSlot && !wantedFeature) {
    return (
      <p className="text-muted-foreground/70 mx-auto mb-4 max-w-xl text-center text-xs leading-relaxed">
        {t.conceptPick}
      </p>
    );
  }
  if (!data) return null;

  // What the kick-off asks for: the slot's assignment when there is one,
  // otherwise a post about the feature in its own one line.
  const kickOffBrief = slot
    ? `${slot.kind} post for the ${slot.persona} — ${slot.angle} Theme: ${slot.theme}. ${slot.slotGuide}`
    : concept
      ? `A post about ${concept.title} for ${concept.personas[0] ?? "school owners"}: ${concept.oneLine}`
      : null;

  // Kicking off from a draft already on screen would refine it instead — the
  // card only offers a fresh start.
  const canKickOff =
    kickOffBrief !== null && !draftQueue.busy && !draftQueue.draft;

  return (
    <section className="border-border bg-muted/20 mx-auto mb-6 w-full max-w-3xl rounded-2xl border p-4 text-start">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="text-muted-foreground size-4" />
        <h3 className="text-sm font-medium">{t.conceptTitle}</h3>
        {slot && (
          <span className="text-muted-foreground font-mono text-[11px]">
            {fill(t.conceptSlot, { key: slot.key, date: slot.date })}
          </span>
        )}
        {planSlot && (
          <button
            type="button"
            onClick={() => setPlanSlot(null)}
            aria-label={t.conceptClearSlot}
            className="text-muted-foreground hover:text-foreground ms-auto rounded-full p-1"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {slot && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Section label={t.conceptTheme} body={slot.theme} />
          <Section label={t.conceptPersona} body={slot.persona} />
          <Section label={t.conceptAngle} body={slot.angle} />
          <Section label={t.conceptShape} body={slot.slotGuide} />
        </div>
      )}

      {concept ? (
        <div className="space-y-3">
          <Section
            label={`${concept.title} · ${t.conceptOneLine}`}
            body={concept.oneLine}
          />
          <div className={cn("space-y-3", !open && "hidden")}>
            <Section label={t.conceptWithout} body={concept.without} />
            <Section label={t.conceptWhat} body={concept.what} />
            <Section label={t.conceptSay} body={concept.say} />
            <Section label={t.conceptDontSay} body={concept.dontSay} />
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-primary text-xs hover:underline"
          >
            {open ? t.conceptLess : t.conceptMore}
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{t.conceptMissing}</p>
      )}

      {kickOffBrief && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={!canKickOff}
            onClick={() => draftQueue.submit({ text: kickOffBrief, files: [] })}
            className="gap-1.5 rounded-full"
          >
            <Sparkles className="size-3.5" />
            {t.conceptKickOff}
          </Button>
        </div>
      )}
    </section>
  );
}
