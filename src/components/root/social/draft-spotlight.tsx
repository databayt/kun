"use client";

// The Draft stage's box — Publish's bar, asking instead of sending.
//
// Same glass, same 48px line, same two seats: ⊕ on one side for the media the
// ask carries, the arrow on the other. Only the errand differs. Publish's
// field holds a post and its arrow sends it; this one holds a BRIEF and its
// arrow asks for the post.
//
// It goes THROUGH `draftQueue.submit`, which the composer deliberately does
// not. That function treats an ask as a refinement whenever an answer is on
// screen — wrong in a box whose whole job is publishing something else, and
// exactly right here: this is the stage where typing again refines the draft
// you are reading rather than starting an unrelated one. The page has said so
// in a hint line since refinement turns shipped; now the box behaves that way
// because it is the same function that owns the behaviour.
//
// There is only one field on this stage. The prompt pill it replaces is gone
// — two writable boxes on one screen is two places for the same sentence.
//
// The seat opens the same settings row Publish wears — Brand · Feature ·
// Channels · Post · Direction · Media — because every one of those changes
// what gets WRITTEN, and asking on this stage while the brand lived on
// another was the odd part. Timing and Queue stay behind: this stage cannot
// send, so it has nothing to schedule and no queue to approve from. The
// writing knobs are this stage's own word, passed to the shared panel rather
// than taught to it.

import * as React from "react";
import { ArrowUp, Loader2, Plus, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { fill } from "@/components/root/social/dictionary";
import { CardStrip, ConfigPanel, DraftCard, MediaPanel } from "@/components/root/social/spotlight";
import {
  GLASS,
  SPOTLIGHT_BAR,
  SPOTLIGHT_PANEL,
  useSpotlightBox,
} from "@/components/root/social/spotlight-shell";
import {
  DRAFT_ANGLES,
  DRAFT_MODELS,
  DRAFT_REGISTERS,
} from "@/components/root/social/knobs";
import { useSocial } from "@/components/root/social/provider";
import { getProduct } from "@/components/root/social/products";

/** This stage's own word — the shared panel knows nothing about it. */
const KNOBS_WORD = "knobs";

/**
 * Which panel the bar is wearing. The same split Publish uses: the ⊕ opens the
 * attachment tray, the seat opens the settings. They are different questions —
 * "which pictures ride with this" and "what is this post" — and the settings
 * row's own Media word narrows the library rather than attaching from it.
 */
type Panel = "config" | "media";

export function DraftSpotlight({
  onEngagedChange,
}: {
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
    draftQueue,
    draftKnobs,
    composerMediaUrls,
    brandMedia,
    attachMedia,
    removeMedia,
    goToStage,
  } = useSocial();
  // No queue line here. The stage under the box already says what the queue
  // is doing, with the heartbeat's own numbers — two places reporting one
  // wait is how they end up disagreeing.
  const { prompt, setPrompt, busy, submit } = draftQueue;

  const [panel, setPanel] = React.useState<Panel>("config");
  const [openSection, setOpenSection] = React.useState<string | null>(KNOBS_WORD);
  const { setFocused, open, inputRef, shellProps } = useSpotlightBox({
    onEngagedChange,
  });

  const trimmed = prompt.trim();
  const brandName = (() => {
    const found = getProduct(product);
    return found ? (isRTL ? found.labelAr : found.label) : product;
  })();

  const ask = () => {
    if (!trimmed || busy) return;
    void submit({ text: prompt });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        {...shellProps}
        className={cn(GLASS, "overflow-hidden rounded-[28px]")}
      >
        <div className={SPOTLIGHT_BAR}>
          {/* The media half of a full draft. It rides the ask — `submit`
              already sends the shared tray as `mediaUrls` — so what is
              attached here is what the answering session is handed. */}
          <button
            type="button"
            aria-label={t.mediaLabel}
            title={t.mediaLabel}
            aria-expanded={open && panel === "media"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setPanel((current) =>
                open && current === "media" ? "config" : "media",
              );
              setFocused(true);
              inputRef.current?.focus();
            }}
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
              "transition-colors duration-150",
              composerMediaUrls.length > 0 || (open && panel === "media")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
            )}
          >
            {composerMediaUrls.length > 0 ? (
              <span className="text-xs font-medium tabular-nums" dir="ltr">
                {composerMediaUrls.length}
              </span>
            ) : (
              <Plus className="size-5" />
            )}
          </button>

          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            // The frame lifts its own column off the engagement this
            // reports — see stage.tsx.
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              ask();
            }}
            placeholder={fill(t.agentPlaceholder, { brand: brandName })}
            // 16px keeps iOS Safari from zooming the page on focus.
            className={cn(
              "flex h-12 w-full bg-transparent text-base outline-hidden",
              "placeholder:text-muted-foreground/70",
            )}
          />

          {/* One seat, two jobs, decided by whether there is a brief. Empty,
              it opens the direction — angle, register, model. The moment a
              character lands it becomes the ask. Same rule as Publish, where
              the empty seat opens the settings and the full one sends. */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (trimmed) {
                ask();
                return;
              }
              setPanel("config");
              setOpenSection((current) =>
                open && panel === "config" && current === KNOBS_WORD
                  ? null
                  : KNOBS_WORD,
              );
              setFocused(true);
              inputRef.current?.focus();
            }}
            disabled={trimmed ? busy : false}
            title={trimmed ? t.askAction : t.spotlightConfigDraft}
            aria-label={trimmed ? t.askAction : t.spotlightConfigDraft}
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
              "bg-clay text-clay-foreground transition-opacity duration-150",
              "hover:opacity-90",
              busy && "pointer-events-none",
            )}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : trimmed ? (
              <ArrowUp className="size-5" />
            ) : (
              <Settings className="size-5" />
            )}
          </button>
        </div>

        {open && (
          <div className={SPOTLIGHT_PANEL}>
            <div className="p-3">
              {panel === "media" ? (
                <MediaPanel
                  t={t}
                  urls={composerMediaUrls}
                  brandMedia={brandMedia}
                  // The library unfiltered. Publish narrows it by the post
                  // shape it is about to publish; an ask has not decided a
                  // shape yet, and hiding assets from a brief would be
                  // answering a question nobody asked.
                  postType="image"
                  mediaFilter="any"
                  mediaType="any"
                  onAttach={attachMedia}
                  onRemove={removeMedia}
                  onBrowse={() => goToStage("media")}
                />
              ) : (
              <ConfigPanel
                words={["brand", "feature", "channels", "postType", "media"]}
                extra={[
                  {
                    id: KNOBS_WORD,
                    label: t.spotlightConfigDraft,
                    node: <KnobFaces t={t} isRTL={isRTL} knobs={draftKnobs} />,
                  },
                ]}
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
              )}
            </div>
          </div>
        )}
      </div>

