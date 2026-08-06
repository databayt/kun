"use client";

// The review editor — where a loaded draft gets fine-tuned and decided.
//
// This surface never starts from blank: the copy and media arrive from the
// review queue (an answered SocialDraftRequest) or the agent window's
// hand-off, both carrying the request id so a decision here consumes the
// queue entry. Editing is fine-tuning an existing full draft; creation
// belongs to the Draft stage.

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Paperclip,
  Plus,
  Send,
  Share2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  approveDraft,
  dismissDraft,
  stageForReview,
  type ReviewLink,
} from "@/actions/post-social";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import { fill } from "@/components/root/social/dictionary";
import { useSocial } from "@/components/root/social/provider";
import { checkCraft } from "@/lib/craft";
import { mediaKind, splitMedia } from "@/lib/media-kind";
import type { ChannelOutcome } from "@/lib/social-publish";

// Mirrors the Zod cap in actions/post-social.ts.
const MAX_TEXT = 4000;

/** Any Arabic-block codepoint — decides whether the craft gate applies at all. */
const ARABIC_SCRIPT = /[؀-ۿ]/;

/**
 * What "Both" puts between the two variants in the composer.
 *
 * One constant because it is written by the Both button and READ BACK by the
 * craft check to recover the pair. Two literals would drift, and the failure
 * would be silent: the checker would treat AR+EN as one Arabic text and report a
 * length nobody can act on.
 */
const BOTH_SEPARATOR = "\n\n—\n\n";

