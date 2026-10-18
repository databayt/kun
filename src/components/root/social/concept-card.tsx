"use client";

// The Draft stage's first value: understand the thing before writing about it.
//
// Shown above the box whenever there is something to understand — a calendar
// slot (its theme, angle, persona and the shape of the post) and the feature
// it is about (the SPOTLIGHT note written for the content team: the school's
// day without it, what happens in the product, what you can and cannot say).
// Its one button is the second value: kick the configured AI off from exactly
// this context, so the writer edits a first draft instead of a blank page.
//
// It serves the media team too: the feature's real screens (published by
// shoot/record, named in the SPOTLIGHT's `flows:`) attach in one tap, and a
// feature with none shows the routes to film and the command that films them.

import { useEffect, useState } from "react";
import { BookOpen, Camera, Check, Copy, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readConcept, type ConceptReadResult } from "@/actions/post-social";
import { fill } from "@/components/root/social/dictionary";
import { MediaThumb } from "@/components/root/social/media-thumb";
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
  const {
    t,
    product,
    feature,
    planSlot,
    setPlanSlot,
    draftQueue,
    attachMedia,
    composerMediaUrls,
  } = useSocial();
  const [data, setData] = useState<ConceptReadResult | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
  const screens = data?.screens ?? [];
  const gap = data?.gap;

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
    // Capped and scrolled inside: the stage centres a half-screen column, so a
    // card taller than its share overflows upward over the stage tabs. The
    // header and the kick-off stay put; the note and the screens scroll.
    <section className="border-border bg-muted/20 mx-auto mb-6 flex max-h-[38svh] w-full max-w-3xl flex-col rounded-2xl border p-4 text-start">
      <div className="mb-3 flex shrink-0 items-center gap-2">
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

      <div className="min-h-0 flex-1 overflow-y-auto">
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
          {concept.status === "partial" && (
            <p className="text-muted-foreground text-xs">
              {t.conceptStatusPartial}
            </p>
          )}
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

      {screens.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wider uppercase">
            {t.conceptScreens}
          </p>
          <div className="flex flex-wrap gap-2">
            {screens.map((m) => {
              const label = m.alt.en || m.alt.ar || m.id;
              const on = composerMediaUrls.includes(m.url);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => attachMedia(m.url)}
                  title={label}
                  aria-label={label}
                  aria-pressed={on}
                  className={cn(
                    "border-border hover:border-foreground/40 relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border transition-colors",
                    on && "border-foreground",
                  )}
                >
                  <MediaThumb src={m.url} className="size-full object-cover" />
                  <span className="bg-background/80 absolute end-1 bottom-1 rounded px-1 font-mono text-[9px] uppercase">
                    {m.lang}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {gap && (
        <div className="border-border mt-4 rounded-xl border border-dashed p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <Camera className="size-3.5" />
            {t.conceptNoScreens}
          </p>
          <p className="text-muted-foreground mb-2 text-xs">
            {fill(t.conceptShootHint, { routes: gap.routes.join(" · ") })}
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(gap.command).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="bg-muted hover:bg-muted/70 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start font-mono text-[11px]"
            dir="ltr"
          >
            <span className="min-w-0 flex-1 truncate">{gap.command}</span>
            {copied ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <Copy className="size-3.5 shrink-0" />
            )}
          </button>
        </div>
      )}

      </div>

      {kickOffBrief && (
        <div className="mt-3 flex shrink-0 justify-end">
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
