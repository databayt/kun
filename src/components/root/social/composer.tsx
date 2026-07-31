"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Paperclip,
  Send,
  Share2,
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
  publishPostDirect,
  schedulePost,
  stageForReview,
  type ReviewLink,
} from "@/actions/post-social";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import { fill } from "@/components/root/social/dictionary";
import { useSocial } from "@/components/root/social/provider";
import type { ChannelOutcome } from "@/lib/social-publish";

// Mirrors the Zod cap in actions/post-social.ts. The review lane once capped
// lower because the approval token carried the copy inside the URL; the token
// now names a variant id (see lib/social-token.ts), so both lanes take the
// same cap and the guard below is a relic kept only as defence in depth.
const MAX_TEXT = 4000;
const MAX_REVIEW_TEXT = 4000;

export function Composer() {
  // The copy and its media URL live in the provider: the composer unmounts on
  // a stage navigation now, and losing typed copy to a tab switch is the bug
  // the old hidden-panel design existed to prevent.
  const {
    product,
    selectedChannels,
    wiredForProduct,
    transportsReady,
    isRTL,
    t,
    composerText,
    setComposerText,
    composerMediaUrl,
    setComposerMediaUrl,
  } = useSocial();

  const [scheduledFor, setScheduledFor] = useState("");
  const [pending, setPending] = useState<
    "publish" | "review" | "schedule" | null
  >(null);
  const [outcomes, setOutcomes] = useState<ChannelOutcome[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The review artifact when no relay carried it — the Hub is the destination.
  const [reviewLinks, setReviewLinks] = useState<ReviewLink[] | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  const trimmed = composerText.trim();
  const overReviewLimit = trimmed.length > MAX_REVIEW_TEXT;

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
    mediaUrl: composerMediaUrl.trim() || undefined,
    scheduledFor: scheduledFor || undefined,
  });

  const handlePublish = async () => {
    setPending("publish");
    reset();
    try {
      const res = await publishPostDirect(payload());
      setOutcomes(res.results ?? null);
      if (res.ok) {
        setNotice(t.successMsg);
        setComposerText("");
        setComposerMediaUrl("");
        setScheduledFor("");
      } else {
        // A per-channel breakdown renders below; the banner only needs to say
        // whether anything landed at all.
        setError(
          res.results?.some((r) => r.ok)
            ? t.partialMsg
            : `${t.errorMsg}${res.error}`,
        );
      }
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setPending(null);
    }
  };

  const handleSchedule = async () => {
    setPending("schedule");
    reset();
    try {
      const res = await schedulePost(payload());
      if (res.ok) {
        setNotice(
          fill(t.scheduledMsg, {
            count: res.count ?? 0,
            at: res.at ? new Date(res.at).toLocaleString() : "",
          }),
        );
        setComposerText("");
        setComposerMediaUrl("");
        setScheduledFor("");
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
        setComposerText("");
        setComposerMediaUrl("");
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

  const channelLabel = (id: ChannelId) => {
    const channel = CHANNELS.find((c) => c.id === id);
    if (!channel) return id;
    return isRTL ? channel.labelAr : channel.label;
  };

  // The pill controls in the editor's toolbar, matching the agent window's.
  const pill =
    "border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent disabled:pointer-events-none disabled:opacity-50";

  return (
    <section className="full-bleed from-background to-muted/20 flex flex-col bg-gradient-to-b py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4">
        <div className="w-full text-center">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t.composerTitle}
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg font-light">
              {t.composerDesc}
            </p>
          </div>

          {wiredForProduct.length === 0 && (
            <p className="text-muted-foreground border-border mx-auto mb-4 max-w-3xl rounded-lg border border-dashed p-3 text-xs">
              {t.noChannels}
            </p>
          )}

          {/* The editor surface — the agent window's pill, sized for writing
              rather than for a one-line brief. Media and schedule collapse into
              toolbar pills so the copy is the only thing with weight. */}
          <div id="composer" className="relative mx-auto w-full max-w-3xl">
            <div className="group border-muted-foreground/10 bg-muted focus-within:border-foreground/20 hover:border-foreground/10 focus-within:hover:border-foreground/20 flex w-full flex-col gap-2 rounded-[2rem] border p-3 text-base shadow-sm transition-all duration-300 ease-in-out">
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder={t.textareaPlaceholder}
                maxLength={MAX_TEXT}
                className="placeholder:text-muted-foreground min-h-[220px] w-full flex-1 resize-none bg-transparent px-2 py-2 text-start text-[16px] leading-relaxed focus:bg-transparent focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-1">
                <Popover>
                  <PopoverTrigger
                    className={cn(
                      pill,
                      composerMediaUrl.trim() && "text-foreground",
                    )}
                    aria-label={t.mediaLabel}
                  >
                    <Paperclip className="size-4 shrink-0" />
                    <span className="hidden md:flex">{t.mediaLabel}</span>
                    {composerMediaUrl.trim() && (
                      <span className="bg-primary size-1.5 rounded-full" />
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
                      {t.mediaLabel}
                    </label>
                    <Input
                      id="social-media-url"
                      type="url"
                      dir="ltr"
                      value={composerMediaUrl}
                      onChange={(e) => setComposerMediaUrl(e.target.value)}
                      placeholder={t.mediaPlaceholder}
                      className="font-mono text-sm"
                    />
                    <p className="text-muted-foreground mt-2 text-xs">
                      {t.mediaHint}
                    </p>
                  </PopoverContent>
                </Popover>

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

                <span
                  className={cn(
                    "shrink-0 px-2 font-mono text-xs",
                    overReviewLimit
                      ? "text-amber-500"
                      : "text-muted-foreground",
                  )}
                  dir="ltr"
                >
                  {fill(t.charCount, { count: trimmed.length, max: MAX_TEXT })}
                </span>

                <div className="ms-auto flex items-center gap-1 md:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSchedule}
                    disabled={
                      pending !== null ||
                      !trimmed ||
                      selectedChannels.length === 0 ||
                      !scheduledFor
                    }
                    className="h-8 rounded-full"
                  >
                    {pending === "schedule" ? t.scheduling : t.scheduleAction}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStage}
                    disabled={
                      pending !== null ||
                      !trimmed ||
                      selectedChannels.length === 0 ||
                      overReviewLimit
                    }
                    className="h-8 gap-1.5 rounded-full"
                  >
                    <Share2 className="size-4" />
                    <span className="hidden md:flex">
                      {pending === "review" ? t.staging : t.stageForReview}
                    </span>
                  </Button>
                  <Button
                    onClick={handlePublish}
                    disabled={pending !== null || blockedReason !== null}
                    className="h-8 gap-1.5 rounded-full"
                    size="sm"
                  >
                    <Send className="size-4" />
                    <span>
                      {pending === "publish" ? t.posting : t.postDirect}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Everything the editor has to say back, under it. */}
          <div className="mx-auto mt-4 w-full max-w-3xl space-y-3 text-start">
            {overReviewLimit && (
              <p className="text-xs text-amber-500">
                {fill(t.overCaptionLimit, { max: MAX_REVIEW_TEXT })}
              </p>
            )}

            {blockedReason && (
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
      </div>
    </section>
  );
}
