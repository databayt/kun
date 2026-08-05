"use client";

// The Hub's cross-stage state, mounted once in the /social layout. Layouts
// persist across child-route navigations, so everything here survives a stage
// switch the way the old dashboard's hidden-panel design kept it alive: the
// brand, the channel selection, the composer's typed copy, and the draft
// agent's queue poll. The pages under /social/* are thin mounts over this.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { isRTL, type Locale } from "@/components/local/config";
import {
  listAnsweredDrafts,
  readSocialDraft,
  requestSocialDraft,
  verifyConnections,
  type AnsweredDraft,
} from "@/actions/post-social";
import {
  CHANNELS,
  DISTRIBUTION_CHANNELS,
  type ChannelId,
} from "@/components/root/social/config";
import {
  DEFAULT_PRODUCT,
  PRODUCT_IDS,
  productChannelWired,
  type ProductId,
} from "@/components/root/social/products";
import {
  getSocialDict,
  type SocialDict,
} from "@/components/root/social/dictionary";
import type { PromptInputMessage } from "@/components/atom/prompt-input";
import type { EgressStatus } from "@/lib/social-status";

/** The five stages, as routes. Order is the documented pipeline's. */
export const STAGES = [
  "calendar",
  "draft",
  "media",
  "publish",
  "measure",
] as const;

export type Stage = (typeof STAGES)[number];

export interface DraftPair {
  ar: string;
  en: string;
  /** The draft's media half — ask-time attachments plus the answerer's picks. */
  mediaUrls: string[];
}

/** The attachment tray's ceiling — mirrors the Zod cap and the platform max. */
const MAX_MEDIA = 10;

export type Reveal = "ar" | "en" | "done" | null;

/**
 * Mirrors draftCopySchema's cap in actions/post-social.ts. An attachment is
 * folded into the brief rather than uploaded — the queue has a brief column,
 * not a file one — so the fold-in has to fit under the same ceiling the action
 * enforces.
 */
const MAX_BRIEF_CHARS = 2000;

/**
 * The agent window's whole conversation, provider-owned so the queue poll and
 * an unrevealed answer survive leaving /social/draft. Only presentation state
 * (focus collapse, the model select) stays in the component.
 */
export interface DraftQueue {
  prompt: string;
  setPrompt: (value: string) => void;
  busy: boolean;
  hasInteracted: boolean;
  draft: DraftPair | null;
  /**
   * The answered SocialDraftRequest's id, kept after the poll stops so the
   * "Use …" hand-off can carry it — approving in the review queue then
   * consumes the request instead of leaving it to be approved twice.
   */
  answeredId: string | null;
  reveal: Reveal;
  error: string | null;
  queueInfo: { pendingAhead?: number; lastDrainAt?: string } | null;
  stalled: boolean;
  submit: (message: PromptInputMessage) => Promise<void>;
  advance: (from: Reveal, to: Reveal) => void;
  reset: () => void;
  checkAgain: () => void;
}

/**
 * The publish stage's queue of answered drafts. List and selection live here
 * so a stage navigation (say, out to the showroom to attach media and back)
 * never loses the draft under review.
 */
