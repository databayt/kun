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

import { useCallback, useEffect, useRef, useState } from "react";
import { readSocialDraft, requestSocialDraft } from "@/actions/post-social";
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
  type PromptInputMessage,
} from "@/components/atom/prompt-input";
import { Button } from "@/components/ui/button";
import { fill, type SocialDict } from "@/components/root/social/dictionary";
import { PRODUCTS, type ProductId } from "@/components/root/social/products";
import { cn } from "@/lib/utils";

interface DraftAgentProps {
  product: ProductId;
  /**
   * Hands a chosen draft to the composer. The dashboard owns what that means —
   * the composer is behind another tab, so this is a stage change, not a scroll.
   */
  onUse: (text: string) => void;
  /** The heading's "see what's already published" — opens the Measure stage. */
  onSeePublished: () => void;
  isRTL: boolean;
  t: SocialDict;
}

interface DraftPair {
  ar: string;
  en: string;
}

/**
 * The model chain from .claude/engine.json. Presentational for now: the queue
 * carries a brand and a brief, not a model, so the answering session uses its
 * own session default. Wiring it needs a `model` column on SocialDraftRequest
 * plus a pass-through in requestSocialDraft — deliberately not done here.
 */
const MODELS = [
  { id: "claude-fable-5", label: "Fable 5" },
  { id: "claude-opus-4-8", label: "Opus 4.8" },
  { id: "claude-sonnet-5", label: "Sonnet 5" },
] as const;

/**
 * Mirrors draftCopySchema's cap in actions/post-social.ts. An attachment is
 * folded into the brief rather than uploaded — the queue has a brief column, not
 * a file one — so the fold-in has to fit under the same ceiling the action
 * enforces. Overshooting it would answer "attach a transcript" with the server's
 * "Brief is too long", which explains nothing.
 */
const MAX_BRIEF_CHARS = 2000;

const RESPONSE_CONTAINER_ID = "ai-response-container";

type Reveal = "ar" | "en" | "done" | null;

