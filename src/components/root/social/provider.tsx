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
  dismissDraft,
  listAnsweredDrafts,
  listBrandMedia,
  readAnsweredDraft,
  listDraftReferences,
  listQueuedVariants,
  readSocialDraft,
  refineSocialDraft,
  requestSocialDraft,
  verifyConnections,
  type AnsweredDraft,
  type BrandMedia,
  type DraftReference,
  type QueuedVariant,
} from "@/actions/post-social";
import {
  DEFAULT_DRAFT_MODEL,
  type DismissReasonId,
  type DraftAngleId,
  type DraftModelId,
  type DraftRegisterId,
} from "@/components/root/social/knobs";
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
  ANY_FEATURE,
  ANY_MEDIA_TYPE,
  MEDIA_FILTERS,
  POST_TYPES,
  SETTING_KEYS,
  featuresFor,
  type BrandFeature,
  type MediaFilter,
  type PostType,
} from "@/components/root/social/post-settings";
import { ANY_STYLE, isImageStyle } from "@/components/root/social/image-styles";
import {
  getSocialDict,
  type SocialDict,
} from "@/components/root/social/dictionary";
import type { PromptInputMessage } from "@/components/atom/prompt-input";
import type { EgressStatus } from "@/lib/social-status";
import { findSlot } from "@/components/root/social/plan";

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
 * The direction a contributor sets before asking, and re-aims between turns.
 *
 * Provider state rather than component state for the same reason the poll is:
 * a contributor who steps out to the showroom for an image and comes back
 * should not find the register they chose reset to the default.
 */
export interface DraftKnobs {
  model: DraftModelId;
  setModel: (id: DraftModelId) => void;
  angle: DraftAngleId | null;
  setAngle: (id: DraftAngleId | null) => void;
  register: DraftRegisterId | null;
  setRegister: (id: DraftRegisterId | null) => void;
  referenceId: string | null;
  setReferenceId: (id: string | null) => void;
  /** Prior copy for this brand, offered as "write it like this one". */
  references: DraftReference[];
}

/**
 * The agent window's whole conversation, provider-owned so the queue poll and
 * an unrevealed answer survive leaving /social/draft. Only presentation state
 * (focus collapse) stays in the component.
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
   * consumes the request instead of leaving it to be approved twice. It is
   * also what the next turn refines.
   */
  answeredId: string | null;
  /**
   * 1-based depth of the answer on screen. > 1 means this window is in a
   * conversation, which is what flips the prompt from "describe a post" to
   * "say what to change" — the single piece of state that makes the same box
   * an ask box and a reply box.
   */
  turn: number;
  /** The instruction that produced the answer on screen. Null on turn 1. */
  lastInstruction: string | null;
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
  /**
   * The decided half — approved variants waiting on the cron drain, and ones
   * already delivered. Read-only: the search bar's Scheduled/Published modes
   * browse them, nothing loads them back into the composer.
   */
  variants: QueuedVariant[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** The draft loaded into the editor — null renders the queue empty-state. */
  activeDraftId: string | null;
  /** Copies the draft's copy + media into the editor/tray and selects it. */
  loadDraft: (id: string) => void;
  /**
   * loadDraft for a draft that may not be in the queue read — a calendar slot
   * not yet due. Reads it first, then loads it.
   */
  focusDraft: (id: string) => Promise<void>;
  clearActive: () => void;
  /** Which half of a bilingual draft the editor holds. */
  composerLang: ComposerLang;
  /** Refills the editor from the active draft in that language. */
  setComposerLang: (lang: ComposerLang) => void;
  /** Dismisses the active draft with a reason; the queue drops it. */
  rejectActive: (reason: DismissReasonId) => Promise<string | null>;
}

export type ComposerLang = "ar" | "en" | "both";

/** The editor's text for one draft in one language — Arabic first. */
export function draftText(
  d: { ar: string; en: string },
  lang: ComposerLang,
): string {
  if (lang === "en") return d.en || d.ar;
  if (lang === "both" && d.ar && d.en) return `${d.ar}\n\n—\n\n${d.en}`;
  return d.ar || d.en;
}

/**
 * A setting that outlives the visit. Reads on mount rather than during render
 * so the server and the first client paint agree; a stored value that no
 * longer validates is ignored rather than crashing the stage.
 */