export interface ReviewQueue {
  drafts: AnsweredDraft[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** The draft loaded into the editor — null renders the queue empty-state. */
  activeDraftId: string | null;
  /** Copies the draft's copy + media into the editor/tray and selects it. */
  loadDraft: (id: string) => void;
  clearActive: () => void;
}

interface SocialContextValue {
  lang: Locale;
  isRTL: boolean;
  t: SocialDict;
  product: ProductId;
  setProduct: (id: ProductId) => void;
  selectedChannels: ChannelId[];
  setSelectedChannels: (next: ChannelId[]) => void;
  wiredForProduct: ChannelId[];
  status: EgressStatus | null;
  checking: boolean;
  checkConnections: () => Promise<void>;
  transportsReady: boolean;
  /** Navigate to a stage — the tab row and cross-stage jumps share one path. */
  goToStage: (stage: Stage) => void;
  /**
   * The agent window's hand-off. Overwrites whatever is in the editor —
   * pressing "Use …" is the explicit choice to take the draft — then opens
   * the Publish stage. Carrying the request id keeps the queue lifecycle
   * honest: approving there consumes the request.
   */
  handToComposer: (
    text: string,
    mediaUrls?: string[],
    draftId?: string,
  ) => void;
  composerText: string;
  setComposerText: (value: string) => void;
  /**
   * The shared attachment tray — one ordered media set that rides a draft
   * ask, the review editor, and the showroom's Attach in turn.
   */
  composerMediaUrls: string[];
  attachMedia: (url: string) => void;
  removeMedia: (url: string) => void;
  draftQueue: DraftQueue;
  reviewQueue: ReviewQueue;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function useSocial(): SocialContextValue {
  const value = useContext(SocialContext);
  if (!value) {
    throw new Error("useSocial must be used inside <SocialProvider>");
  }
  return value;
}

export function SocialProvider({
  lang,
  children,
}: {
  lang: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = getSocialDict(lang);
  const isRightToLeft = isRTL(lang);

  // Which brand we're publishing as. Every channel toggle, health check, and
  // publish call is scoped to it — Facebook resolves a different Page and a
  // different permanent token per product.
  const [product, setProduct] = useState<ProductId>(DEFAULT_PRODUCT);
  const [selectedChannels, setSelectedChannels] = useState<ChannelId[]>([]);
  const [status, setStatus] = useState<EgressStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [composerText, setComposerText] = useState("");
  const [composerMediaUrls, setComposerMediaUrls] = useState<string[]>([]);
  // The review queue's selection — which answered draft the editor holds.
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const goToStage = useCallback(
    (stage: Stage) => {
      router.push(`/${lang}/social/${stage}`);
    },
    [router, lang],
  );

  // Guards mirror the Zod gate: public http(s) URLs only, deduped, capped.
  // Silent on refusal by design — the showroom's Attach always hands a CDN
  // URL, and the editor's add-URL field validates before it calls this.
  const attachMedia = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return;
    setComposerMediaUrls((prev) =>
      prev.includes(trimmed) || prev.length >= MAX_MEDIA
        ? prev
        : [...prev, trimmed],
    );
  }, []);

  const removeMedia = useCallback((url: string) => {
    setComposerMediaUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  const handToComposer = useCallback(
    (text: string, mediaUrls?: string[], draftId?: string) => {
      setComposerText(text);
      if (mediaUrls) setComposerMediaUrls(mediaUrls.slice(0, MAX_MEDIA));
      setActiveDraftId(draftId ?? null);
      goToStage("publish");
    },
    [goToStage],
  );

  // Publishable for THIS brand: the global transport is wired AND the brand has
  // its own destination on it (its own Page, its own channel). Distribution
  // only — a communication channel is never an audience destination.
  const wiredForProduct = useMemo(
    () =>
      DISTRIBUTION_CHANNELS.filter((ch) =>
        productChannelWired(product, ch.id, ch.wired),
      ).map((ch) => ch.id as ChannelId),
    [product],
  );

  // Switching brand must never carry a selection the new brand can't publish to.
  useEffect(() => {
    setSelectedChannels((prev) => {
      const kept = prev.filter((id) => wiredForProduct.includes(id));
      return kept.length > 0 ? kept : wiredForProduct.slice(0, 1);
    });
  }, [wiredForProduct]);

  // One action, one round trip. The three probes still run in parallel — they
  // just do it server-side instead of as three separate POSTs from here.
  const checkConnections = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await verifyConnections(product));
    } catch (err: unknown) {
      const failed = {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
      setStatus({
        hermes: failed,
        telegram: failed,
        facebook: failed,
        instagram: failed,
      });
    } finally {
      setChecking(false);
    }
  }, [product]);

  useEffect(() => {
    checkConnections();
  }, [checkConnections]);

  // Publish is gated per transport: only the relays the selection actually
  // needs must be connected.
  const transportsReady = useMemo(() => {
    if (!status) return false;
    const needs = (transport: string) =>
      selectedChannels.some(
        (id) => CHANNELS.find((c) => c.id === id)?.transport === transport,
      );
    return (
      (!needs("hermes") || status.hermes.connected) &&
      (!needs("telegram") || status.telegram.connected) &&
      (!needs("facebook") || status.facebook.connected) &&
      (!needs("instagram") || status.instagram.connected)
    );
  }, [status, selectedChannels]);

