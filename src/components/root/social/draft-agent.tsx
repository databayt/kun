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

import { useState } from "react";
import AgentHeading from "@/components/atom/agent-heading";
import { AIResponseDisplay } from "@/components/atom/ai-response-display";
import {
  AIBrainIcon,
  AttachIcon,
  PlusIcon,
  SendUpIcon,
  VoiceWaveIcon,
} from "@/components/atom/icons";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
} from "@/components/atom/prompt-input";
import { Button } from "@/components/ui/button";
import { fill } from "@/components/root/social/dictionary";
import {
  DRAFT_ANGLES,
  DRAFT_MODELS,
  DRAFT_REGISTERS,
  type DraftAngleId,
  type DraftModelId,
  type DraftRegisterId,
} from "@/components/root/social/knobs";
import { PRODUCTS } from "@/components/root/social/products";
import { useSocial } from "@/components/root/social/provider";
import { mediaKind } from "@/lib/media-kind";
import { cn } from "@/lib/utils";

const RESPONSE_CONTAINER_ID = "ai-response-container";

/** The select's "unset" option — Radix rejects an empty string as a value. */
const AUTO = "__auto__";

/**
 * One pill shape for every knob in the toolbar. Extracted because four selects
 * repeating the same twelve utilities is where they start to drift apart, and a
 * toolbar whose controls are almost-but-not-quite the same height is the kind
 * of thing nobody reports and everybody sees.
 */
const KNOB_TRIGGER =
  "border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent";

