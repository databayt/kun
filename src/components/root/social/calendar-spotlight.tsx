"use client";

// The Calendar stage's box — Publish's bar, planning instead of sending.
//
// Same glass, same 48px line, the fourth stage to wear it. Publish's field is
// a post and its panel is the queue; Media's field is a query and its panel is
// the library; this one's field is a query too, and its panel is the plan —
// `content/social/pillars.json`, the briefs the Monday seeder rotates into the
// draft queue. The seat on the right is the settings, because nothing here is
// being written or sent: a brief is filed, and the filing is on each row.
//
// Two questions off one file, which pillars.ts already named. The list under
// the fold answers "what is the plan this week" — every brief, in order, with
// the rotation's picks marked and a queue chip on each. This answers "give me
// something to post about admission", which is the question you actually
// arrive with, and it answers it in two words instead of a scroll.
//
// The Feature word narrows the plan the same way it narrows the queue on
// Publish and the library on Media: by matching the WORDS, since no brief
// records which feature it sells. Brand is the other word, and it is the only
// one that changes what the plan IS — the rest of the settings row stays
// behind, because a plan has no post shape and no channels.

import * as React from "react";
import { CalendarClock, Check, Plus, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { matchesQuery } from "@/lib/normalize-search";
import { fill } from "@/components/root/social/dictionary";
import { ConfigPanel, GLASS } from "@/components/root/social/spotlight";
import { featureFits } from "@/components/root/social/post-settings";
import { pillarSubject } from "@/components/root/social/pillars";
import { useSocial } from "@/components/root/social/provider";

/**
 * One brief as the box draws it: the plan's row, plus the two things only the
 * page around it knows — whether this week's rotation picks it, and where it
 * currently sits in the draft queue.
 *
 * Resolved by the parent rather than here because the LIST below the fold
 * renders the same two facts, and a brief queued from this box has to grey out
 * down there in the same breath. One owner, two readers.
 */
export interface CalendarRow {
  id: string;
  pillar: string;
  brief: string;
  /** This week's rotation picks it — the Monday seeder will file it anyway. */
  isPick: boolean;
  /** pending · answered · consumed · dismissed · failed, or not asked yet. */
  state: string | null;
}

export function CalendarSpotlight({
  rows,
  queueing,
  onQueue,
  stateLabel,
  onEngagedChange,
}: {
  rows: CalendarRow[];
  /** The brief id currently being filed, if any — one at a time. */
  queueing: string | null;
  onQueue: (row: CalendarRow) => void;
  stateLabel: (state: string) => string;
  onEngagedChange?: (engaged: boolean) => void;
}) {
  const {
    t,
    isRTL,
    product,
    setProduct,
    wiredForProduct,
    selectedChannels,
    setSelectedChannels,
    feature,
    setFeature,
    brandFeatures,
    postType,
    setPostType,
    mediaFilter,
    setMediaFilter,
    mediaType,
    setMediaType,
    imageStyle,
    setImageStyle,
  } = useSocial();

  const [query, setQuery] = React.useState("");
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const open = focused;
  React.useEffect(() => onEngagedChange?.(open), [open, onEngagedChange]);

  /**
   * The plan, narrowed and then reordered.
   *
   * Feature narrows before the query, so the count on the bar reads as "of
   * what I am allowed to see" rather than "of everything planned" — the same
   * rule Media's box follows. The pillar and the id are in the haystack on
   * purpose: "trust" and "hog-04" are both things a person types, and neither
   * appears in the brief's prose.
   *
   * Then this week's picks float to the top. They are what the seeder is
   * going to file on Monday whether or not anyone opens this page, so they are
   * the rows most worth seeing first — and marking them without ordering them
   * would put the badge four scrolls down.
   */
  const shown = React.useMemo(() => {
    const q = query.trim();
    const haystack = (row: CalendarRow) =>
      [row.brief, row.pillar, row.id].join(" ");
    return rows
      .filter((row) => {
        if (!featureFits(product, haystack(row), feature)) return false;
        if (!q) return true;
        return matchesQuery(haystack(row), q);
      })
      .sort((a, b) => Number(b.isPick) - Number(a.isPick));
  }, [rows, query, product, feature]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        ref={rootRef}
        className={cn(GLASS, "overflow-hidden rounded-[28px]")}
        onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
          const next = e.relatedTarget;
          if (next instanceof Node && rootRef.current?.contains(next)) return;
          window.setTimeout(() => setFocused(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          setFocused(false);
          inputRef.current?.blur();
        }}
      >
        <div className="relative flex h-12 items-center gap-2 ps-3 pe-2">
          {/* A calendar, where Media has a magnifying glass and Publish a ⊕.
              The glyph is the stage: this field searches, but what it searches
              is a week's worth of plan rather than a drawer of pictures. */}
          <span className="text-muted-foreground/70 flex size-9 shrink-0 items-center justify-center">
            <CalendarClock className="size-5" />
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // The frame lifts its own column off the engagement this
            // reports — see stage.tsx.
            onFocus={() => setFocused(true)}
            placeholder={t.calendarSpotlightPlaceholder}
            // 16px keeps iOS Safari from zooming the page on focus.
            className={cn(
              "flex h-12 w-full bg-transparent text-base outline-hidden",
              "placeholder:text-muted-foreground/70",
            )}
          />

          {/* How much of the plan the query is looking at — the only thing on
              the bar that moves as you type, which is what says the search is
              running at all. */}
          <span
            className="text-muted-foreground/60 shrink-0 pe-2 text-xs tabular-nums"
            dir="ltr"
          >
            {fill(t.calendarSpotlightCount, {
              shown: shown.length,
              total: rows.length,
            })}
          </span>

          {/* The seat. Publish sends from here and Draft asks; a plan has
              nothing to send, so the seat is only ever the settings. */}
          <button
            type="button"
            aria-label={t.spotlightConfig}
            title={t.spotlightConfig}
            aria-expanded={open && openSection !== null}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpenSection((current) => (current ? null : "brand"));
              setFocused(true);
              inputRef.current?.focus();
            }}
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
              "transition-colors duration-150",
              open && openSection !== null
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
            )}
          >
            <Settings className="size-5" />
          </button>
        </div>

        {open && openSection !== null && (
          <div className="relative max-h-[min(360px,45vh)] overflow-y-auto border-t border-black/5 dark:border-white/10">
            <div className="p-3">
              <ConfigPanel
                words={["brand", "feature"]}
                t={t}
                isRTL={isRTL}
                product={product}
                onProduct={setProduct}
                wired={wiredForProduct}
                selected={selectedChannels}
                onChannels={setSelectedChannels}
                feature={feature}
                onFeature={setFeature}
                features={brandFeatures}
                postType={postType}
                onPostType={setPostType}
                mediaFilter={mediaFilter}
                onMediaFilter={setMediaFilter}
                mediaType={mediaType}
                onMediaType={setMediaType}
                imageStyle={imageStyle}
                onImageStyle={setImageStyle}
                onOpenDialog={(section) => setOpenSection(section)}
                openSection={openSection as never}
                onCloseSection={() => setOpenSection(null)}
              />
            </div>
          </div>
        )}

        {open && openSection === null && (
          <div className="relative max-h-[min(360px,45vh)] overflow-y-auto border-t border-black/5 dark:border-white/10">
            {rows.length === 0 ? (
              <p className="text-muted-foreground/60 p-4 text-center text-xs">
                {t.calendarNoPillars}
              </p>
            ) : shown.length === 0 ? (
              <p className="text-muted-foreground/60 p-4 text-center text-xs">
                {t.calendarSpotlightEmpty}
              </p>
            ) : (
              <div className="p-2">
                {shown.map((row) => {
                  // Asked already — inside the seeder's own 14-day window, or
                  // by someone pressing this row a second ago. Either way the
                  // row reports rather than offers: filing it twice is what
                  // the dedup window exists to prevent.
                  const asked = row.state !== null;
                  const busy = queueing === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      disabled={asked || queueing !== null}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onQueue(row)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg p-2 text-start",
                        "transition-colors duration-150",
                        asked
                          ? "cursor-default opacity-60"
                          : "cursor-pointer hover:bg-muted",
                        queueing !== null && !busy && "cursor-default",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          dir="auto"
                          className="block truncate text-xs font-medium"
                        >
                          {pillarSubject(row.brief)}
                        </span>
                        <span
                          className="text-muted-foreground/60 block truncate text-[11px]"
                          dir="auto"
                        >
                          {[
                            row.isPick ? t.calendarThisWeek : null,
                            row.pillar,
                            row.state ? stateLabel(row.state) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          asked
                            ? "bg-foreground text-background"
                            : "text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {asked ? (
                          <Check className="size-4" />
                        ) : (
                          <Plus
                            className={cn("size-4", busy && "animate-pulse")}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