export function DraftAgent({
  product,
  onUse,
  onSeePublished,
  isRTL,
  t,
}: DraftAgentProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [draft, setDraft] = useState<DraftPair | null>(null);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  // The queue telling its own truth: position + when a session last looked.
  const [queueInfo, setQueueInfo] = useState<{
    pendingAhead?: number;
    lastDrainAt?: string;
  } | null>(null);
  // After the hard stop: the ask is saved server-side but this window stopped
  // polling for it. "Check again" restarts a fresh polling window.
  const [stalled, setStalled] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brandLabel =
    PRODUCTS.find((p) => p.id === product)?.[isRTL ? "labelAr" : "label"] ??
    product;

  // Only ever forward, so a late onStreamComplete from a block that already
  // finished cannot rewind the reveal and replay it.
  const advance = useCallback((from: Reveal, to: Reveal) => {
    setReveal((current) => (current === from ? to : current));
  }, []);

  // Poll the queued ask until a session answers it. Cleared on unmount, on a
  // terminal status, and before any new ask — a stale timer would keep
  // writing into a window the contributor has moved on from.
  //
  // Cadence: 5s while an answer could be seconds away, 15s after the first
  // minute, and a hard stop at 10 minutes — past that the ask is still saved
  // (the drain sweep expires it server-side after an hour), but polling
  // forever made "nobody is draining" indistinguishable from "app broken".
  useEffect(() => {
    if (!requestId || stalled) return;
    let cancelled = false;
    const startedAt = Date.now();

    const schedule = () => {
      const delay = Date.now() - startedAt > 60_000 ? 15_000 : 5_000;
      pollRef.current = setTimeout(tick, delay);
    };

    const tick = async () => {
      const res = await readSocialDraft(requestId).catch(() => null);
      if (cancelled) return;
      if (!res) {
        // A transient read failure is not a verdict — keep polling; the
        // status line below keeps saying what the queue last looked like.
        schedule();
        return;
      }
      if (!res.ok) {
        setError(res.error ?? "Could not read the draft.");
        setBusy(false);
        setRequestId(null);
        return;
      }
      if (res.status === "answered" && res.ar && res.en) {
        setDraft({ ar: res.ar, en: res.en });
        setReveal("ar");
        setBusy(false);
        setRequestId(null);
      } else if (res.status === "failed") {
        setError(res.note ?? "The draft could not be written.");
        setBusy(false);
        setRequestId(null);
      } else {
        setQueueInfo({
          pendingAhead: res.pendingAhead,
          lastDrainAt: res.lastDrainAt,
        });
        if (Date.now() - startedAt > 10 * 60_000) {
          setStalled(true);
          setBusy(false);
          return;
        }
        schedule();
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [requestId, stalled, pollNonce]);

  const handleSubmit = async ({ text, files }: PromptInputMessage) => {
    let brief = (text ?? "").trim();

    // An attachment is context for the brief, so read it in rather than posting
    // a file the queue has no column for. Only what fits under the cap goes in.
    const separator = "\n\n---\n\n";
    const room = MAX_BRIEF_CHARS - brief.length - separator.length;
    if (files?.length && room > 0) {
      const parts = await Promise.all(
        files.map(async (file) => {
          try {
            const body = await fetch(file.url).then((res) => res.text());
            return `${file.filename ?? "attachment"}:\n${body.trim()}`;
          } catch {
            return "";
          }
        }),
      );
      const attached = parts.filter(Boolean).join("\n\n").slice(0, room).trim();
      if (attached) brief = `${brief}${separator}${attached}`;
    }

    if (!brief || busy) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    setBusy(true);
    setHasInteracted(true);
    setError(null);
    setDraft(null);
    setReveal(null);
    setRequestId(null);
    setQueueInfo(null);
    setStalled(false);
    try {
      const res = await requestSocialDraft({ product, brief });
      if (res.ok && res.id) {
        setRequestId(res.id);
        setPrompt("");
      } else {
        setError(res.error ?? "Unknown error.");
        setBusy(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  // No scroll here any more: the composer sits behind the Publish tab, so where
  // the copy goes and how the page gets there is the dashboard's to decide.
  const useDraft = onUse;

  const reset = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    setDraft(null);
    setReveal(null);
    setError(null);
    setHasInteracted(false);
    setPrompt("");
    setRequestId(null);
    setBusy(false);
    setQueueInfo(null);
    setStalled(false);
  };

  const checkAgain = () => {
    setStalled(false);
    setBusy(true);
    setPollNonce((n) => n + 1);
  };

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
                onNavigate={onSeePublished}
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
              <AIResponseDisplay
                reasoning={fill(t.agentReasoning, { brand: brandLabel })}
                response={draft?.ar ?? ""}
                isStreaming={busy || reveal === "ar"}
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

              {draft && reveal === "done" && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button size="sm" onClick={() => useDraft(draft.ar)}>
                    {t.agentUseAr}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => useDraft(draft.en)}
                  >
                    {t.agentUseEn}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => useDraft(`${draft.ar}\n\n—\n\n${draft.en}`)}
                  >
                    {t.agentUseBoth}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    {t.agentStartNew}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="relative w-full max-w-3xl">
            <PromptInput
              onSubmit={handleSubmit}
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
                    collapsed
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
                    onValueChange={setModel}
                  >
                    <PromptInputModelSelectTrigger
                      aria-label={t.agentModelLabel}
                      className="border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent"
                    >
                      <div className="flex items-center gap-1.5">
                        <PromptInputModelSelectValue />
                      </div>
                    </PromptInputModelSelectTrigger>
                    <PromptInputModelSelectContent
                      align={isRTL ? "end" : "start"}
                    >
                      {MODELS.map((m) => (
                        <PromptInputModelSelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-2">
                            <AIBrainIcon className="h-4 w-4" />
                            <span>{m.label}</span>
                          </div>
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>

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
