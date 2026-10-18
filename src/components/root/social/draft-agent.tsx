"use client";

// The agent window — the hogwarts sales block's Lead Agent (hogwarts
// src/components/sales/prompt.tsx), rebuilt for social drafting on the same ai
// block: AgentHeading over a full-height hero, the rounded-[2rem] prompt pill
// with its toolbar, and AIResponseDisplay for the answer. Same geometry, same
// collapse-to-a-pill-after-the-first-ask behaviour, same response container.
//
// ASYNCHRONOUS on purpose. The window queues the brief as a SocialDraftRequest
// and polls for the answer; a Claude Code session on a human's machine writes it
// against the Max subscription. It does not call the Anthropic API —
// subscription-only billing means no key has credits to spend (verified in
// production 2026-07-30; see the decision record). So the reasoning panel
// describes the real queue rather than performing invented thinking, and the
// "Thought for 3 seconds" of the original is a genuine measured wait here.

import { useEffect, useState } from "react";
import { AIResponseDisplay } from "@/components/atom/ai-response-display";
import { Button } from "@/components/ui/button";
import { fill } from "@/components/root/social/dictionary";
import { ConceptCard } from "@/components/root/social/concept-card";
import { DraftSpotlight } from "@/components/root/social/draft-spotlight";
import { MediaThumb } from "@/components/root/social/media-thumb";
import { PRODUCT_IDS, PRODUCTS, type ProductId } from "@/components/root/social/products";
import { StageFrame } from "@/components/root/social/stage";
import { useSocial } from "@/components/root/social/provider";
import { cn } from "@/lib/utils";

const RESPONSE_CONTAINER_ID = "ai-response-container";