export function DraftAgent() {
  // The conversation — brief, queue poll, answer, reveal — is provider state,
  // so it survives leaving this page the way the old hidden panel survived a
  // tab switch. Only presentation state stays here.
  const {
    isRTL,
    t,
    product,
    handToComposer,
    goToStage,
    draftKnobs,
    draftQueue,
    composerMediaUrls,
  } = useSocial();
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
  const {
    model,
    setModel,
    angle,
    setAngle,
    register,
    setRegister,
    referenceId,
    setReferenceId,
    references,
  } = draftKnobs;

  const [isInputFocused, setIsInputFocused] = useState(false);

  // An answer on screen turns this window into a conversation: the prompt is
  // now "what should change?", and submitting refines instead of starting over.
  // The provider owns that branch — this is the same fact, said in the UI.
  const isRefining = Boolean(draft && answeredId);

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

  // The pill collapses to a single row once the window has been used, and
  // expands again on focus — the sales agent's behaviour exactly.
  const collapsed = hasInteracted && !isInputFocused;
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
    <section className="full-bleed from-background to-muted/20 flex flex-col bg-gradient-to-b py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full flex-1 flex-col items-center justify-center text-center">
          {!hasInteracted && (
            <div className="mb-8">
              <AgentHeading
                title={t.agentTitle}
                lead={t.agentLead}
                scrollText={t.agentScrollText}
                onNavigate={() => goToStage("measure")}
              />
            </div>
          )}

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
                    {draft.mediaUrls.map((url) =>
                      mediaKind(url) === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt=""
                          loading="lazy"
                          className="border-border h-16 w-16 rounded-xl border object-cover"
                        />
                      ) : (
                        <span
                          key={url}
                          className="border-border bg-muted flex h-16 w-16 items-center justify-center rounded-xl border font-mono text-[10px] tracking-wider uppercase"
                        >
                          {t.mediaKindVideo}
                        </span>
                      ),
                    )}
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

          <div className="relative w-full max-w-3xl">
            <PromptInput
              onSubmit={submit}
              className={cn(
                "group border-muted-foreground/10 bg-muted focus-within:border-foreground/20 hover:border-foreground/10 focus-within:hover:border-foreground/20 flex w-full gap-2 rounded-[2rem] border text-base shadow-sm transition-all duration-300 ease-in-out",
                collapsed ? "h-14 items-center p-2" : "flex-col p-3",
              )}
              multiple
              accept="text/plain,text/markdown,text/csv,.txt,.md,.csv"
              maxFiles={5}
              maxFileSize={5 * 1024 * 1024}
            >
              <div
                className={cn(
                  "relative flex items-center",
                  collapsed ? "flex-1 gap-2" : "flex-1",
                )}
              >
                {collapsed && (
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger className="bg-muted hover:bg-accent h-8 w-8 rounded-full p-0">
                      <PlusIcon className="h-5 w-5" />
                    </PromptInputActionMenuTrigger>
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments
                        label={t.agentAttachItem}
                      />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                )}

                <PromptInputAttachments>
                  {(attachment) => <PromptInputAttachment data={attachment} />}
                </PromptInputAttachments>

                <PromptInputTextarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={
                    isRefining
                      ? t.agentRefinePlaceholder
                      : collapsed
                        ? t.agentPlaceholderMore
                        : fill(t.agentPlaceholder, { brand: brandLabel })
                  }
                  disabled={busy}
                  className={cn(
                    "placeholder:text-muted-foreground flex w-full flex-1 resize-none bg-transparent text-[16px] focus:bg-transparent",
                    collapsed
                      ? "max-h-[40px] min-h-0 !px-2 py-0 leading-[40px]"
                      : "max-h-[200px] min-h-20 !px-0 py-2 leading-snug",
                  )}
                />

                {collapsed && (
                  <div className="flex items-center gap-1">
                    <PromptInputButton
                      className="bg-muted hover:bg-accent h-8 w-8 rounded-full"
                      disabled
                      title={t.agentVoiceTitle}
                      aria-label={t.agentVoiceTitle}
                    >
                      <VoiceWaveIcon className="h-5 w-5" />
                    </PromptInputButton>

                    <PromptInputSubmit
                      disabled={busy || !prompt.trim()}
                      status={busy ? "submitted" : "ready"}
                      className="h-8 w-8 rounded-full"
                      aria-label={isRTL ? "أرسل" : "Send"}
                    >
                      <SendUpIcon className="h-5 w-5" />
                    </PromptInputSubmit>
                  </div>
                )}
              </div>

              {!collapsed && (
                <div className="flex flex-wrap items-center gap-1">
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger className="border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-full border p-0 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent">
                      <PlusIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                    </PromptInputActionMenuTrigger>
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments
                        label={t.agentAttachItem}
                      />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>

                  <AttachButton label={t.agentAttach} />

                  <PromptInputModelSelect
                    value={model}
                    onValueChange={(value) => setModel(value as DraftModelId)}
                  >
                    <PromptInputModelSelectTrigger
                      aria-label={t.agentModelLabel}
                      className={KNOB_TRIGGER}
                    >
                      <div className="flex items-center gap-1.5">
                        <PromptInputModelSelectValue />
                      </div>
                    </PromptInputModelSelectTrigger>
                    <PromptInputModelSelectContent
                      align={isRTL ? "end" : "start"}
                    >
                      {DRAFT_MODELS.map((m) => (
                        <PromptInputModelSelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-2">
                            <AIBrainIcon className="h-4 w-4" />
                            <span>{m.label}</span>
                          </div>
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>

                  {/* Angle and register are copy.mdx's own vocabulary, so a
                      contributor sets the same things a reviewer dismisses
                      against. Unset is a real choice on both — it means the
                      writer runs its own three-angle discipline and takes the
                      rung the brand map prescribes. */}
                  <PromptInputModelSelect
                    value={angle ?? AUTO}
                    onValueChange={(value) =>
                      setAngle(value === AUTO ? null : (value as DraftAngleId))
                    }
                  >
                    <PromptInputModelSelectTrigger
                      aria-label={t.agentAngleLabel}
                      className={KNOB_TRIGGER}
                    >
                      <span className="truncate">
                        {angle
                          ? (DRAFT_ANGLES.find((a) => a.id === angle)?.[
                              isRTL ? "labelAr" : "label"
                            ] ?? t.agentAngleLabel)
                          : t.agentAngleLabel}
                      </span>
                    </PromptInputModelSelectTrigger>
                    <PromptInputModelSelectContent
                      align={isRTL ? "end" : "start"}
                    >
                      <PromptInputModelSelectItem value={AUTO}>
                        {t.agentAngleAuto}
                      </PromptInputModelSelectItem>
                      {DRAFT_ANGLES.map((a) => (
                        <PromptInputModelSelectItem key={a.id} value={a.id}>
                          {isRTL ? a.labelAr : a.label}
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>

                  <PromptInputModelSelect
                    value={register === null ? AUTO : String(register)}
                    onValueChange={(value) =>
                      setRegister(
                        value === AUTO
                          ? null
                          : (Number(value) as DraftRegisterId),
                      )
                    }
                  >
                    <PromptInputModelSelectTrigger
                      aria-label={t.agentRegisterLabel}
                      className={KNOB_TRIGGER}
                    >
                      <span className="truncate">
                        {register === null
                          ? t.agentRegisterLabel
                          : `${t.agentRegisterLabel} ${register}`}
                      </span>
                    </PromptInputModelSelectTrigger>
                    <PromptInputModelSelectContent
                      align={isRTL ? "end" : "start"}
                      className="max-w-xs"
                    >
                      <PromptInputModelSelectItem value={AUTO}>
                        {t.agentRegisterAuto}
                      </PromptInputModelSelectItem>
                      {DRAFT_REGISTERS.map((r) => (
                        <PromptInputModelSelectItem
                          key={r.id}
                          value={String(r.id)}
                        >
                          <span className="flex flex-col items-start gap-0.5 text-start">
                            <span>{isRTL ? r.labelAr : r.label}</span>
                            <span className="text-muted-foreground text-xs">
                              {isRTL ? r.hintAr : r.hint}
                            </span>
                          </span>
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>

                  {/* "Write it like this one." Only offered once the brand HAS
                      prior copy — an empty picker teaches nothing, and the
                      first post of a brand has nothing to echo. A refinement
                      inherits the parent's reference, so it is hidden there
                      rather than shown as a control that changes nothing. */}
                  {!isRefining && references.length > 0 && (
                    <PromptInputModelSelect
                      value={referenceId ?? AUTO}
                      onValueChange={(value) =>
                        setReferenceId(value === AUTO ? null : value)
                      }
                    >
                      <PromptInputModelSelectTrigger
                        aria-label={t.agentReferenceLabel}
                        className={KNOB_TRIGGER}
                      >
                        <span className="max-w-[10rem] truncate">
                          {referenceId
                            ? (references.find((r) => r.id === referenceId)
                                ?.excerpt ?? t.agentReferenceLabel)
                            : t.agentReferenceLabel}
                        </span>
                      </PromptInputModelSelectTrigger>
                      <PromptInputModelSelectContent
                        align={isRTL ? "end" : "start"}
                        className="max-w-sm"
                      >
                        <PromptInputModelSelectItem value={AUTO}>
                          {t.agentReferenceNone}
                        </PromptInputModelSelectItem>
                        {references.map((r) => (
                          <PromptInputModelSelectItem key={r.id} value={r.id}>
                            <span className="flex items-center gap-2">
                              <span className="max-w-[16rem] truncate">
                                {r.excerpt}
                              </span>
                              {r.shipped && (
                                <span className="text-muted-foreground shrink-0 text-xs">
                                  {t.agentReferenceShipped}
                                </span>
                              )}
                            </span>
                          </PromptInputModelSelectItem>
                        ))}
                      </PromptInputModelSelectContent>
                    </PromptInputModelSelect>
                  )}

                  <div className="ms-auto flex items-center gap-1 md:gap-2">
                    <PromptInputButton
                      className="border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 w-8 items-center justify-center rounded-full border p-0 hover:border-transparent"
                      disabled
                      title={t.agentVoiceTitle}
                      aria-label={t.agentVoiceTitle}
                    >
                      <VoiceWaveIcon className="h-5 w-5 shrink-0" />
                    </PromptInputButton>

                    <PromptInputSubmit
                      disabled={busy || !prompt.trim()}
                      status={busy ? "submitted" : "ready"}
                      className="h-8 w-8 rounded-full"
                      aria-label={isRTL ? "أرسل" : "Send"}
                    >
                      <SendUpIcon className="h-5 w-5 shrink-0" />
                    </PromptInputSubmit>
                  </div>
                </div>
              )}
            </PromptInput>

            {/* Tray media rides the next ask — said here because the tray was
                filled elsewhere (the showroom's Attach) and an invisible
                side-effect on submit would read as a bug. */}
            {composerMediaUrls.length > 0 && !busy && (
              <p className="text-muted-foreground/70 mx-auto mt-3 max-w-xl text-center text-xs leading-relaxed">
                {fill(t.agentTrayHint, { count: composerMediaUrls.length })}
              </p>
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
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The toolbar's second attach affordance. The sales agent points its copy at a
 * hand-rolled hidden `<input id="file-upload">` that nothing reads, so files
 * picked through it vanish; this one opens the real dialog behind PromptInput.
 */
function AttachButton({ label }: { label: string }) {
  const attachments = usePromptInputAttachments();

  return (
    <PromptInputButton
      size="default"
      className="border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent"
      onClick={attachments.openFileDialog}
    >
      <AttachIcon className="h-4 w-4 shrink-0" />
      <span className="hidden md:flex">{label}</span>
    </PromptInputButton>
  );
}