</div>
  );
}

/**
 * The direction, as the same cards Publish draws.
 *
 * Rendered here rather than reached for through `ConfigChoices`, which takes
 * twenty-odd props about a post this stage is not making. The cards are the
 * shared part; the wiring is three lines either way.
 */
function KnobFaces({
  t,
  isRTL,
  knobs,
}: {
  t: ReturnType<typeof useSocial>["t"];
  isRTL: boolean;
  knobs: ReturnType<typeof useSocial>["draftKnobs"];
}) {
  const { model, setModel, angle, setAngle, register, setRegister } = knobs;
  const chosenRung = DRAFT_REGISTERS.find((r) => r.id === register);
  const rung = (label: string) => label.split(" — ")[0];
  const modelName = (label: string) => label.split(" (")[0];
  const modelEngine = (label: string) =>
    label.match(/\(([^)]+)\)/)?.[1] ?? null;

  // No drag-scrollers here: four cards fit the panel's width, and the ones on
  // Publish only scroll because they share the row with a wider strip.
  const strip = (node: React.ReactNode, heading: string) => (
    <CardStrip heading={heading} rowRef={() => {}} dragging={false}>
      {node}
    </CardStrip>
  );

  return (
    <div className="space-y-1">
      {strip(
        <>
          <DraftCard
            label={t.spotlightConfigDraftFree}
            body={t.spotlightConfigDraftFreeAngle}
            on={angle === null}
            inert={false}
            onPick={() => setAngle(null)}
          />
          {DRAFT_ANGLES.map((a) => (
            <DraftCard
              key={a.id}
              label={isRTL ? a.labelAr : a.label}
              body={isRTL ? a.hintAr : a.hint}
              on={angle === a.id}
              inert={false}
              onPick={() => setAngle(a.id)}
            />
          ))}
        </>,
        t.spotlightConfigDraftAngle,
      )}

      {strip(
        <>
          <DraftCard
            label={t.spotlightConfigDraftFree}
            body={t.spotlightConfigDraftFreeRegister}
            on={register === null}
            inert={false}
            onPick={() => setRegister(null)}
          />
          {DRAFT_REGISTERS.map((r) => (
            <DraftCard
              key={r.id}
              label={rung(isRTL ? r.labelAr : r.label)}
              body={r.markers}
              on={register === r.id}
              inert={false}
              onPick={() => setRegister(r.id)}
            />
          ))}
        </>,
        t.spotlightConfigDraftRegister,
      )}

      {chosenRung && (
        <p className="text-muted-foreground/70 pb-1 text-[11px]">
          {isRTL ? chosenRung.hintAr : chosenRung.hint}
        </p>
      )}

      {strip(
        <>
          {DRAFT_MODELS.map((m) => {
            const engine = modelEngine(m.label);
            const role = isRTL ? m.roleAr : m.role;
            return (
              <DraftCard
                key={m.id}
                label={modelName(m.label)}
                body={engine ? `${role} · ${engine}` : role}
                on={model === m.id}
                inert={false}
                onPick={() => setModel(m.id)}
              />
            );
          })}
        </>,
        t.spotlightConfigDraftModel,
      )}
    </div>
  );
}