export function ReviewEditor({
  approveMode,
  onDecided,
}: {
  /** The panel's setting: what Approve does. */
  approveMode: "now" | "schedule";
  /** Called after any decision (approve, dismiss, stage) — refresh the queue. */
  onDecided: () => void;
}) {
  const {
    product,
    selectedChannels,
    wiredForProduct,
    transportsReady,
    isRTL,
    t,
    composerText,
    setComposerText,
    composerMediaUrls,
    attachMedia,
    removeMedia,
    goToStage,
    reviewQueue,
  } = useSocial();

  const activeDraft =
    reviewQueue.drafts.find((d) => d.id === reviewQueue.activeDraftId) ?? null;

  const [scheduledFor, setScheduledFor] = useState("");
  const [pending, setPending] = useState<
    "approve" | "review" | "dismiss" | null
  >(null);
  // Once a decision landed the queue entry is consumed — the action row swaps
  // to "Next draft" and a second decision is impossible from here.
  const [decided, setDecided] = useState(false);
  const [outcomes, setOutcomes] = useState<ChannelOutcome[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The review artifact when no relay carried it — the Hub is the destination.
  const [reviewLinks, setReviewLinks] = useState<ReviewLink[] | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [dismissOpen, setDismissOpen] = useState(false);

  const trimmed = composerText.trim();
  // Check 1, made visible. A reviewer reads the whole post at once and mentally
  // supplies context a scroller never has, so the first line is shown alone.
  const hookLine = trimmed.split("\n")[0] ?? "";

  // The reject list, live (src/lib/craft.ts) — the same gate
  // `social-drafts.mjs answer` runs, re-run here so a reviewer cannot
  // reintroduce a violation while fine-tuning. The writer already cleared it;
  // this is about the edit.
  //
  // The composer holds ONE variant. "Both" joins them with a separator this
  // component itself writes, so split on that; a lone Arabic text is the AR
  // side. An English-only load is skipped entirely — running the Arabic length
  // band and register wordlist over English would fail every draft for reasons
  // a reviewer cannot act on, and a linter that cries wolf stops being read.
  const craftFindings = useMemo(() => {
    if (!trimmed) return [];
    const [first, second] = trimmed.split(BOTH_SEPARATOR);
    if (!ARABIC_SCRIPT.test(first ?? "")) return [];
    return checkCraft({
      ar: first,
      en: second,
      brand: product,
      // Only when unambiguous: the hashtag cap is per-channel, and picking one
      // of several selected channels would apply a rule the reviewer did not ask
      // for. With none passed, the default cap of 3 applies.
      channel: selectedChannels.length === 1 ? selectedChannels[0] : undefined,
      allowedFrom: activeDraft
        ? [activeDraft.brief, activeDraft.instruction]
            .filter(Boolean)
            .join("\n")
        : undefined,
    });
  }, [trimmed, product, selectedChannels, activeDraft]);
  const { images, videos } = splitMedia(composerMediaUrls);
  const mixedMedia = images.length > 0 && videos.length > 0;

  // The craft checks a reviewer rejects against (content/docs/social/copy.mdx).
  const craftChecks = [
    t.craftCheck1,
    t.craftCheck2,
    t.craftCheck4,
    t.craftCheck6,
  ];

  // Naming the failed check is the only signal that ever reaches the writing
  // side, so it travels twice: `label` is the sentence a human reads back in
  // the note, `id` is the stable key the drain aggregates over (a reworded or
  // re-translated label must not orphan a month of history).
  const dismissReasons = [
    { id: "hook" as const, label: t.dismissReasonHook },
    { id: "two-posts" as const, label: t.dismissReasonTwoPosts },
    { id: "untrue" as const, label: t.dismissReasonUntrue },
    { id: "register" as const, label: t.dismissReasonRegister },
    { id: "cta" as const, label: t.dismissReasonCta },
    { id: "length" as const, label: t.dismissReasonLength },
    { id: "other" as const, label: t.dismissReasonOther },
  ];

  // Stating the blocker beats a dead button with no explanation.
  const blockedReason = !trimmed
    ? t.blockedNoText
    : selectedChannels.length === 0
      ? t.blockedNoChannel
      : !transportsReady
        ? t.blockedTransport
        : null;

  const reset = () => {
    setOutcomes(null);
    setNotice(null);
    setError(null);
    setReviewLinks(null);
    setCopiedChannel(null);
  };

  const payload = () => ({
    product,
    text: composerText,
    channels: selectedChannels,
    mediaUrls: composerMediaUrls,
    scheduledFor: scheduledFor || undefined,
  });

  const finishDecision = () => {
    setDecided(true);
    onDecided();
  };

  const handleApprove = async () => {
    if (!reviewQueue.activeDraftId) return;
    setPending("approve");
    reset();
    try {
      const res = await approveDraft({
        draftId: reviewQueue.activeDraftId,
        mode: approveMode,
        ...payload(),
      });
      if (res.ok) {
        setOutcomes(res.results ?? null);
        setNotice(
          approveMode === "schedule"
            ? fill(t.scheduledMsg, {
                count: res.count ?? 0,
                at: res.at ? new Date(res.at).toLocaleString() : "",
              })
            : t.approvedNowMsg,
        );
        finishDecision();
      } else {
        setOutcomes(res.results ?? null);
        const partial = Boolean(res.results?.some((r) => r.ok));
        setError(partial ? t.partialMsg : `${t.errorMsg}${res.error}`);
        // A partial landing consumed the draft server-side; reflect that.
        if (partial) finishDecision();
      }
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setPending(null);
    }
  };

  const handleDismiss = async (reason: { id: string; label: string }) => {
    if (!reviewQueue.activeDraftId) return;
    setDismissOpen(false);
    setPending("dismiss");
    reset();
    try {
      const res = await dismissDraft({
        draftId: reviewQueue.activeDraftId,
        note: reason.label,
        reason: reason.id,
      });
      if (res.ok) {
        setNotice(t.dismissedMsg);
        finishDecision();
      } else {
        setError(`${t.errorMsg}${res.error}`);
      }
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setPending(null);
    }
  };

  const handleStage = async () => {
    if (!reviewQueue.activeDraftId) return;
    setPending("review");
    reset();
    try {
      const res = await stageForReview(payload());
      if (res.ok) {
        // Undelivered is the production norm (Hermes parked, Telegram
        // deferred): the stage stands and the links render below for a human
        // to carry to the approver.
        setNotice(
          res.delivered
            ? `${t.stagedMsg}${res.via ? ` (${res.via})` : ""}`
            : t.stagedLocalMsg,
        );
        setReviewLinks(res.links ?? null);
        // The decision moved to the signed links — retire the queue entry so
        // the same draft cannot also be approved in-app (a double post).
        await dismissDraft({
          draftId: reviewQueue.activeDraftId,
          note: "staged for link review",
        }).catch(() => {});
        finishDecision();
      } else {
        setError(`${t.errorMsg}${res.error}`);
      }
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setPending(null);
    }
  };

  const copyLink = async (link: ReviewLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedChannel(link.channel);
      setTimeout(() => setCopiedChannel(null), 2000);
    } catch {
      // Clipboard can be denied — the URL text stays select-all as fallback.
    }
  };

  const addUrl = () => {
    const value = urlDraft.trim();
    if (!/^https?:\/\//i.test(value)) return;
    attachMedia(value);
    setUrlDraft("");
  };

  const channelLabel = (id: ChannelId) => {
    const channel = CHANNELS.find((c) => c.id === id);
    if (!channel) return id;
    return isRTL ? channel.labelAr : channel.label;
  };

  // The pill controls in the editor's toolbar, matching the agent window's.
  const pill =
    "border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="w-full">
      {wiredForProduct.length === 0 && (
        <p className="text-muted-foreground border-border mx-auto mb-4 max-w-3xl rounded-lg border border-dashed p-3 text-xs">
          {t.noChannels}
        </p>
      )}

      {/* The brief the copy answers — context for fine-tuning, never edited. */}
      {activeDraft && (
        <p className="text-muted-foreground mx-auto mb-3 max-w-3xl text-start text-xs leading-relaxed">
          {activeDraft.brief}
        </p>
      )}

      {/* Check 1, made physically visible: the first line alone, in the shape a
          scroller actually meets it. Reading the whole post at once hides a bad
          hook, because the reader supplies context the feed never will. */}
      <div className="border-border mx-auto mb-3 max-w-3xl rounded-lg border border-dashed p-3 text-start">
        <p className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wide uppercase">
          {t.hookStripLabel}
        </p>
        <p
          className={cn(
            "text-base leading-snug",
            hookLine ? "text-foreground" : "text-muted-foreground italic",
          )}
        >
          {hookLine || t.hookStripEmpty}
        </p>
      </div>

      {/* The editor surface — the agent window's pill, sized for reviewing.
          Media renders inline (a full draft is copy AND media, so both must
          be visible); adding and scheduling collapse into toolbar pills. */}
      <div id="composer" className="relative mx-auto w-full max-w-3xl">
        <div className="group border-muted-foreground/10 bg-muted focus-within:border-foreground/20 hover:border-foreground/10 focus-within:hover:border-foreground/20 flex w-full flex-col gap-2 rounded-[2rem] border p-3 text-base shadow-sm transition-all duration-300 ease-in-out">
          {/* AR / EN / Both — refill the textarea from the loaded draft. */}
          {activeDraft && activeDraft.ar && activeDraft.en && (
            <div className="flex flex-wrap items-center gap-1 px-2 pt-1">
              <button
                type="button"
                className={pill}
                onClick={() => setComposerText(activeDraft.ar)}
              >
                {t.agentUseAr}
              </button>
              <button
                type="button"
                className={pill}
                onClick={() => setComposerText(activeDraft.en)}
              >
                {t.agentUseEn}
              </button>
              <button
                type="button"
                className={pill}
                onClick={() =>
                  setComposerText(
                    `${activeDraft.ar}${BOTH_SEPARATOR}${activeDraft.en}`,
                  )
                }
              >
                {t.agentUseBoth}
              </button>
            </div>
          )}

          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={t.textareaPlaceholder}
            maxLength={MAX_TEXT}
            className="placeholder:text-muted-foreground min-h-[220px] w-full flex-1 resize-none bg-transparent px-2 py-2 text-start text-[16px] leading-relaxed focus:bg-transparent focus:outline-none"
          />

          {/* Craft findings on the edit. Each message carries its own fix
              ("الحلول" → the actual thing), so the message is the point and a
              bare rule name would not be worth the row. Failures first, and
              bounded — a wall of warnings reads as noise. */}
          {craftFindings.length > 0 && (
            <ul className="space-y-0.5 px-2 pb-1">
              {[...craftFindings]
                .sort((a, b) =>
                  a.severity === b.severity
                    ? 0
                    : a.severity === "fail"
                      ? -1
                      : 1,
                )
                .slice(0, 4)
                .map((f, i) => (
                  <li
                    key={`${f.rule}-${i}`}
                    className={cn(
                      "text-[11px] leading-snug",
                      f.severity === "fail"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    <span className="font-mono" dir="ltr">
                      {f.check === null
                        ? f.rule
                        : `${f.rule} · ${t.craftCheckShort}${f.check}`}
                    </span>
                    {" — "}
                    {f.message}
                  </li>
                ))}
              {craftFindings.length > 4 && (
                <li className="text-muted-foreground text-[11px]">
                  {fill(t.craftMore, { count: craftFindings.length - 4 })}
                </li>
              )}
            </ul>
          )}

          {/* The attachment tray, inline — thumbnails for images, a typed
              plate for video. Remove is per-item; adding happens from the
              Media pill or the showroom's Attach. */}
          {composerMediaUrls.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
              {composerMediaUrls.map((url) => (
                <div key={url} className="group/chip relative">
                  {mediaKind(url) === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="border-border h-16 w-16 rounded-xl border object-cover"
                    />
                  ) : (
                    <span className="border-border bg-muted-foreground/10 flex h-16 w-16 items-center justify-center rounded-xl border font-mono text-[10px] tracking-wider uppercase">
                      {t.mediaKindVideo}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(url)}
                    aria-label={t.attachRemove}
                    className="bg-background border-border absolute -top-1.5 -end-1.5 rounded-full border p-0.5 opacity-0 transition-opacity group-hover/chip:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1">
            <Popover>
              <PopoverTrigger
                className={cn(
                  pill,
                  composerMediaUrls.length > 0 && "text-foreground",
                )}
                aria-label={t.mediaLabel}
              >
                <Paperclip className="size-4 shrink-0" />
                <span className="hidden md:flex">{t.mediaLabel}</span>
                {composerMediaUrls.length > 0 && (
                  <span className="font-mono text-xs" dir="ltr">
                    {composerMediaUrls.length}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent
                align={isRTL ? "end" : "start"}
                className="w-80 text-start"
              >
                <label
                  htmlFor="social-media-url"
                  className="text-muted-foreground mb-1 block text-xs font-medium"
                >
                  {t.attachAddUrl}
                </label>
                <div className="flex gap-1.5">
                  <Input
                    id="social-media-url"
                    type="url"
                    dir="ltr"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addUrl();
                      }
                    }}
                    placeholder={t.mediaPlaceholder}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addUrl}
                    disabled={!/^https?:\/\//i.test(urlDraft.trim())}
                    className="h-9 shrink-0 rounded-full"
                    aria-label={t.attachAddAction}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  {t.mediaHint}
                </p>
                <button
                  type="button"
                  onClick={() => goToStage("media")}
                  className="text-foreground mt-2 text-xs font-medium underline underline-offset-4"
                >
                  {t.attachBrowse}
                </button>
              </PopoverContent>
            </Popover>

            {approveMode === "schedule" && (
              <Popover>
                <PopoverTrigger
                  className={cn(pill, scheduledFor && "text-foreground")}
                  aria-label={t.scheduleLabel}
                >
                  <CalendarClock className="size-4 shrink-0" />
                  <span className="hidden md:flex">
                    {scheduledFor
                      ? new Date(scheduledFor).toLocaleString()
                      : t.scheduleLabel}
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  align={isRTL ? "end" : "start"}
                  className="w-80 text-start"
                >
                  <label
                    htmlFor="social-scheduled-for"
                    className="text-muted-foreground mb-1 block text-xs font-medium"
                  >
                    {t.scheduleLabel}
                  </label>
                  <Input
                    id="social-scheduled-for"
                    type="datetime-local"
                    dir="ltr"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-muted-foreground mt-2 text-xs">
                    {t.scheduleHint}
                  </p>
                </PopoverContent>
              </Popover>
            )}

            <span
              className="text-muted-foreground shrink-0 px-2 font-mono text-xs"
              dir="ltr"
            >
              {fill(t.charCount, { count: trimmed.length, max: MAX_TEXT })}
            </span>

            <div className="ms-auto flex items-center gap-1 md:gap-2">
              {decided ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDecided(false);
                    reset();
                    setScheduledFor("");
                    reviewQueue.clearActive();
                  }}
                  className="h-8 rounded-full"
                >
                  {t.reviewNextDraft}
                </Button>
              ) : (
                <>
                  {/* Dismiss asks why. The reason rides the note the action
                      already persists — a monthly read of these is the only
                      feedback the writing side ever gets. */}
                  <Popover open={dismissOpen} onOpenChange={setDismissOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending !== null}
                        className="h-8 rounded-full"
                      >
                        {pending === "dismiss" ? t.dismissing : t.dismissAction}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align={isRTL ? "start" : "end"}
                      className="w-64 text-start"
                    >
                      <p className="text-muted-foreground mb-2 text-xs font-medium">
                        {t.dismissReasonTitle}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {dismissReasons.map((reason) => (
                          <button
                            key={reason.id}
                            type="button"
                            onClick={() => handleDismiss(reason)}
                            className="hover:bg-accent rounded-md px-2 py-1.5 text-start text-sm transition-colors"
                          >
                            {reason.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStage}
                    disabled={
                      pending !== null ||
                      !trimmed ||
                      selectedChannels.length === 0 ||
                      mixedMedia
                    }
                    className="h-8 gap-1.5 rounded-full"
                  >
                    <Share2 className="size-4" />
                    <span className="hidden md:flex">
                      {pending === "review" ? t.staging : t.stageForReview}
                    </span>
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={
                      pending !== null ||
                      blockedReason !== null ||
                      mixedMedia ||
                      (approveMode === "schedule" && !scheduledFor)
                    }
                    className="h-8 gap-1.5 rounded-full"
                    size="sm"
                  >
                    <Send className="size-4" />
                    <span>
                      {pending === "approve"
                        ? t.approving
                        : approveMode === "schedule"
                          ? t.approveScheduleAction
                          : t.approveAction}
                    </span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* The craft gate, at the moment of decision. Sentences, not checkboxes —
          checkboxes train a reviewer to click through. A fail here is a Dismiss
          with the reason named, not a quiet rewrite in the textarea above. */}
      {!decided && (
        <ul className="text-muted-foreground mx-auto mt-4 max-w-3xl list-disc space-y-1 ps-5 text-start text-xs leading-relaxed">
          {craftChecks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      )}

      {/* Everything the editor has to say back, under it. */}
      <div className="mx-auto mt-4 w-full max-w-3xl space-y-3 text-start">
        {mixedMedia && (
          <p className="text-xs text-amber-500">{t.mixedMediaWarning}</p>
        )}

        {blockedReason && !decided && (
          <p className="text-muted-foreground text-xs">{blockedReason}</p>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-500"
          >
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* The approval links, when the Hub is the review destination.
            Each is the whole artifact — whoever holds it can publish that
            one channel, once, within 12h. */}
        {reviewLinks && reviewLinks.length > 0 && (
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs">
              {t.reviewLinksTitle}
            </p>
            <ul className="space-y-2">
              {reviewLinks.map((link) => (
                <li key={link.channel} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs">
                    {channelLabel(link.channel as ChannelId)}
                  </span>
                  <span
                    dir="ltr"
                    className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs select-all"
                  >
                    {link.url}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyLink(link)}
                    className="h-7 gap-1 rounded-full px-2 text-xs"
                  >
                    {copiedChannel === link.channel ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span className="hidden md:flex">
                      {copiedChannel === link.channel
                        ? t.copiedLink
                        : t.copyLink}
                    </span>
                  </Button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                    <span className="hidden md:flex">{t.openLink}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Per-channel truth: a fan-out that half-landed used to read as one
            flat failure, which hid that the post is already public somewhere. */}
        {outcomes && outcomes.length > 0 && (
          <ul className="border-border divide-border/60 divide-y rounded-lg border text-sm">
            {outcomes.map((outcome) => (
              <li
                key={outcome.channel}
                className="flex items-start justify-between gap-3 p-3"
              >
                <span className="flex items-center gap-2">
                  {outcome.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  )}
                  <span>{channelLabel(outcome.channel)}</span>
                </span>
                {!outcome.ok && outcome.error && (
                  <span className="text-muted-foreground text-end text-xs break-words">
                    {outcome.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