export function usePersisted<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => value is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored && isValid(stored)) setValue(stored);
    // `isValid` is a fresh closure each render and the key never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const commit = useCallback(
    (next: T) => {
      setValue(next);
      window.localStorage.setItem(key, next);
    },
    [key],
  );
  return [value, commit];
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
  /**
   * The post's settings, shared by every stage that wears the box. Publish
   * owns timing on top of these; Draft and Media wear the subset that means
   * anything to them.
   */
  feature: string;
  setFeature: (next: string) => void;
  brandFeatures: BrandFeature[];
  /**
   * The calendar slot being written (`<brand>#NNN`), or null for an ad-hoc
   * post. Set by the Calendar's "Write it"; rides every ask so the draft
   * lands linked to its slot.
   */
  planSlot: string | null;
  setPlanSlot: (next: string | null) => void;
  postType: PostType;
  setPostType: (next: PostType) => void;
  mediaFilter: MediaFilter;
  setMediaFilter: (next: MediaFilter) => void;
  mediaType: string;
  setMediaType: (next: string) => void;
  imageStyle: string;
  setImageStyle: (next: string) => void;
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
  /** Library assets for the current brand — the composer's recommended strip. */
  brandMedia: BrandMedia[];
  attachMedia: (url: string) => void;
  removeMedia: (url: string) => void;
  draftKnobs: DraftKnobs;
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

  // ── The post's settings ───────────────────────────────────────────────────
  //
  // These lived inside the Publish box, which was fine while Publish was the
  // only stage that had them. Draft and Media wear the same settings now, and
  // a pick made on one stage that vanished on the next would be the exact
  // thing this provider exists to prevent — the tray and the editor already
  // survive the trip, and "which brand, which feature" is a stranger thing to
  // lose than an attachment.
  //
  // The localStorage keys are unchanged, so nobody's saved picks reset.
  const [feature, setFeature] = usePersisted<string>(
    SETTING_KEYS.feature,
    ANY_FEATURE,
    (v): v is string => typeof v === "string",
  );
  const [postType, setPostType] = usePersisted<PostType>(
    SETTING_KEYS.postType,
    "image",
    (v): v is PostType => (POST_TYPES as readonly string[]).includes(v),
  );
  const [mediaFilter, setMediaFilter] = usePersisted<MediaFilter>(
    SETTING_KEYS.mediaFilter,
    "any",
    (v): v is MediaFilter => (MEDIA_FILTERS as readonly string[]).includes(v),
  );
  const [mediaType, setMediaType] = usePersisted<string>(
    SETTING_KEYS.mediaType,
    ANY_MEDIA_TYPE,
    (v): v is string => typeof v === "string",
  );
  const [imageStyle, setImageStyle] = usePersisted<string>(
    SETTING_KEYS.imageStyle,
    ANY_STYLE,
    (v): v is string => isImageStyle(v),
  );

  /**
   * Features are that brand's own vocabulary — mkan has no Attendance — so a
   * feature that does not survive a brand change is dropped rather than kept
   * as a stale label.
   */
  const brandFeatures = useMemo(() => featuresFor(product), [product]);
  useEffect(() => {
    if (
      feature !== ANY_FEATURE &&
      !brandFeatures.some((f) => f.id === feature)
    ) {
      setFeature(ANY_FEATURE);
    }
  }, [brandFeatures, feature, setFeature]);
  // A slot belongs to one brand; switching brand ends the slot.
  const [planSlot, setPlanSlot] = useState<string | null>(null);
  useEffect(() => {
    if (planSlot && !planSlot.startsWith(`${product}#`)) setPlanSlot(null);
  }, [product, planSlot]);
  const [status, setStatus] = useState<EgressStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [composerText, setComposerText] = useState("");
  const [composerMediaUrls, setComposerMediaUrls] = useState<string[]>([]);
  // The review queue's selection — which answered draft the editor holds.
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  // Read by refreshReview, which must keep the post in hand without being
  // rebuilt (and re-polling) every time a different draft is opened.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeDraftId;
  }, [activeDraftId]);

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
        slack: failed,
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
      (!needs("slack") || status.slack.connected) &&
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
  const [turn, setTurn] = useState(1);
  const [lastInstruction, setLastInstruction] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal>(null);

  // ——— The knobs ———

  const [model, setModel] = useState<DraftModelId>(DEFAULT_DRAFT_MODEL);
  const [angle, setAngle] = useState<DraftAngleId | null>(null);
  const [register, setRegister] = useState<DraftRegisterId | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [references, setReferences] = useState<DraftReference[]>([]);

  // References are per brand, and a reference from another brand is dropped
  // server-side anyway — so switching brand clears the pick rather than leaving
  // a selected chip that will silently do nothing.
  useEffect(() => {
    let cancelled = false;
    setReferenceId(null);
    listDraftReferences(product)
      .then((res) => {
        if (!cancelled) setReferences(res.ok ? (res.references ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setReferences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  // The composer's recommended strip. Same per-brand shape as references, and
  // deliberately non-blocking: a library read that fails leaves an empty strip,
  // never a broken composer — attaching media is optional, writing is not.
  const [brandMedia, setBrandMedia] = useState<BrandMedia[]>([]);

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
        setTurn(res.turn ?? 1);
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

      // An answer on screen makes this box a reply box: the same submit
      // refines the draft the contributor just read instead of starting an
      // unrelated one. "Start new" is how you get the other behaviour, and it
      // is the only way — an implicit switch back would silently orphan the
      // thread someone is mid-conversation with.
      const isRefinement = Boolean(answeredId && draft);

      setBusy(true);
      setHasInteracted(true);
      setDraftError(null);
      // The previous answer stays on screen through a refinement, so the wait
      // shows what is being changed rather than an empty panel. A fresh ask
      // clears, because nothing on screen relates to it any more.
      if (!isRefinement) {
        setDraft(null);
        setAnsweredId(null);
        setTurn(1);
        setLastInstruction(null);
        setReveal(null);
      }
      setRequestId(null);
      setQueueInfo(null);
      setStalled(false);
      try {
        const res = isRefinement
          ? await refineSocialDraft({
              parentId: answeredId,
              instruction: brief,
              model,
              angle: angle ?? undefined,
              register: register ?? undefined,
            })
          : // The tray rides the ask — a showroom pick or pasted CDN URL becomes
            // the draft's media half, for the answering session to keep or extend.
            await requestSocialDraft({
              product,
              brief,
              mediaUrls: composerMediaUrls,
              model,
              angle: angle ?? undefined,
              register: register ?? undefined,
              referenceId: referenceId ?? undefined,
              // The settings row's picks — the Draft box offered them and
              // they used to go nowhere. The feature's concept note and the
              // slot's direction ride into the prompt server-side.
              slot: planSlot ?? undefined,
              feature: feature !== ANY_FEATURE ? feature : undefined,
              channel: selectedChannels[0],
              shape: postType,
            });
        if (res.ok && res.id) {
          setRequestId(res.id);
          if (isRefinement) setLastInstruction(brief);
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
    [
      busy,
      product,
      composerMediaUrls,
      answeredId,
      draft,
      model,
      angle,
      register,
      referenceId,
      planSlot,
      feature,
      selectedChannels,
      postType,
    ],
  );

  const reset = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    setDraft(null);
    setAnsweredId(null);
    setTurn(1);
    setLastInstruction(null);
    setReveal(null);
    setDraftError(null);
    setHasInteracted(false);
    setPrompt("");
    setRequestId(null);
    setBusy(false);
    setQueueInfo(null);
    setStalled(false);
    // Knobs deliberately survive: "start new" ends a conversation, it does not
    // undo the register or the model someone set for this brand's whole session.
  }, []);

  const checkAgain = useCallback(() => {
    setStalled(false);
    setBusy(true);
    setPollNonce((n) => n + 1);
  }, []);

  // ——— The review queue ———

  const [reviewDrafts, setReviewDrafts] = useState<AnsweredDraft[]>([]);
  const [reviewVariants, setReviewVariants] = useState<QueuedVariant[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const refreshReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      // One refresh, both halves — a mode row that switched between a fresh
      // list and a stale one would be the same bug as two refresh buttons.
      const [drafts, variants] = await Promise.all([
        listAnsweredDrafts(),
        listQueuedVariants(),
      ]);
      if (drafts.ok) {
        // A draft opened by link (?draft=, a calendar slot not yet due) is
        // outside the queue's window; a refresh must not drop the post in hand.
        const fresh = drafts.drafts ?? [];
        setReviewDrafts((prev) => {
          const held = prev.find((d) => d.id === activeIdRef.current);
          return held && !fresh.some((d) => d.id === held.id)
            ? [...fresh, held]
            : fresh;
        });
      } else {
        setReviewError(drafts.error ?? "Could not read the queue.");
      }
      // The decided half is context, not the work: a failure there leaves the
      // review queue usable rather than blanking the stage.
      if (variants.ok) setReviewVariants(variants.variants ?? []);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const [composerLang, setComposerLangState] = useState<ComposerLang>("ar");

  const loadDraft = useCallback(
    (id: string, given?: AnsweredDraft) => {
      const found = given ?? reviewDrafts.find((d) => d.id === id);
      if (found) {
        // Arabic-first house rule: the AR copy loads by default; the language
        // toggle refills from the same draft. It used to be `ar || en` with no
        // way back to the English half from Publish.
        setComposerLangState("ar");
        setComposerText(draftText(found, "ar"));
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

  const focusDraft = useCallback(
    async (id: string) => {
      const inQueue = reviewDrafts.find((d) => d.id === id);
      if (inQueue) return loadDraft(id);
      const res = await readAnsweredDraft(id).catch(() => null);
      if (res?.ok && res.draft) {
        const draft = res.draft;
        setReviewDrafts((prev) =>
          prev.some((d) => d.id === draft.id) ? prev : [...prev, draft],
        );
        loadDraft(id, draft);
      } else {
        setReviewError(res?.error ?? "Could not open that draft.");
      }
    },
    [reviewDrafts, loadDraft],
  );

  const clearActive = useCallback(() => {
    setActiveDraftId(null);
    setComposerText("");
    setComposerMediaUrls([]);
  }, []);

  const setComposerLang = useCallback(
    (next: ComposerLang) => {
      setComposerLangState(next);
      const found = reviewDrafts.find((d) => d.id === activeDraftId);
      if (found) setComposerText(draftText(found, next));
    },
    [reviewDrafts, activeDraftId],
  );

  const rejectActive = useCallback(
    async (reason: DismissReasonId): Promise<string | null> => {
      if (!activeDraftId) return null;
      const res = await dismissDraft({ draftId: activeDraftId, reason }).catch(
        (err: unknown) => ({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      if (!res.ok) return res.error ?? "Could not reject the draft.";
      setReviewDrafts((prev) => prev.filter((d) => d.id !== activeDraftId));
      clearActive();
      void refreshReview();
      return null;
    },
    [activeDraftId, clearActive, refreshReview],
  );

  // The feature narrows and ranks it: the media made for this feature first,
  // then the product's real screens for it, then brand-wide assets. With no
  // feature picked, the post in hand says what it is about — the loaded
  // draft's feature, else the calendar slot's — so a calendar post opened on
  // "All" still gets its screens offered.
  const mediaFeature =
    feature !== ANY_FEATURE
      ? feature
      : (reviewDrafts.find((d) => d.id === activeDraftId)?.feature ??
        (planSlot ? findSlot(planSlot)?.feature : undefined) ??
        feature);
  useEffect(() => {
    let cancelled = false;
    listBrandMedia(product, mediaFeature)
      .then((res) => {
        if (!cancelled) setBrandMedia(res.ok ? (res.media ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setBrandMedia([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product, mediaFeature]);

  const reviewQueue: ReviewQueue = {
    drafts: reviewDrafts,
    variants: reviewVariants,
    loading: reviewLoading,
    error: reviewError,
    refresh: refreshReview,
    activeDraftId,
    loadDraft,
    focusDraft,
    clearActive,
    composerLang,
    setComposerLang,
    rejectActive,
  };

  const draftKnobs: DraftKnobs = {
    model,
    setModel,
    angle,
    setAngle,
    register,
    setRegister,
    referenceId,
    setReferenceId,
    references,
  };

  const draftQueue: DraftQueue = {
    prompt,
    setPrompt,
    busy,
    hasInteracted,
    draft,
    answeredId,
    turn,
    lastInstruction,
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
    feature,
    setFeature,
    brandFeatures,
    planSlot,
    setPlanSlot,
    postType,
    setPostType,
    mediaFilter,
    setMediaFilter,
    mediaType,
    setMediaType,
    imageStyle,
    setImageStyle,
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
    brandMedia,
    attachMedia,
    removeMedia,
    draftKnobs,
    draftQueue,
    reviewQueue,
  };

  return (
    <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
  );
}