export function DraftAgent({ initialSlot }: { initialSlot?: string }) {
  // The conversation — brief, queue poll, answer, reveal — is provider state,
  // so it survives leaving this page the way the old hidden panel survived a
  // tab switch. Only presentation state stays here.
  const {
    isRTL,
    t,
    product,
    setProduct,
    setPlanSlot,
    handToComposer,
    draftQueue,
  } = useSocial();

  // Arrived from the Calendar's "Write it": the slot names its brand, and the
  // concept card above the box reads from it.
  useEffect(() => {
    if (!initialSlot) return;
    const brand = initialSlot.split("#")[0];
    if ((PRODUCT_IDS as readonly string[]).includes(brand)) {
      setProduct(brand as ProductId);
      setPlanSlot(initialSlot);
    }
  }, [initialSlot, setProduct, setPlanSlot]);
  const {
    prompt,
    setPrompt,
    busy,
    hasInteracted,
    draft,
    answeredId,
    turn,
    lastInstruction,
    reveal,
    error,
    queueInfo,
    stalled,
    submit,
    advance,
    reset,
    checkAgain,
  } = draftQueue;
  // The answer shrinks while the box has focus, so the thing being typed and
  // the thing being refined are on screen together. It used to key off the
  // prompt pill's own focus; the box reports the same fact through the prop
  // every stage box already has.
  const [isInputFocused, setIsInputFocused] = useState(false);

  const brandLabel =
    PRODUCTS.find((p) => p.id === product)?.[isRTL ? "labelAr" : "label"] ??
    product;

  // The honest pending line: a fresh heartbeat means a session is working the
  // queue; a stale or absent one means nobody is, and saying so beats a
  // spinner that promises minutes.
  const drainStatus = () => {
    const at = queueInfo?.lastDrainAt ? new Date(queueInfo.lastDrainAt) : null;
    const minutes = at
      ? Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000))
      : null;
    if (minutes !== null && minutes < 15) {
      return fill(t.agentDrainFresh, {
        minutes,
        position: (queueInfo?.pendingAhead ?? 0) + 1,
      });
    }
    return t.agentDrainStale;
  };

  const reasoningLabels = {
    thinking: t.agentThinking,
    thought: t.agentThought,
  };
  const responseLabels = {
    streaming: t.agentPipStreaming,
    done: t.agentPipDone,
    failed: t.agentPipFailed,
    rejected: t.agentPipRejected,
  };

  // full-bleed: the page wraps its children in px-responsive, and a gradient
  // that stops at that padding reads as a panel rather than a band. The utility
  // (styles/container.css) breaks out RTL-safely.
  //
  // Sized to its content, not `min-h-screen` like the sales agent it mirrors:
  // that agent opens its page, so a full viewport is the whole point. This one
  // sits under the header and the toolbar, where a screen-tall block would be
  // mostly empty gradient with the prompt marooned in the middle of it.
  return (
    <StageFrame title={t.draftStageTitle}>
      {({ onEngagedChange, triggerCenter }) => (
        <>
          {/* The box. It is the whole input now — the rounded-[2rem] prompt
              pill this file was built around is gone, and with it the second
              writable field on a stage that only ever had one sentence to
              take. Its ⊕ is the same shared tray the pill's attach menu
              filled, its seat is the same `submit`, and its empty seat opens
              the same three knobs the pill carried as selects. */}
          <ConceptCard />

          <DraftSpotlight
            onEngagedChange={(engaged) => {
              onEngagedChange(engaged);
              setIsInputFocused(engaged);
            }}
            triggerCenter={triggerCenter}
          />

      {hasInteracted && (
        <div
          id={RESPONSE_CONTAINER_ID}
          className={cn(
            "relative w-full max-w-3xl flex-1 space-y-4 overflow-x-hidden overflow-y-auto rounded-lg",
            isInputFocused ? "max-h-[200px]" : "max-h-[500px]",
          )}
        >
          {/* Which turn is on screen, and what was asked of it. Shown only
              from v2 — a badge reading "v1" on every first draft would be
              noise, and the thread is exactly what makes v2 worth naming. */}
          {draft && turn > 1 && (
            <div className="flex flex-wrap items-baseline gap-2 text-start">
              <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[11px]">
                {fill(t.agentTurnBadge, { turn })}
              </span>
              {lastInstruction && (
                <span className="text-muted-foreground/70 text-xs">
                  {fill(t.agentRefinedFor, {
                    instruction: lastInstruction,
                  })}
                </span>
              )}
            </div>
          )}

          <AIResponseDisplay
            reasoning={fill(t.agentReasoning, { brand: brandLabel })}
            response={draft?.ar ?? ""}
            // A refinement keeps the previous answer on screen while it
            // waits, and re-animating text the reader has already read
            // would look like the rewrite finished. So stream only when
            // there is genuinely new text: a first ask (no draft yet), or
            // an answer being revealed.
            isStreaming={reveal === "ar" || (busy && !draft)}
            dir="rtl"
            className="mb-4 pe-3"
            streamDelay={10}
            reasoningLabels={reasoningLabels}
            responseLabels={responseLabels}
            scrollContainerId={RESPONSE_CONTAINER_ID}
            onStreamComplete={() => advance("ar", "en")}
          />

          {draft && reveal !== "ar" && (
            <AIResponseDisplay
              response={draft.en}
              isStreaming={reveal === "en"}
              showReasoning={false}
              dir="ltr"
              className="mb-4 pe-3"
              streamDelay={10}
              responseLabels={responseLabels}
              scrollContainerId={RESPONSE_CONTAINER_ID}
              onStreamComplete={() => advance("en", "done")}
            />
          )}

          {error && (
            <p role="alert" className="text-destructive text-start text-sm">
              {t.agentError} {error}
            </p>
          )}

          {busy && (
            <p
              role="status"
              className="text-muted-foreground/70 text-start text-xs"
            >
              {queueInfo ? drainStatus() : t.agentQueuedHint}
            </p>
          )}

          {stalled && (
            <div
              role="status"
              className="border-border text-muted-foreground flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-start text-xs"
            >
              <span>{t.agentStillQueued}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={checkAgain}
                className="h-7 rounded-full text-xs"
              >
                {t.agentCheckAgain}
              </Button>
            </div>
          )}

          {/* The draft's media half — the answering session's picks (or
              the ask's own attachments), shown so what gets approved is
              the FULL draft, not just its copy. */}
          {draft && reveal === "done" && draft.mediaUrls.length > 0 && (
            <div className="space-y-1.5 pt-1 text-start">
              <p className="text-muted-foreground text-xs">
                {t.agentDraftMedia}
              </p>
              <div className="flex flex-wrap gap-2">
                {draft.mediaUrls.map((url) => (
                  <MediaThumb
                    key={url}
                    src={url}
                    className="border-border h-16 w-16 rounded-xl border object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {/* "Use …" carries the whole draft — copy, media AND the request
              id — so approving on the Publish stage consumes the queue
              entry instead of leaving it approvable twice. */}
          {draft && reveal === "done" && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() =>
                  handToComposer(
                    draft.ar,
                    draft.mediaUrls,
                    answeredId ?? undefined,
                  )
                }
              >
                {t.agentUseAr}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handToComposer(
                    draft.en,
                    draft.mediaUrls,
                    answeredId ?? undefined,
                  )
                }
              >
                {t.agentUseEn}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handToComposer(
                    `${draft.ar}\n\n—\n\n${draft.en}`,
                    draft.mediaUrls,
                    answeredId ?? undefined,
                  )
                }
              >
                {t.agentUseBoth}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                {t.agentStartNew}
              </Button>
            </div>
          )}

          {/* The one thing a reader cannot guess from the UI: that typing
              again refines THIS draft rather than starting another. Said
              once the answer is fully revealed, next to the buttons that
              are the alternative. */}
          {draft && reveal === "done" && (
            <p className="text-muted-foreground/70 text-center text-xs leading-relaxed">
              {t.agentRefineHint}
            </p>
          )}
        </div>
      )}

          {/* What a good brief contains. Shown once, before the first ask: the
              answering session gets the brand and this text and nothing else,
              so the brief is the whole input and most contributors will never
              read the skill that says so. */}
          {!hasInteracted && (
            <p className="text-muted-foreground/70 mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed">
              {t.agentHint}
            </p>
          )}
        </>
      )}
    </StageFrame>
  );
}
