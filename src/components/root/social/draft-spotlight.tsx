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

import * as React from "react";
import { ArrowUp, Loader2, Plus, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { fill } from "@/components/root/social/dictionary";
import {
  CardStrip,
  DraftCard,
  GLASS,
  MediaPanel,
} from "@/components/root/social/spotlight";
import {
  DRAFT_ANGLES,
  DRAFT_MODELS,
  DRAFT_REGISTERS,
} from "@/components/root/social/knobs";
import { useSocial } from "@/components/root/social/provider";
import { getProduct } from "@/components/root/social/products";

/** Which face the panel under the bar is wearing. */
type Face = "knobs" | "media";

export function DraftSpotlight({
  onEngagedChange,
}: {
  onEngagedChange?: (engaged: boolean) => void;
}) {
  const {
    t,
    isRTL,
    product,
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

  const [focused, setFocused] = React.useState(false);
  const [face, setFace] = React.useState<Face>("knobs");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const open = focused;
  React.useEffect(() => onEngagedChange?.(open), [open, onEngagedChange]);

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
          {/* The media half of a full draft. It rides the ask — `submit`
              already sends the shared tray as `mediaUrls` — so what is
              attached here is what the answering session is handed. */}
          <button
            type="button"
            aria-label={t.mediaLabel}
            title={t.mediaLabel}
            aria-expanded={open && face === "media"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setFace((current) =>
                open && current === "media" ? "knobs" : "media",
              );
              setFocused(true);
              inputRef.current?.focus();
            }}
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
              "transition-colors duration-150",
              composerMediaUrls.length > 0 || (open && face === "media")
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
              setFace((current) =>
                open && current === "knobs" ? "media" : "knobs",
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
          <div className="relative max-h-[min(360px,45vh)] overflow-y-auto border-t border-black/5 dark:border-white/10">
            <div className="p-3">
              {face === "media" ? (
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
                <KnobFaces t={t} isRTL={isRTL} knobs={draftKnobs} />
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