  // ——— The draft queue ———

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [draft, setDraft] = useState<DraftPair | null>(null);
  const [answeredId, setAnsweredId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
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

  // Only ever forward, so a late onStreamComplete from a block that already
  // finished cannot rewind the reveal and replay it.
  const advance = useCallback((from: Reveal, to: Reveal) => {
    setReveal((current) => (current === from ? to : current));
  }, []);

  // Poll the queued ask until a session answers it. Cleared on unmount, on a
  // terminal status, and before any new ask — a stale timer would keep
  // writing into a window the contributor has moved on from. Living in the
  // provider, "unmount" now means leaving /social entirely, so the poll runs
  // on while the contributor works other stages — the same guarantee the old
  // hidden-panel design gave.
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
        // status line keeps saying what the queue last looked like.
        schedule();
        return;
      }
      if (!res.ok) {
        setDraftError(res.error ?? "Could not read the draft.");
        setBusy(false);
        setRequestId(null);
        return;
      }
      if (res.status === "answered" && res.ar && res.en) {
        setDraft({ ar: res.ar, en: res.en, mediaUrls: res.mediaUrls ?? [] });
        setAnsweredId(requestId);
        setReveal("ar");
        setBusy(false);
        setRequestId(null);
      } else if (res.status === "failed") {
        setDraftError(res.note ?? "The draft could not be written.");
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

  const submit = useCallback(
    async ({ text, files }: PromptInputMessage) => {
      let brief = (text ?? "").trim();

      // An attachment is context for the brief, so read it in rather than
      // posting a file the queue has no column for. Only what fits under the
      // cap goes in.
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
        const attached = parts
          .filter(Boolean)
          .join("\n\n")
          .slice(0, room)
          .trim();
        if (attached) brief = `${brief}${separator}${attached}`;
      }

      if (!brief || busy) return;
      if (pollRef.current) clearTimeout(pollRef.current);
      setBusy(true);
      setHasInteracted(true);
      setDraftError(null);
      setDraft(null);
      setAnsweredId(null);
      setReveal(null);
      setRequestId(null);
      setQueueInfo(null);
      setStalled(false);
      try {
        // The tray rides the ask — a showroom pick or pasted CDN URL becomes
        // the draft's media half, for the answering session to keep or extend.
        const res = await requestSocialDraft({
          product,
          brief,
          mediaUrls: composerMediaUrls,
        });
        if (res.ok && res.id) {
          setRequestId(res.id);
          setPrompt("");
        } else {
          setDraftError(res.error ?? "Unknown error.");
          setBusy(false);
        }
      } catch (err: unknown) {
        setDraftError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    },
    [busy, product, composerMediaUrls],
  );

  const reset = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    setDraft(null);
    setAnsweredId(null);
    setReveal(null);
    setDraftError(null);
    setHasInteracted(false);
    setPrompt("");
    setRequestId(null);
    setBusy(false);
    setQueueInfo(null);
    setStalled(false);
  }, []);

  const checkAgain = useCallback(() => {
    setStalled(false);
    setBusy(true);
    setPollNonce((n) => n + 1);
  }, []);

  // ——— The review queue ———

  const [reviewDrafts, setReviewDrafts] = useState<AnsweredDraft[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const refreshReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await listAnsweredDrafts();
      if (res.ok) {
        setReviewDrafts(res.drafts ?? []);
      } else {
        setReviewError(res.error ?? "Could not read the queue.");
      }
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const loadDraft = useCallback(
    (id: string) => {
      const found = reviewDrafts.find((d) => d.id === id);
      if (found) {
        // Arabic-first house rule: the AR copy loads by default; the editor's
        // language pills refill from the same draft.
        setComposerText(found.ar || found.en);
        setComposerMediaUrls(found.mediaUrls.slice(0, MAX_MEDIA));
        // The draft's brand is authoritative — channels, transport health and
        // the approve payload all scope to it, not to whatever the select
        // happened to show.
        if ((PRODUCT_IDS as readonly string[]).includes(found.brand)) {
          setProduct(found.brand as ProductId);
        }
      }
      setActiveDraftId(id);
    },
    [reviewDrafts],
  );

  const clearActive = useCallback(() => {
    setActiveDraftId(null);
    setComposerText("");
    setComposerMediaUrls([]);
  }, []);

  const reviewQueue: ReviewQueue = {
    drafts: reviewDrafts,
    loading: reviewLoading,
    error: reviewError,
    refresh: refreshReview,
    activeDraftId,
    loadDraft,
    clearActive,
  };

  const draftQueue: DraftQueue = {
    prompt,
    setPrompt,
    busy,
    hasInteracted,
    draft,
    answeredId,
    reveal,
    error: draftError,
    queueInfo,
    stalled,
    submit,
    advance,
    reset,
    checkAgain,
  };

  const value: SocialContextValue = {
    lang,
    isRTL: isRightToLeft,
    t,
    product,
    setProduct,
    selectedChannels,
    setSelectedChannels,
    wiredForProduct,
    status,
    checking,
    checkConnections,
    transportsReady,
    goToStage,
    handToComposer,
    composerText,
    setComposerText,
    composerMediaUrls,
    attachMedia,
    removeMedia,
    draftQueue,
    reviewQueue,
  };

  return (
    <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
  );
}
