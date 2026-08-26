"use client";

// The Measure stage's box — the fifth and last, and the only one that does
// nothing.
//
// Publish's seat sends, Draft's asks, Media's attaches, Calendar's files. This
// one has no seat action at all and its rows are not buttons, because the
// ledger is downstream of everything: a variant is the record of a decision
// already taken, and there is nothing here left to decide. Making the rows
// pressable would be an affordance that leads nowhere, which is worse than a
// panel that plainly reads.
//
// Which is not the same as doing nothing. The question people bring to this
// stage is "did the Tuesday Balqalam post actually go out, and did anyone see
// it" — and until now the only way to ask it was to read a twenty-row table
// with your finger. Type two words and the row is there with its status and
// its numbers on it. Finding IS the job here; on the other stages finding was
// a step towards doing.
//
// The seat opens one word — Brand. It is the only setting a ledger has an
// opinion about, and it is the setting the whole Hub is scoped by anyway. The
// status is not a dropdown on purpose: it is in the haystack, so typing
// "scheduled" filters to scheduled, and one filtering surface beats two.

import * as React from "react";
import { ChartNoAxesColumn, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { matchesQuery } from "@/lib/normalize-search";
import { fill } from "@/components/root/social/dictionary";
import { ConfigPanel } from "@/components/root/social/spotlight";
import {
  GLASS,
  SPOTLIGHT_BAR,
  SPOTLIGHT_PANEL,
  useSpotlightBox,
} from "@/components/root/social/spotlight-shell";
import { useSocial } from "@/components/root/social/provider";
import { StageFrame } from "@/components/root/social/stage";

/**
 * One ledger row, narrowed at the RSC boundary.
 *
 * `SocialVariant` carries the piece, the metrics relation, the externalId and
 * every timestamp; none of that reaches a 40px result line, and every field
 * crossing into a client component is serialized into the page for every
 * visitor. `when` arrives already formatted rather than as a Date: formatting
 * it here would render one string on the server and another in the browser
 * wherever the two disagree about the timezone, which is a hydration mismatch
 * for no gain.
 */
export interface LedgerPick {
  id: string;
  brand: string;
  channel: string;
  text: string;
  status: string;
  when: string;
  reach: string;
}

function MeasureSpotlight({
  picks,
  onEngagedChange,
}: {
  picks: LedgerPick[];
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
  const { setFocused, open, inputRef, shellProps } = useSpotlightBox({
    onEngagedChange,
  });

  /**
   * The ledger, narrowed.
   *
   * Brand narrows before the query — the same rule the other boxes follow, so
   * the count reads as "of what I am looking at" rather than "of everything
   * ever sent". The status and the channel are in the haystack beside the
   * copy, which is what makes "scheduled" and "facebook" work as queries
   * without either becoming a dropdown.
   */
  const shown = React.useMemo(() => {
    const q = query.trim();
    return picks.filter((row) => {
      if (row.brand !== product) return false;
      if (!q) return true;
      return matchesQuery(
        [row.text, row.brand, row.channel, row.status].join(" "),
        q,
      );
    });
  }, [picks, query, product]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        {...shellProps}
        className={cn(GLASS, "overflow-hidden rounded-[28px]")}
      >
        <div className={SPOTLIGHT_BAR}>
          {/* A bar chart, where Calendar has a calendar and Media a magnifying
              glass. The glyph is the stage. */}
          <span className="text-muted-foreground/70 flex size-9 shrink-0 items-center justify-center">
            <ChartNoAxesColumn className="size-5" />
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // The frame lifts its own column off the engagement this
            // reports — see stage.tsx.
            onFocus={() => setFocused(true)}
            placeholder={t.measureSpotlightPlaceholder}
            // 16px keeps iOS Safari from zooming the page on focus.
            className={cn(
              "flex h-12 w-full bg-transparent text-base outline-hidden",
              "placeholder:text-muted-foreground/70",
            )}
          />

          <span
            className="text-muted-foreground/60 shrink-0 pe-2 text-xs tabular-nums"
            dir="ltr"
          >
            {fill(t.measureSpotlightCount, {
              shown: shown.length,
              total: picks.length,
            })}
          </span>

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
          <div className={SPOTLIGHT_PANEL}>
            <div className="p-3">
              <ConfigPanel
                words={["brand"]}
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
          <div className={SPOTLIGHT_PANEL}>
            {shown.length === 0 ? (
              <p className="text-muted-foreground/60 p-4 text-center text-xs">
                {picks.length === 0 ? t.ledgerEmpty : t.measureSpotlightEmpty}
              </p>
            ) : (
              <div className="p-2">
                {/* Not buttons. There is nothing to do to a record of a
                    decision already taken, and a row that highlights under the
                    cursor promises otherwise. */}
                {shown.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg p-2 text-start"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        dir="auto"
                        className="block truncate text-xs font-medium"
                      >
                        {row.text || "—"}
                      </span>
                      {/* System state reads LTR whatever the page direction. */}
                      <span
                        className="text-muted-foreground/60 block truncate font-mono text-[11px]"
                        dir="ltr"
                      >
                        {[row.channel, row.status, row.when].join(" · ")}
                      </span>
                    </span>
                    <span
                      className="text-muted-foreground/60 shrink-0 font-mono text-[11px] tabular-nums"
                      dir="ltr"
                      title={t.ledgerReach}
                    >
                      {row.reach}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The stage, as one client component.
 *
 * `StageFrame` takes its children as a function so it can hand down
 * `onEngagedChange`, and a function does not cross the RSC boundary — the
 * ledger is a Server Component reading the database. So the server passes the
 * narrowed rows to this, and the table it already renders comes through as
 * `below`.
 */
export function MeasureStage({
  picks,
  below,
}: {
  picks: LedgerPick[];
  below?: React.ReactNode;
}) {
  const { t } = useSocial();
  return (
    <StageFrame title={t.measureStageTitle} below={below}>
      {({ onEngagedChange }) => (
        <MeasureSpotlight picks={picks} onEngagedChange={onEngagedChange} />
      )}
    </StageFrame>
  );
}
