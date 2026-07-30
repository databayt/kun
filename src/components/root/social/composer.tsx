"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Send,
  Share2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  publishPostDirect,
  schedulePost,
  stageForReview,
} from "@/actions/post-social";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import { fill, type SocialDict } from "@/components/root/social/dictionary";
import type { ChannelOutcome } from "@/lib/social-publish";
import type { ProductId } from "@/components/root/social/products";

// Mirrors the Zod cap in actions/post-social.ts. The review lane once capped
// lower because the approval token carried the copy inside the URL; the token
// now names a variant id (see lib/social-token.ts), so both lanes take the
// same cap and the guard below is a relic kept only as defence in depth.
const MAX_TEXT = 4000;
const MAX_REVIEW_TEXT = 4000;

interface ComposerProps {
  product: ProductId;
  selectedChannels: ChannelId[];
  wiredForProduct: ChannelId[];
  /** Null while the egress probe is still in flight. */
  transportsReady: boolean;
  isRTL: boolean;
  t: SocialDict;
  /** A draft handed over by the agent window; the nonce forces re-injection. */
  prefill?: { text: string; nonce: number } | null;
}

export function Composer({
  product,
  selectedChannels,
  wiredForProduct,
  transportsReady,
  isRTL,
  t,
  prefill,
}: ComposerProps) {
  const [postText, setPostText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [pending, setPending] = useState<
    "publish" | "review" | "schedule" | null
  >(null);
  const [outcomes, setOutcomes] = useState<ChannelOutcome[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The agent window's hand-off. Deliberately overwrites whatever is in the
  // box — pressing "Use …" is the explicit choice to take the draft.
  useEffect(() => {
    if (prefill) setPostText(prefill.text);
  }, [prefill]);

  const trimmed = postText.trim();
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
  };

  const payload = () => ({
    product,
    text: postText,
    channels: selectedChannels,
    mediaUrl: mediaUrl.trim() || undefined,
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
        setPostText("");
        setMediaUrl("");
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
        setPostText("");
        setMediaUrl("");
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
        setNotice(`${t.stagedMsg}${res.via ? ` (${res.via})` : ""}`);
        setPostText("");
        setMediaUrl("");
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

  const channelLabel = (id: ChannelId) => {
    const channel = CHANNELS.find((c) => c.id === id);
    if (!channel) return id;
    return isRTL ? channel.labelAr : channel.label;
  };

  return (
    <div
      id="composer"
      className="border-border bg-card/40 rounded-xl border p-6 shadow-lg backdrop-blur-md transition-all duration-300 hover:shadow-xl"
    >
      <div className="mb-2 flex items-center gap-3">
        <div className="bg-primary/10 text-primary rounded-lg p-2">
          <Send className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-primary text-lg font-medium">
            {t.composerTitle}
          </h3>
          <p className="text-muted-foreground text-sm font-light">
            {t.composerDesc}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {wiredForProduct.length === 0 && (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-xs">
            {t.noChannels}
          </p>
        )}

        <div>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder={t.textareaPlaceholder}
            rows={6}
            maxLength={MAX_TEXT}
            className="border-border bg-input/10 focus:border-primary w-full rounded-lg border p-4 text-base transition-colors focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between gap-3">
            <span
              className={`text-xs ${
                overReviewLimit ? "text-amber-500" : "text-muted-foreground"
              }`}
            >
              {overReviewLimit
                ? fill(t.overCaptionLimit, { max: MAX_REVIEW_TEXT })
                : ""}
            </span>
            <span
              className="text-muted-foreground shrink-0 font-mono text-xs"
              dir="ltr"
            >
              {fill(t.charCount, { count: trimmed.length, max: MAX_TEXT })}
            </span>
          </div>
        </div>

        <div>
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
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder={t.mediaPlaceholder}
            className="font-mono text-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs">{t.mediaHint}</p>
        </div>

        <div>
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
            className="w-auto text-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs">{t.scheduleHint}</p>
        </div>

        {notice && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-500">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-muted-foreground text-xs">
            {blockedReason ?? ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSchedule}
              disabled={
                pending !== null ||
                !trimmed ||
                selectedChannels.length === 0 ||
                !scheduledFor
              }
              className="flex items-center gap-2 font-medium"
            >
              <CalendarClock className="h-4 w-4" />
              <span>
                {pending === "schedule" ? t.scheduling : t.scheduleAction}
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={handleStage}
              disabled={
                pending !== null ||
                !trimmed ||
                selectedChannels.length === 0 ||
                overReviewLimit
              }
              className="flex items-center gap-2 font-medium"
            >
              <Share2 className="h-4 w-4" />
              <span>{pending === "review" ? t.staging : t.stageForReview}</span>
            </Button>
            <Button
              onClick={handlePublish}
              disabled={pending !== null || blockedReason !== null}
              className="flex items-center gap-2 font-medium"
            >
              <Send className="h-4 w-4" />
              <span>{pending === "publish" ? t.posting : t.postDirect}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
