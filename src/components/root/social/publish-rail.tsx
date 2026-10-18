"use client";

// Publish as a launch base — what the brand and feature picks recommend.
//
// The box above searches the queue and writes from scratch; this rail answers
// the other half of arriving at Publish with a brand and a feature in mind:
// which fully composed calendar posts are due for it, and which media on the
// shelf fits it. One press loads a post (copy and media) into the editor or
// drops an asset into the tray. With a draft loaded, the rail turns into its
// controls: which language goes out, and Reject with a reason.

import { useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DISMISS_REASONS } from "@/components/root/social/knobs";
import { MediaThumb } from "@/components/root/social/media-thumb";
import { ANY_FEATURE } from "@/components/root/social/post-settings";
import { findSlot } from "@/components/root/social/plan";
import {
  useSocial,
  type ComposerLang,
} from "@/components/root/social/provider";
import type { SocialDict } from "@/components/root/social/dictionary";

const REASON_LABEL: Record<string, keyof SocialDict> = {
  hook: "dismissReasonHook",
  "two-posts": "dismissReasonTwoPosts",
  untrue: "dismissReasonUntrue",
  register: "dismissReasonRegister",
  cta: "dismissReasonCta",
  length: "dismissReasonLength",
  other: "dismissReasonOther",
};

export function PublishRail() {
  const {
    t,
    product,
    feature,
    brandMedia,
    composerMediaUrls,
    attachMedia,
    reviewQueue,
  } = useSocial();
  const { drafts, activeDraftId, loadDraft, composerLang, setComposerLang } =
    reviewQueue;
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Calendar posts for this brand (and feature), the oldest slot first.
  const due = useMemo(
    () =>
      drafts
        .filter(
          (d) =>
            d.slot &&
            d.brand === product &&
            (feature === ANY_FEATURE || d.feature === feature),
        )
        .map((d) => ({ draft: d, slot: findSlot(d.slot as string) }))
        .sort((a, b) => (a.slot?.date ?? "").localeCompare(b.slot?.date ?? "")),
    [drafts, product, feature],
  );

  const media = brandMedia
    .filter((m) => !composerMediaUrls.includes(m.url))
    .slice(0, 12);

  const active = drafts.find((d) => d.id === activeDraftId);

  const reject = async (reason: (typeof DISMISS_REASONS)[number]["id"]) => {
    setRejectError(null);
    const err = await reviewQueue.rejectActive(reason);
    if (err) setRejectError(err);
    setRejecting(false);
  };

  if (!active && due.length === 0 && media.length === 0) return null;

  return (
    <div className="mx-auto mt-6 w-full max-w-3xl space-y-5 text-start">
      {active && (
        <div className="border-border flex flex-wrap items-center gap-2 rounded-2xl border p-3">
          <div
            role="radiogroup"
            className="bg-muted flex items-center gap-0.5 rounded-full p-0.5"
          >
            {(
              [
                ["ar", t.composerLangAr],
                ["en", t.composerLangEn],
                ["both", t.composerLangBoth],
              ] as [ComposerLang, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={composerLang === id}
                disabled={id !== "ar" && !active.en}
                onClick={() => setComposerLang(id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                  composerLang === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {active.slot && (
            <span className="text-muted-foreground font-mono text-[11px]">
              {active.slot}
            </span>
          )}

          <div className="ms-auto flex items-center gap-1.5">
            {rejecting ? (
              <>
                <span className="text-muted-foreground text-xs">
                  {t.dismissReasonTitle}
                </span>
                {DISMISS_REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void reject(r.id)}
                    className="hover:bg-muted rounded-full border px-2 py-0.5 text-[11px]"
                  >
                    {t[REASON_LABEL[r.id]]}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label={t.rejectCancel}
                  onClick={() => setRejecting(false)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive h-7 rounded-full text-xs"
                onClick={() => setRejecting(true)}
              >
                {t.rejectDraft}
              </Button>
            )}
          </div>
          {rejectError && (
            <p role="alert" className="text-destructive w-full text-xs">
              {rejectError}
            </p>
          )}
        </div>
      )}

      {due.length > 0 && (
        <section>
          <h4 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
            <CalendarDays className="size-3.5" />
            {t.recFromCalendar}
          </h4>
          <div className="flex snap-x gap-2 overflow-x-auto pb-1">
            {due.map(({ draft, slot }) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => loadDraft(draft.id)}
                aria-pressed={draft.id === activeDraftId}
                className={cn(
                  "border-border bg-muted/30 hover:bg-muted w-56 shrink-0 snap-start rounded-xl border p-3 text-start transition-colors",
                  draft.id === activeDraftId && "border-foreground/40",
                )}
              >
                <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px]">
                  <span className="font-mono">{slot?.date ?? draft.slot}</span>
                  {slot && <span>· {slot.kind}</span>}
                  {draft.mediaUrls.length > 0 && (
                    <span className="ms-auto">▣ {draft.mediaUrls.length}</span>
                  )}
                </div>
                <p dir="auto" className="line-clamp-3 text-xs leading-snug">
                  {draft.ar || draft.en}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {media.length > 0 && (
        <section>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium">
            {t.recommendedMedia}
          </h4>
          <div className="flex flex-wrap gap-2">
            {media.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => attachMedia(m.url)}
                title={m.title}
                aria-label={m.title}
                className="border-border hover:border-foreground/40 size-16 shrink-0 overflow-hidden rounded-xl border transition-colors"
              >
                <MediaThumb src={m.url} className="size-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
