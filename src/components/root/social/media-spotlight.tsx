"use client";

// The Media stage's box — Publish's bar, finding instead of sending.
//
// Same glass, same 48px line. Publish's field is a post and its panel is the
// queue; this one's field is a query and its panel is the library. Two stages,
// one surface, and the thing that makes this box part of the pipeline rather
// than a search toy is the seat on the right: Attach puts an asset in the
// shared tray, which is what the draft ask and the post both read.
//
// Deliberately NOT the grid again. The gallery below is browsing — shelves by
// brand, cards with their model and credits and source. This is finding: you
// know roughly what you want, you type two words, you attach it, and you are
// back to writing. The grid answers "what do we have"; the box answers "give
// me the one with the desk in it".
//
// The seat opens the same settings row the other stages wear, narrowed to the
// three words that mean something while finding a picture: Brand · Feature ·
// Media. They are not decoration — brand and the media filters narrow the
// results, and the count on the bar says by how much. Post shape, Timing and
// Queue stay behind: nothing here is being written or sent.

import * as React from "react";
import { Check, Plus, Search, Settings } from "lucide-react";

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
import { mediaKind } from "@/lib/media-kind";
import { useSocial } from "@/components/root/social/provider";
import { StageFrame } from "@/components/root/social/stage";

/**
 * One library row, narrowed to what a search result draws.
 *
 * The server holds `ShowroomAsset` with its model, credits, ratio, note and
 * source; none of that reaches a 40px result line, and every field crossing
 * the boundary is serialized into the page for every visitor. Five fields,
 * not fifteen.
 */
export interface MediaPick {
  id: string;
  title: string;
  url: string;
  brand: string | null;
  type: string;
}

export function MediaSpotlight({
  assets,
  onEngagedChange,
}: {
  assets: MediaPick[];
  onEngagedChange?: (engaged: boolean) => void;
}) {
  const {
    t,
    isRTL,
    composerMediaUrls,
    attachMedia,
    removeMedia,
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

  // The Arabic-aware matcher, the same one the queue is filtered by — a
  // library whose titles are half Arabic cannot be searched by a Latin scorer.
  // The settings narrow before the query does, so the count on the bar reads
  // as "of what I am allowed to see" rather than "of everything we own". An
  // asset with no brand recorded belongs to nobody and stays visible — it is
  // shared, not somebody else's.
  const shown = React.useMemo(() => {
    const q = query.trim();
    return assets.filter((a) => {
      if (a.brand && a.brand !== product) return false;
      if (mediaFilter !== "any" && mediaKind(a.url) !== mediaFilter) return false;
      if (mediaType !== "any" && a.type !== mediaType) return false;
      if (!q) return true;
      return matchesQuery([a.title, a.brand ?? "", a.type, a.id].join(" "), q);
    });
  }, [assets, query, product, mediaFilter, mediaType]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        {...shellProps}
        className={cn(GLASS, "overflow-hidden rounded-[28px]")}
      >
        <div className={SPOTLIGHT_BAR}>
          {/* A magnifying glass, where Publish has a ⊕. It earns it here: this
              field really is a query and nothing else, and the seat that
              attaches is on each result rather than on the bar. */}
          <span className="text-muted-foreground/70 flex size-9 shrink-0 items-center justify-center">
            <Search className="size-5" />
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // The frame lifts its own column off the engagement this
            // reports — see stage.tsx.
            onFocus={() => setFocused(true)}
            placeholder={t.mediaSpotlightPlaceholder}
            // 16px keeps iOS Safari from zooming the page on focus.
            className={cn(
              "flex h-12 w-full bg-transparent text-base outline-hidden",
              "placeholder:text-muted-foreground/70",
            )}
          />

          {/* How much of the library the query is looking at. The count is the
              only thing on the bar that changes as you type, which is what
              tells you the search is running at all. */}
          <span
            className="text-muted-foreground/60 shrink-0 pe-2 text-xs tabular-nums"
            dir="ltr"
          >
            {fill(t.mediaSpotlightCount, {
              shown: shown.length,
              total: assets.length,
            })}
          </span>

          {/* The seat. Publish sends from here and Draft asks; this stage has
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
          <div className={SPOTLIGHT_PANEL}>
            <div className="p-3">
              <ConfigPanel
                words={["brand", "feature", "media"]}
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
                {t.mediaSpotlightEmpty}
              </p>
            ) : (
              <div className="p-2">
                {shown.map((asset) => {
                  const attached = composerMediaUrls.includes(asset.url);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        attached
                          ? removeMedia(asset.url)
                          : attachMedia(asset.url)
                      }
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-start",
                        "transition-colors duration-150",
                        attached ? "bg-accent" : "hover:bg-muted",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt=""
                        loading="lazy"
                        className="bg-muted size-10 shrink-0 rounded-md object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          dir="auto"
                          className="block truncate text-xs font-medium"
                        >
                          {asset.title}
                        </span>
                        <span
                          className="text-muted-foreground/60 block truncate text-[11px]"
                          dir="ltr"
                        >
                          {[asset.brand, asset.type]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          attached
                            ? "bg-foreground text-background"
                            : "text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {attached ? (
                          <Check className="size-4" />
                        ) : (
                          <Plus className="size-4" />
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

      {/* What is in the tray, said on the stage rather than only inside the
          panel: the tray survives leaving this page, and someone who attached
          three things and navigated away should see that from the doorway. */}
      {composerMediaUrls.length > 0 && (
        <p className="text-muted-foreground/70 mt-3 text-center text-xs">
          {t.mediaSpotlightAttached}
          <span className="ms-1 tabular-nums" dir="ltr">
            {composerMediaUrls.length}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * The stage, as one client component.
 *
 * `StageFrame` takes its children as a function so it can hand down
 * `onEngagedChange`, and a function does not cross the RSC boundary — the
 * showroom is a Server Component reading two registries and the filesystem.
 * So the server passes the narrowed rows to this, and this does the rest.
 */
export function MediaStage({
  assets,
  below,
}: {
  assets: MediaPick[];
  below?: React.ReactNode;
}) {
  const { t } = useSocial();
  return (
    <StageFrame title={t.mediaStageTitle} below={below}>
      {({ onEngagedChange }) => (
        <MediaSpotlight assets={assets} onEngagedChange={onEngagedChange} />
      )}
    </StageFrame>
  );
}
