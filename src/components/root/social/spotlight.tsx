"use client";

// The publish stage's search bar — how a draft gets into the composer, and how
// the rest of the lane stays visible while you work.
//
// Shaped after hogwarts' spotlight (components/atom/generic-command-menu), and
// deliberately NOT a port of it: that one is a Cmd+K modal over a surface-aware
// config with RBAC and a server search. Here the whole corpus is already in the
// client — the provider hands us every answered draft and the recent scheduled
// and published variants — so search is a filter over arrays, with no endpoint,
// no debounce and no loading state to design around. What is borrowed is the
// part that matters: the glass bar, the spring-revealed dropdown, the circular
// category buttons, the per-row kind icon, and cmdk's keyboard model.
//
// Not a modal, on purpose. Spotlight hides what is behind it because it is a
// launcher over a desktop; this box sits at the top of the thing it filters, so
// covering the queue would be hiding the answer.
//
// It finds; it does not send. It briefly had its own send row, and that was a
// mistake: the composer below is already a place to write and already has a
// Send, so the page grew two writing surfaces and three ways to publish. The
// composer is the single sender now — empty means write from scratch, and this
// box is how you fill it from the queue instead.
//
// ——— The mode row ———
//
// Four modes, as split icon buttons in the bar: All · Drafts · Scheduled ·
// Published. They are not decoration over one list — they are three different
// tables. Drafts are `SocialDraftRequest` rows awaiting a human decision;
// scheduled and published are `SocialVariant` rows where that decision is
// already made. Before this, answering "did that one go out?" meant leaving the
// stage for the ledger on /social/measure, which is why the ledger's own comment
// calls variant-awareness a gap.
//
// Only a DRAFT loads into the composer. A variant is downstream of a
// SocialPiece, so approving one again would mint a duplicate — those rows open
// the ledger instead, and say so on the row.
//
// The queue shows on focus, before a single keystroke — the common case is
// "show me what is waiting", not "search". Typing narrows it.
//
// Scoped to the brand in the picker, because that picker already scopes the
// channels, the transport check and the approve payload; a queue that ignored
// it would be the one control on the page that disagreed with the others.
//
// But scoped is not the same as hidden. `loadDraft` SWITCHES the Hub's brand to
// the draft's, so a strict filter would make every other brand's work
// unreachable from the box that exists to reach things. Other brands stay, in a
// second group, once a query is typed or the filter menu opts into every brand
// — the label says opening one switches the brand, so the side effect is
// announced rather than sprung.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Images,
  Layers,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Settings,
  Settings2,
  X,
  SlidersHorizontal,
  Video,
  type LucideIcon,
} from "lucide-react";

import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandSlack,
  IconBrandSnapchat,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBrandX,
  IconCalendarClock,
  IconEye,
  IconSend,
  type IconProps,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { matchesQuery } from "@/lib/normalize-search";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediaKind } from "@/lib/media-kind";
import {
  approveDraft,
  publishPostDirect,
  readSocialDraft,
  refineSocialDraft,
  requestSocialDraft,
  schedulePost,
  stageForReview,
  type BrandMedia,
  type PostResult,
  type ReviewLink,
} from "@/actions/post-social";
import { composeBrief } from "@/components/root/social/brief";
import {
  pillarSubject,
  pillarsFor,
} from "@/components/root/social/pillars";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import {
  ANY_STYLE,
  IMAGE_STYLES,
  isImageStyle,
  styleLabel,
} from "@/components/root/social/image-styles";
import {
  DESTINATIONS,
  ANY_FEATURE,
  MEDIA_FILTERS,
  POST_TYPES,
  ANY_MEDIA_TYPE,
  SETTING_KEYS,
  POST_TYPE_META,
  featureFits,
  featureLabel,
  featuresFor,
  libraryFits,
  queueFits,
  type Destination,
  type BrandFeature,
  type MediaFilter,
  type PostType,
  type PostTypeMeta,
} from "@/components/root/social/post-settings";
import {
  DRAFT_ANGLES,
  DRAFT_MODELS,
  DRAFT_REGISTERS,
} from "@/components/root/social/knobs";
import {
  PICKABLE_PRODUCTS,
  PRODUCTS,
  SOCIAL_PRODUCTS,
  type ProductId,
} from "@/components/root/social/products";
import { fill, type SocialDict } from "@/components/root/social/dictionary";
import { useSocial, usePersisted } from "@/components/root/social/provider";
import {
  GLASS,
  SPOTLIGHT_BAR,
  SPOTLIGHT_PANEL,
  useSpotlightBox,
} from "@/components/root/social/spotlight-shell";

/**
 * Opaque rather than a real backdrop blur — the same call hogwarts made. A
 * blurred panel over a scrolling list reads as smeared rather than glassy.
 */
/**
 * The bar every stage box wears now lives in spotlight-shell.tsx, beside the
 * two handlers that decide when its panel is open. Re-exported here because
 * this file is the barrel three other boxes already import from.
 */
export { GLASS };

/**
 * What Approve does — publish on the spot, or write `scheduled` variants for
 * the ~15-minute cron drain. Persisted per browser; it used to live on the
 * review panel beside a composer that is no longer there, so it travels with
 * the Send it configures.
 */
type ApproveMode = "now" | "schedule";

const APPROVE_MODE_KEY = "social:approve-mode";

const DESTINATION_KEY = SETTING_KEYS.destination;

/** The select's "no pillar chosen" row, stored as a value rather than absence. */

type Mode = "all" | "draft" | "scheduled" | "published";
type Scope = "brand" | "every";
type Order = "oldest" | "newest";

/** One row of the dropdown, whichever table it came from. */
interface QueueItem {
  id: string;
  kind: "draft" | "scheduled" | "published";
  brand: string;
  text: string;
  /** ISO — filed (draft), due (scheduled) or delivered (published). */
  when: string;
  mediaUrls: string[];
  /** Drafts only: refinement depth, rendered as a v2 badge. */
  turn?: number;
  /** Variants only. */
  channel?: string;
  /** Drafts only: the ask it was written from, which carries its pillar. */
  brief?: string;
  /** Everything the matcher may look at, joined once. */
  haystack: string;
}

const MODES: readonly {
  id: Mode;
  icon: LucideIcon;
  labelKey: keyof SocialDict;
  shortcut: string;
}[] = [
  { id: "all", icon: Layers, labelKey: "spotlightModeAll", shortcut: "⌘1" },
  {
    id: "draft",
    icon: PenLine,
    labelKey: "spotlightModeDrafts",
    shortcut: "⌘2",
  },
  {
    id: "scheduled",
    icon: CalendarClock,
    labelKey: "spotlightModeScheduled",
    shortcut: "⌘3",
  },
  {
    id: "published",
    icon: CheckCircle2,
    labelKey: "spotlightModePublished",
    shortcut: "⌘4",
  },
] as const;

/**
 * A channel's own glyph, for the picker that offers it.
 *
 * Tabler rather than an asset folder: these are platform marks, they ship with
 * a dependency the app already has, and they are drawn as icons — an outline
 * that sits beside our own brand marks without pretending to be one. lucide
 * dropped its brand set, which is why the house icon library cannot serve here.
 *
 * Keyed by the ids in config.ts. A channel with no entry falls back to its
 * name, the same way a brand without artwork does.
 */
/** One name per shape, so the summary and the cards cannot disagree. */
const POST_TYPE_LABEL: Record<PostType, keyof SocialDict> = {
  text: "postTypeText",
  image: "postTypeImage",
  gallery: "postTypeGallery",
  video: "postTypeVideo",
  imageOnly: "postTypeImageOnly",
  videoOnly: "postTypeVideoOnly",
  carousel: "postTypeCarousel",
  story: "postTypeStory",
  reel: "postTypeReel",
};

const CHANNEL_ICON: Record<string, React.ComponentType<IconProps>> = {
  facebook: IconBrandFacebook,
  instagram: IconBrandInstagram,
  whatsapp: IconBrandWhatsapp,
  x: IconBrandX,
  linkedin: IconBrandLinkedin,
  tiktok: IconBrandTiktok,
  snapchat: IconBrandSnapchat,
  slack: IconBrandSlack,
};

const KIND_ICON: Record<QueueItem["kind"], LucideIcon> = {
  draft: PenLine,
  scheduled: CalendarClock,
  published: CheckCircle2,
};

/** The group heading in "all" mode — the mode row's own words, plural. */
const KIND_HEADING_KEY: Record<QueueItem["kind"], keyof SocialDict> = {
  draft: "spotlightModeDrafts",
  scheduled: "spotlightModeScheduled",
  published: "spotlightModePublished",
};

/**
 * A choice that survives a reload, read after mount so the server render never
 * touches localStorage. Three settings wanted the same six lines.
 */
export function ReviewSpotlight({
  onEngagedChange,
  triggerCenter,
}: {
  /**
   * Fires when the box opens or closes. The stage above uses it to lock the
   * screen around this column — see review.tsx. A callback rather than shared
   * state because only one surface reacts, and the box should not have to know
   * what reacting means.
   */
  onEngagedChange?: (engaged: boolean) => void;
  triggerCenter?: () => void;
} = {}) {
  const {
    t,
    lang,
    isRTL,
    product,
    reviewQueue,
    selectedChannels,
    transportsReady,
    composerText,
    setComposerText,
    composerMediaUrls,
    brandMedia,
    attachMedia,
    removeMedia,
    goToStage,
    checking,
    checkConnections,
    setProduct,
    setSelectedChannels,
    wiredForProduct,
    draftKnobs,
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
  } = useSocial();
  const router = useRouter();

  // ONE field, two jobs: what is typed here is the post copy AND the query the
  // queue below is filtered by. It reads from the provider rather than local
  // state so a draft loaded out of the queue lands in the same box the writer
  // is already looking at, and so leaving the stage does not lose the copy.
  const query = composerText;
  const setQuery = setComposerText;

  const [mode, setMode] = React.useState<Mode>("all");
  const [scope, setScope] = React.useState<Scope>("brand");
  const [order, setOrder] = React.useState<Order>("oldest");
  const [mediaOnly, setMediaOnly] = React.useState(false);
  // Radix portals the filter menu outside this subtree, so a plain blur would
  // close the dropdown the moment the menu opens.
  const [menuOpen, setMenuOpen] = React.useState(false);
  // Which face the one panel is wearing. The dropdown under the bar is the
  // only revealed surface this box has; the media picker borrows it rather
  // than floating a second layer over the page.
  const [panel, setPanel] = React.useState<"queue" | "media" | "config">(
    "queue",
  );
  // The settings dialog. Like the filters menu it portals out of this subtree,
  // so the panel has to be told to stay open behind it.
  // Brand is open by default: the face should show something the moment it
  // appears, and brand is the setting every other one is scoped by.
  const [configFocus, setConfigFocus] = React.useState<ConfigSection | null>(
    "brand",
  );
  const [sending, setSending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /** Signed approval links, when Send staged instead of published. */
  const [links, setLinks] = React.useState<ReviewLink[] | null>(null);
  // `menuOpen` is the hold: the filters menu portals out of this subtree, so a
  // focus landing in it reads as a focus leaving the box, and its Escape
  // bubbles through the React tree to the box's own handler.
  const { setFocused, open, inputRef, shellProps } =
    useSpotlightBox<HTMLTextAreaElement>({
      onEngagedChange,
      triggerCenter,
      hold: menuOpen,
    });

  const [destination, setDestination] = usePersisted<Destination>(
    DESTINATION_KEY,
    "direct",
    (v): v is Destination => (DESTINATIONS as readonly string[]).includes(v),
  );

  // The time "Later" means, as a datetime-local string ("2026-08-25T18:00").
  //
  // It exists because "Later" did not work. `approveDraft({mode:"schedule"})`
  // rejects a payload with no `scheduledFor` — "Pick a date and time first." —
  // and the box never sent one, so a queued draft could not be scheduled at
  // all. Typed copy was worse: the send routed on whether a draft was loaded,
  // so with none, Later fell through to `publishPostDirect` and the post went
  // out immediately. A control that says Later and publishes now is the one
  // kind of bug this box must not have.
  //
  // Deliberately NOT persisted. A brand or a channel is a preference that
  // should survive the tab; a specific Tuesday evening is not, and restoring
  // one a week later would schedule into the past.
  const [scheduleAt, setScheduleAt] = React.useState("");

  // A time whenever Later is on and none is set — the seed for both ways in.
  //
  // Pressing Later is one. The other is remembering it: the destination is
  // persisted and the time deliberately is not, so someone who left the box on
  // Later returns with no time and would find Send off, its reason pointing at
  // a control they have not opened. Fifteen minutes out is what Later used to
  // claim it meant, back when it meant nothing.
  React.useEffect(() => {
    if (destination !== "schedule" || scheduleAt) return;
    const soon = new Date(Date.now() + 15 * 60_000);
    soon.setSeconds(0, 0);
    setScheduleAt(toLocalInput(soon));
  }, [destination, scheduleAt]);


  const trimmed = query.trim();

  const brandLabel = React.useCallback(
    (id: string) => {
      const p = PRODUCTS.find((entry) => entry.id === id);
      return p ? (isRTL ? p.labelAr : p.label) : id;
    },
    [isRTL],
  );

  const channelLabel = React.useCallback(
    (id?: string) => {
      if (!id) return null;
      const c = CHANNELS.find((entry) => entry.id === id);
      return c ? (isRTL ? c.labelAr : c.label) : id;
    },
    [isRTL],
  );

  // Both tables, normalized once. The corpus is already here — filter it, do
  // not fetch it. Matching folds Arabic orthography on both sides so "مكان"
  // finds "مكـان".
  const items = React.useMemo<QueueItem[]>(() => {
    const drafts: QueueItem[] = reviewQueue.drafts.map((d) => ({
      id: d.id,
      kind: "draft",
      brand: d.brand,
      text: d.ar || d.en || d.brief,
      when: d.answeredAt ?? d.createdAt,
      mediaUrls: d.mediaUrls,
      turn: d.turn,
      brief: d.brief,
      haystack: [
        d.ar,
        d.en,
        d.brief,
        d.instruction ?? "",
        brandLabel(d.brand),
        d.brand,
      ]
        .filter(Boolean)
        .join(" "),
    }));

    const variants: QueueItem[] = reviewQueue.variants.map((v) => ({
      id: v.id,
      kind: v.kind,
      brand: v.brand,
      text: v.text,
      when: v.when,
      mediaUrls: v.mediaUrls,
      channel: v.channel,
      haystack: [
        v.text,
        brandLabel(v.brand),
        v.brand,
        channelLabel(v.channel) ?? "",
        v.channel,
      ]
        .filter(Boolean)
        .join(" "),
    }));

    return [...drafts, ...variants];
  }, [reviewQueue.drafts, reviewQueue.variants, brandLabel, channelLabel]);

  /**
   * Everything the query and the filter menu allow, before the mode row picks
   * a slice. Counting the modes against THIS is what lets the row say where a
   * search actually landed rather than how big each table is.
   */
  const matching = React.useMemo(
    () =>
      items.filter((item) => {
        if (mediaOnly && item.mediaUrls.length === 0) return false;
        // The settings face reaches the queue too: asking for Video narrows
        // this to drafts and posts that actually carry one.
        if (!queueFits(item.mediaUrls, mediaFilter)) return false;
        // Every mode, not only drafts: a feature is matched on the words a
        // post uses, and a published post uses them too.
        if (
          !featureFits(
            item.brand,
            item.haystack,
            feature === ANY_FEATURE ? null : feature,
          )
        ) {
          return false;
        }
        return !trimmed || matchesQuery(item.haystack, trimmed);
      }),
    [items, mediaOnly, mediaFilter, feature, trimmed],
  );

  const counts = React.useMemo(() => {
    // Counts follow the brand the picker shows — the number next to "Drafts"
    // has to mean the rows about to be listed, or it is a different question's
    // answer sitting on this button.
    const inScope = matching.filter(
      (item) => scope === "every" || item.brand === product,
    );
    return {
      all: inScope.length,
      draft: inScope.filter((i) => i.kind === "draft").length,
      scheduled: inScope.filter((i) => i.kind === "scheduled").length,
      published: inScope.filter((i) => i.kind === "published").length,
    } satisfies Record<Mode, number>;
  }, [matching, scope, product]);

  /**
   * Relative age, the same coarse one the queue rows use — the Queue word's
   * list asks the same question ("how long has this waited"), so it should not
   * grow a second clock that rounds differently.
   */
  const ageLabel = React.useCallback(
    (iso: string) => {
      const minutes = Math.max(
        0,
        Math.round((Date.now() - new Date(iso).getTime()) / 60_000),
      );
      const age =
        minutes >= 60 * 24
          ? `${Math.round(minutes / (60 * 24))}d`
          : minutes >= 60
            ? `${Math.round(minutes / 60)}h`
            : `${minutes}m`;
      return fill(t.reviewAgo, { age });
    },
    [t],
  );

  /**
   * This brand's drafts awaiting review, oldest first — what the Queue word
   * lists. Derived from the corpus already in the client, so reaching the
   * queue costs no read.
   */
  const brandDrafts = React.useMemo(
    () =>
      items
        .filter((i) => i.kind === "draft" && i.brand === product)
        .sort((a, b) => a.when.localeCompare(b.when)),
    [items, product],
  );

  const sort = React.useCallback(
    (list: QueueItem[]) =>
      [...list].sort((a, b) => {
        const delta = a.when.localeCompare(b.when);
        return order === "oldest" ? delta : -delta;
      }),
    [order],
  );

  const inMode = React.useCallback(
    (item: QueueItem) => mode === "all" || item.kind === mode,
    [mode],
  );

  /** This brand's slice. Shown even with no query. */
  const mine = React.useMemo(
    () =>
      sort(matching.filter((item) => item.brand === product && inMode(item))),
    [matching, product, inMode, sort],
  );

  /**
   * Everything else that matches. With scope "brand" this stays empty until
   * something is typed — an untyped dump of the other brands is the brand
   * picker's job to change, not this box's job to pre-empt. The filter menu is
   * the explicit way to ask for all of them.
   */
  const others = React.useMemo(() => {
    if (scope === "brand" && !trimmed) return [];
    return sort(
      matching.filter((item) => item.brand !== product && inMode(item)),
    );
  }, [matching, product, inMode, sort, scope, trimmed]);

  const adjustTextareaHeight = React.useCallback(() => {
    const el = inputRef.current as HTMLTextAreaElement | null;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(48, el.scrollHeight), 280);
    el.style.height = `${nextHeight}px`;
  }, [inputRef]);

  React.useEffect(() => {
    adjustTextareaHeight();
    const frame = requestAnimationFrame(adjustTextareaHeight);
    return () => cancelAnimationFrame(frame);
  }, [query, adjustTextareaHeight]);

  const handleSelect = React.useCallback(
    (item: QueueItem) => {
      if (item.kind !== "draft") {
        // Read-only: a variant is downstream of a piece, so there is nothing
        // here to re-approve. The ledger is where its status and numbers live.
        router.push(`/${lang}/social/measure#social-ledger`);
        return;
      }
      // MUST go through loadDraft: it hydrates the composer, fills the media
      // tray, AND switches the Hub's brand to the draft's. Setting the active
      // id alone would leave the approve payload scoped to the wrong brand.
      // loadDraft writes the draft's copy into composerText, which IS this
      // field — so the row the reader picked is now the text in the box.
      // Collapse the panel so they can see that rather than a list filtered
      // by the paragraph they just loaded.
      reviewQueue.loadDraft(item.id);
      setNotice(null);
      setError(null);
      setFocused(false);
      setPanel("queue");
      triggerCenter?.();
      inputRef.current?.blur();
    },
    [reviewQueue, router, lang, inputRef, triggerCenter],
  );

  /**
   * The button says what it is about to do, which is two questions at once:
   * where the post is going (the destination setting) and whether sending
   * also claims a queue draft.
   */
  const sendLabel =
    destination === "review"
      ? t.stageForReview
      : destination === "schedule"
        ? reviewQueue.activeDraftId
          ? t.approveScheduleAction
          : t.scheduleAction
        : reviewQueue.activeDraftId
          ? t.approveAction
          : t.publishDirectAction;

  /**
   * Stating the blocker beats a dead button with no explanation.
   */
  // ——— Asking for the copy instead of writing it ———
  //
  // The box could publish and it could search. It could not ask, which meant
  // the eight settings above it aimed nothing: brand and channels rode the
  // post, and Feature, Post, Media and the Draft knobs narrowed a list or
  // pointed at a lane this box had no way to reach. `requestSocialDraft`
  // answers inline in about eleven seconds on the free tier and falls back to
  // the Mac drain, so the ask is cheap and the settings finally have an
  // errand.
  //
  // Called directly rather than through the provider's `draftQueue.submit`,
  // deliberately. That one treats an ask as a REFINEMENT whenever the agent
  // window is holding an answered draft — so a composer ask would silently
  // file a turn against a thread the writer is not looking at. The box always
  // wants a root ask.
  const [askId, setAskId] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [askQueue, setAskQueue] = React.useState<{
    pendingAhead?: number;
    lastDrainAt?: string;
  } | null>(null);
  const [askStalled, setAskStalled] = React.useState(false);
  /**
   * An answer that arrived after the writer had already changed the field.
   *
   * The poll can run for minutes, and the field is the one thing on screen
   * someone might be editing the whole time. Overwriting it with a draft they
   * asked for ten minutes ago loses work they can never get back, so a late
   * answer waits here behind a press instead.
   */
  const [askReady, setAskReady] = React.useState<string | null>(null);
  /** The field as it stood when the ask was filed — what "unchanged" means. */
  const askedFrom = React.useRef("");

  const blockedReason = !trimmed
    ? t.blockedNoText
    : selectedChannels.length === 0
      ? t.blockedNoChannel
      : !transportsReady
        ? t.blockedTransport
        : // Caught here rather than at the server, which checks the same thing:
          // a past time is a typo, and finding out after the button by way of
          // an error is worse than a button that says why it is off.
          destination === "schedule" &&
            (!scheduleAt || new Date(scheduleAt).getTime() < Date.now() - 60_000)
          ? t.blockedSchedule
          : null;

  /**
   * One Send, two paths — chosen by where the copy came from, not by a control
   * the writer has to think about.
   *
   * A draft loaded from the queue must go through `approveDraft`, because
   * approving is also a claim: it moves the request `answered → consumed` in
   * the same transaction, which is what stops two reviewers publishing the
   * same post. Copy typed here answers to no queue entry, so there is nothing
   * to claim and `publishPostDirect` is the whole job.
   *
   * Routing on `activeDraftId` rather than on a mode flag means the wrong path
   * cannot be selected by mistake — the state that decides is the same state
   * that put the text on screen. Lifted verbatim from review-editor.tsx, which
   * is where this reasoning was paid for.
   */
  /**
   * File the ask: everything on screen, as a brief.
   *
   * The knobs ride as columns — the request has one each for angle, register,
   * reference and model — and the two settings with no column, Feature and
   * Post, ride as prose. That split is not tidiness: prose is the documented
   * input ("the brief is the whole input"), and pillars.json has carried this
   * exact kind of direction in its brief strings since the seed lane shipped.
   */
  const handleAsk = React.useCallback(
    async (given?: string) => {
    if (asking || askId) return;
    // A brief chosen from the plan goes as it is written. It already carries
    // its audience, CTA and constraint — appending "Shape: a caption beside
    // one image" to a sentence that has been rotated into the queue for
    // months would be the box second-guessing the plan.
    const brief = given ?? composeBrief({
      text: query,
      feature:
        feature === ANY_FEATURE ? null : featureLabel(product, feature, isRTL),
      postType,
      channels: selectedChannels.map((id) => {
        const channel = CHANNELS.find((c) => c.id === id);
        return channel ? (isRTL ? channel.labelAr : channel.label) : id;
      }),
      mediaCount: composerMediaUrls.length,
      style:
        imageStyle === ANY_STYLE ? null : styleLabel(imageStyle, isRTL),
    });
    if (!brief) {
      setError(t.askNoSubject);
      return;
    }

    setAsking(true);
    setError(null);
    setNotice(null);
    setAskReady(null);
    setAskStalled(false);
    setAskQueue(null);
    askedFrom.current = query;

    try {
      const res = await requestSocialDraft({
        product,
        brief,
        mediaUrls: composerMediaUrls,
        model: draftKnobs.model,
        ...(draftKnobs.angle ? { angle: draftKnobs.angle } : {}),
        ...(draftKnobs.register ? { register: draftKnobs.register } : {}),
        ...(draftKnobs.referenceId
          ? { referenceId: draftKnobs.referenceId }
          : {}),
      });
      if (!res.ok || !res.id) {
        setError(`${t.errorMsg}${res.error ?? ""}`);
        return;
      }
      // The poll takes it from here. Inline answers come back on the first
      // tick, which is why there is no separate "did it answer instantly"
      // path — one arrival, one place that handles it.
      setAskId(res.id);
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setAsking(false);
    }
  },
  [
    asking,
    askId,
    query,
    feature,
    product,
    isRTL,
    postType,
    selectedChannels,
    composerMediaUrls,
    imageStyle,
    draftKnobs.model,
    draftKnobs.angle,
    draftKnobs.register,
    draftKnobs.referenceId,
    t,
  ]);

  /**
   * The next turn of the same draft.
   *
   * `Write it` files a root ask every time, which meant a draft that came back
   * eighty percent right had two ways forward: retype it by hand, or walk to
   * the Draft stage and start over. Eighty percent right is the common case.
   *
   * Parented on `activeDraftId`, not on the ask this box happened to make —
   * and that is the whole reach of it. The same field is set by loading a
   * draft out of the Queue tab, and `refineSocialDraft` only asks that the
   * parent be `answered`, so a draft the drain wrote three days ago refines
   * here too.
   *
   * What does NOT ride a refine is a hand-edit: the writer is given the
   * PARENT's stored copy plus the instruction, so "make it shorter" shortens
   * what the queue holds, not what is currently in the field. Editing by hand
   * and asking for a change are two lanes, and mixing them would quietly throw
   * one of them away.
   */
  const handleRefine = React.useCallback(
    async (instruction: string) => {
      const parentId = reviewQueue.activeDraftId;
      if (!parentId || asking || askId) return;
      const said = instruction.trim();
      if (said.length < 3) return;

      setAsking(true);
      setError(null);
      setNotice(null);
      setAskReady(null);
      setAskStalled(false);
      setAskQueue(null);
      // The answer will land in a field that currently holds v1. Without this
      // the arrival guard compares against the ORIGINAL ask's text, decides
      // the writer has been editing, and holds every refinement behind a
      // press it does not need.
      askedFrom.current = query;

      try {
        const res = await refineSocialDraft({
          parentId,
          instruction: said,
          model: draftKnobs.model,
          ...(draftKnobs.angle ? { angle: draftKnobs.angle } : {}),
          ...(draftKnobs.register ? { register: draftKnobs.register } : {}),
        });
        if (!res.ok || !res.id) {
          setError(`${t.errorMsg}${res.error ?? ""}`);
          return;
        }
        // The child is an ordinary pending ask, so the poll below takes it
        // without knowing threads exist.
        setAskId(res.id);
      } catch (err: unknown) {
        setError(
          `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setAsking(false);
      }
    },
    [
      reviewQueue.activeDraftId,
      asking,
      askId,
      query,
      draftKnobs.model,
      draftKnobs.angle,
      draftKnobs.register,
      t,
    ],
  );

  /**
   * Wait for it. Same cadence as the agent window, for the same reasons: five
   * seconds while an answer could be seconds away, fifteen after the first
   * minute, and a hard stop at ten — the ask survives the stop (the drain
   * sweep expires it server-side after an hour), but polling forever made
   * "nobody is draining" look identical to "the app is broken".
   */
  React.useEffect(() => {
    if (!askId || askStalled) return;
    let cancelled = false;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      timer = setTimeout(
        tick,
        Date.now() - startedAt > 60_000 ? 15_000 : 5_000,
      );
    };

    const tick = async () => {
      const res = await readSocialDraft(askId).catch(() => null);
      if (cancelled) return;
      // A read that failed is not a verdict — the queue line keeps saying
      // whatever it last said, and the next tick asks again.
      if (!res?.ok) {
        schedule();
        return;
      }

      if (res.status === "pending") {
        setAskQueue({
          pendingAhead: res.pendingAhead,
          lastDrainAt: res.lastDrainAt,
        });
        if (Date.now() - startedAt > 10 * 60_000) {
          setAskStalled(true);
          return;
        }
        schedule();
        return;
      }

      setAskId(null);
      setAskQueue(null);

      if (res.status !== "answered") {
        // failed · dismissed · superseded — all of them mean no copy is
        // coming, and the note is the answerer's own words about why.
        setError(`${t.askFailed}${res.note ?? res.status}`);
        return;
      }

      const copy = res.ar || res.en || "";
      // activeDraftId FIRST, and before the refresh: it is what routes Send
      // through approveDraft, which claims the request answered → consumed.
      // Without it the copy would publish through publishPostDirect and leave
      // this same draft sitting in the queue for someone else to publish a
      // second time.
      reviewQueue.loadDraft(askId);
      if (query.trim() === askedFrom.current.trim()) {
        setQuery(copy);
        setNotice(t.askArrived);
      } else {
        setAskReady(copy);
      }
      // The drafting session may have picked the media half too. Only when the
      // writer has attached none — their pick outranks the queue's.
      if (composerMediaUrls.length === 0) {
        for (const url of res.mediaUrls ?? []) attachMedia(url);
      }
      void reviewQueue.refresh();
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `query` is read inside the tick to decide whether the field moved, and
    // re-running this effect on every keystroke would restart the poll clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askId, askStalled]);

  const askLane: AskLane = {
    run: () => void handleAsk(),
    busy: asking || Boolean(askId),
    waiting: Boolean(askId) && !asking,
    queue: askQueue,
    stalled: askStalled,
    // Restarting the window, not re-asking: the row is still there and still
    // pending, so a fresh ask would file a second one for the same brief.
    again: () => setAskStalled(false),
    ready: askReady,
    use: () => {
      if (!askReady) return;
      setQuery(askReady);
      setAskReady(null);
      setNotice(t.askArrived);
    },
    can: Boolean(
      trimmed || (feature !== ANY_FEATURE && brandFeatures.length > 0),
    ),
    runWith: (brief) => void handleAsk(brief),
    refine: (instruction) => void handleRefine(instruction),
    canRefine: Boolean(reviewQueue.activeDraftId),
  };

  const handleSend = React.useCallback(async () => {
    if (blockedReason || sending) return;
    setSending(true);
    setNotice(null);
    setError(null);
    setLinks(null);
    const payload = {
      product,
      text: query,
      channels: selectedChannels,
      mediaUrls: composerMediaUrls,
    };
    // The picker gives local wall-clock with no zone ("2026-08-25T18:00"). The
    // server does `new Date(...)` on whatever arrives, and Node reads a naive
    // string in the PROCESS's zone — UTC on Vercel — so sending it raw would
    // schedule 18:00 Khartoum as 18:00 UTC, three hours early. Resolved here,
    // where the browser's own zone is the right one to resolve it in.
    const at = scheduleAt ? new Date(scheduleAt).toISOString() : undefined;
    try {
      const draftId = reviewQueue.activeDraftId;
      let scheduled: { count: number; at: string } | null = null;
      let res: PostResult;

      if (destination === "review") {
        // The draft half of draft-or-direct. Nothing reaches a platform: this
        // mints a piece with `pending` variants and one single-use signed link
        // per channel, and an approver's press is what publishes.
        const staged = await stageForReview(payload);
        res = staged;
        if (staged.ok) {
          setNotice(staged.delivered ? t.stagedMsg : t.stagedLocalMsg);
          setLinks(staged.links ?? null);
        }
      } else if (draftId) {
        const approved = await approveDraft({
          draftId,
          mode: destination === "schedule" ? "schedule" : "now",
          ...payload,
          ...(destination === "schedule" ? { scheduledFor: at } : {}),
        });
        res = approved;
        if (destination === "schedule") {
          scheduled = {
            count: approved.count ?? 0,
            at: approved.at ? new Date(approved.at).toLocaleString() : "",
          };
        }
      } else if (destination === "schedule") {
        // Typed copy answers to no queue entry, so there is nothing to claim —
        // but it still has a time, and this is the action that takes one. It
        // used to fall into publishPostDirect below and go out immediately.
        const queued = await schedulePost({ ...payload, scheduledFor: at });
        res = queued;
        scheduled = {
          count: queued.count ?? 0,
          at: queued.at ? new Date(queued.at).toLocaleString() : "",
        };
      } else {
        res = await publishPostDirect(payload);
      }

      if (res.ok) {
        if (destination !== "review") {
          setNotice(
            scheduled ? fill(t.scheduledMsg, scheduled) : t.approvedNowMsg,
          );
        }
        reviewQueue.clearActive();
        void reviewQueue.refresh();
      } else {
        // A partial landing consumed the draft server-side, so the queue has
        // moved even though the send did not fully succeed — refresh either
        // way rather than leaving a consumed row on screen as pending work.
        const partial = Boolean(res.results?.some((r) => r.ok));
        setError(partial ? t.partialMsg : `${t.errorMsg}${res.error}`);
        if (partial) {
          reviewQueue.clearActive();
          void reviewQueue.refresh();
        }
      }
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSending(false);
    }
  }, [
    blockedReason,
    sending,
    scheduleAt,
    product,
    query,
    selectedChannels,
    composerMediaUrls,
    reviewQueue,
    destination,
    t,
  ]);

  // Cmd/Ctrl+K focuses rather than opens — the box is already on the page, so
  // there is nothing to summon. Cmd/Ctrl+1..4 switch modes, the same shortcuts
  // hogwarts prints on its category buttons. Both are ignored while the caret
  // is in another field so they cannot steal focus mid-sentence.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const modeIndex = ["1", "2", "3", "4"].indexOf(e.key);
      if (e.key !== "k" && modeIndex === -1) return;

      const el = e.target;
      const typingElsewhere =
        (el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLElement && el.isContentEditable)) &&
        el !== inputRef.current;
      if (typingElsewhere) return;

      e.preventDefault();
      if (modeIndex !== -1) {
        setMode(MODES[modeIndex].id);
        setFocused(true);
      }
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const emptyText = trimmed
    ? t.spotlightNoDrafts
    : scope === "every"
      ? t.spotlightEmptyEverywhere
      : mode === "scheduled"
        ? t.spotlightNoScheduled
        : mode === "published"
          ? t.spotlightNoPublished
          : t.spotlightQueueEmpty;

  return (
    <div
      className="mx-auto w-full max-w-3xl"
      onMouseEnter={() => triggerCenter?.()}
    >
      <CommandPrimitive
        {...shellProps}
        loop
        // cmdk filters by each item's `value`; ours is already filtered by the
        // Arabic-aware matcher, and cmdk's Latin-only scorer would then throw
        // half of it away again.
        shouldFilter={false}
        className={cn(GLASS, "overflow-hidden rounded-[28px]")}
      >
        {/* The line you see at rest: attach on one side, send on the other,
            and the writing between them. The magnifying glass that used to sit
            here described the smaller half of what this field does — it is the
            post now, and a post is written and sent, not looked up. Finding is
            still here, in the panel underneath. */}
        <div
          className={cn(SPOTLIGHT_BAR, "items-end py-1.5")}
          onMouseEnter={() => triggerCenter?.()}
        >
          {/* Opens the panel already under the bar, on its media face. A
              second floating layer over a panel that was open anyway is one
              surface too many. Pressing it again returns to the queue. */}
          <button
            type="button"
            aria-label={t.mediaLabel}
            title={t.mediaLabel}
            aria-expanded={open && panel === "media"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setPanel((current) =>
                open && current === "media" ? "queue" : "media",
              );
              setFocused(open && panel === "media" ? false : true);
              triggerCenter?.();
              inputRef.current?.focus();
            }}
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full mb-0.5",
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

          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (trimmed && !blockedReason && !sending) {
                  void handleSend();
                }
              }
            }}
            onFocus={() => {
              triggerCenter?.();
              // Don't auto-open dropdown if draft is loaded or user is editing text
              if (!reviewQueue.activeDraftId && !trimmed) {
                setFocused(true);
              }
            }}
            placeholder={t.spotlightPlaceholder}
            rows={1}
            className={cn(
              "flex w-full resize-none bg-transparent text-base outline-hidden leading-relaxed py-2.5",
              "placeholder:text-muted-foreground/70",
              "min-h-9 max-h-[280px] overflow-y-auto whitespace-pre-wrap break-words",
            )}
          />

          {/* Action buttons on the end */}
          <div className="flex items-center gap-1.5 mb-0.5">
            {trimmed ? (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (open && panel === "config") {
                      setFocused(false);
                    } else {
                      setPanel("config");
                      setFocused(true);
                      triggerCenter?.();
                    }
                  }}
                  title={t.spotlightConfig}
                  aria-label={t.spotlightConfig}
                  aria-expanded={open && panel === "config"}
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
                    "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors duration-150",
                    open && panel === "config" && "bg-accent text-accent-foreground",
                  )}
                >
                  <Settings className="size-5" />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    void handleSend();
                  }}
                  disabled={Boolean(blockedReason) || sending}
                  title={blockedReason ?? sendLabel}
                  aria-label={sendLabel}
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
                    "bg-clay text-clay-foreground transition-opacity duration-150",
                    "hover:opacity-90",
                    "disabled:cursor-not-allowed disabled:hover:opacity-100",
                  )}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPanel((current) =>
                    open && current === "config" ? "queue" : "config",
                  );
                  setFocused(true);
                  triggerCenter?.();
                  inputRef.current?.focus();
                }}
                title={t.spotlightConfig}
                aria-label={t.spotlightConfig}
                aria-expanded={open && panel === "config"}
                className={cn(
                  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
                  "bg-clay text-clay-foreground transition-opacity duration-150",
                  "hover:opacity-90",
                )}
              >
                <Settings className="size-5" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key="spotlight-dropdown"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.05 }}
              className="w-full overflow-hidden"
            >
              {panel === "config" ? (
                <ConfigPanel
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
                  destination={destination}
                  onDestination={setDestination}
                  scheduleAt={scheduleAt}
                  onScheduleAt={setScheduleAt}
                  ask={askLane}
                  postType={postType}
                  onPostType={setPostType}
                  mediaFilter={mediaFilter}
                  onMediaFilter={setMediaFilter}
                  mediaType={mediaType}
                  onMediaType={setMediaType}
                  imageStyle={imageStyle}
                  onImageStyle={setImageStyle}
                  drafts={brandDrafts.map((d) => ({
                    id: d.id,
                    text: d.text,
                    when: d.when,
                  }))}
                  ago={ageLabel}
                  onUseDraft={(id) => {
                    reviewQueue.loadDraft(id);
                    setPanel("queue");
                    setNotice(null);
                    setError(null);
                    setFocused(false);
                    inputRef.current?.blur();
                  }}
                  onOpenDialog={setConfigFocus}
                  openSection={configFocus}
                  onCloseSection={() => {
                    setConfigFocus(null);
                    inputRef.current?.focus();
                  }}
                />
              ) : panel === "media" ? (
                <MediaPanel
                  t={t}
                  urls={composerMediaUrls}
                  brandMedia={brandMedia}
                  postType={postType}
                  mediaFilter={mediaFilter}
                  mediaType={mediaType}
                  onAttach={attachMedia}
                  onRemove={removeMedia}
                  onBrowse={() => goToStage("media")}
                />
              ) : (
                <>
                {/* The split icons — a second row that arrives WITH the dropdown
                  rather than standing under the input all day. At rest this box
                  is one search line: the list it filters is not on screen yet,
                  so neither is the filtering. Inside the reveal, not beside it,
                  so one spring carries the whole panel. */}
                <div className="flex items-center gap-1 border-t border-black/5 px-2 py-2 dark:border-white/10">
                  {MODES.map((entry, i) => {
                    const Icon = entry.icon;
                    const active = mode === entry.id;
                    const count = counts[entry.id];
                    return (
                      <motion.button
                        key={entry.id}
                        type="button"
                        data-active={active}
                        title={`${t[entry.labelKey]} (${entry.shortcut})`}
                        aria-pressed={active}
                        initial={{ opacity: 0, x: isRTL ? 20 : -20, scale: 0.6 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{
                          type: "spring",
                          duration: 0.4,
                          bounce: 0.2,
                          delay: i * 0.04,
                        }}
                        // Keep the caret in the input — switching mode is a filter, not
                        // a departure from what you were typing.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setMode(entry.id);
                          setFocused(true);
                          inputRef.current?.focus();
                        }}
                        className={cn(
                          "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5",
                          "text-xs font-medium transition-colors duration-150",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="hidden sm:inline">
                          {t[entry.labelKey]}
                        </span>
                        {count > 0 && (
                          <span
                            dir="ltr"
                            className={cn(
                              "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                              active
                                ? "bg-background/60"
                                : "bg-muted-foreground/10 text-muted-foreground",
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}

                  <div className="ms-auto flex items-center gap-1">
                    <button
                      type="button"
                      title={t.spotlightRefresh}
                      aria-label={t.spotlightRefresh}
                      disabled={reviewQueue.loading}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void reviewQueue.refresh()}
                      className="text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn(
                          "size-4",
                          reviewQueue.loading && "animate-spin",
                        )}
                      />
                    </button>

                    {/* The filter menu — the knobs that are a preference rather than a
                    slice: which brands, which order, and whether a row has to
                    carry media at all. */}
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                      <DropdownMenuTrigger
                        title={t.spotlightFilters}
                        aria-label={t.spotlightFilters}
                        onMouseDown={(e) => e.preventDefault()}
                        className={cn(
                          "flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150",
                          menuOpen || scope === "every" || mediaOnly
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
                        )}
                      >
                        <SlidersHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align={isRTL ? "start" : "end"}
                        className="w-56"
                        // Returning focus would fight the deferred blur above; the
                        // input is refocused explicitly instead.
                        onCloseAutoFocus={(e) => {
                          e.preventDefault();
                          inputRef.current?.focus();
                        }}
                      >
                        <DropdownMenuLabel>{t.spotlightScope}</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={scope}
                          onValueChange={(value) => setScope(value as Scope)}
                        >
                          <DropdownMenuRadioItem value="brand">
                            {fill(t.spotlightScopeThis, {
                              brand: brandLabel(product),
                            })}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="every">
                            {t.spotlightScopeAll}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel>{t.spotlightOrder}</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={order}
                          onValueChange={(value) => setOrder(value as Order)}
                        >
                          <DropdownMenuRadioItem value="oldest">
                            {t.spotlightOrderOldest}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="newest">
                            {t.spotlightOrderNewest}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuCheckboxItem
                          checked={mediaOnly}
                          onCheckedChange={(checked) =>
                            setMediaOnly(Boolean(checked))
                          }
                        >
                          {t.spotlightMediaOnly}
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* The config face's other door. The trailing button in
                        the line above is the same door while the field is
                        empty; once there is copy to send, that button has a
                        more urgent job and this one is how you still get
                        back here. */}
                    <button
                      type="button"
                      aria-label={t.spotlightConfig}
                      title={t.spotlightConfig}
                      // This row only renders on the queue face, so pressing
                      // it is always a move TO config, never a toggle back.
                      aria-expanded={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPanel("config");
                        setFocused(true);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        "flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150",
                        destination !== "direct"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
                      )}
                    >
                      <Settings2 className="size-4" />
                    </button>
                  
                  </div>
                </div>

                <CommandPrimitive.List
                  className={cn(
                    SPOTLIGHT_PANEL,
                    "scroll-py-1 overflow-x-hidden p-2",
                  )}
                >
                  {/* FIND — this brand's slice first, because the picker above
                      already says which brand the reader is working in. */}
                  <ItemGroup
                    items={mine}
                    grouped={mode === "all"}
                    t={t}
                    lang={lang}
                    brandLabel={brandLabel}
                    channelLabel={channelLabel}
                    onSelect={handleSelect}
                  />

                  {/* Other brands — labelled, because opening one silently
                      retargets the whole page. */}
                  {others.length > 0 && (
                    <>
                      <p className="text-muted-foreground/50 px-3 pt-2 pb-1 text-[11px]">
                        {t.spotlightOtherBrands}
                      </p>
                      <ItemGroup
                        items={others}
                        grouped={mode === "all"}
                        t={t}
                        lang={lang}
                        brandLabel={brandLabel}
                        channelLabel={channelLabel}
                        onSelect={handleSelect}
                      />
                    </>
                  )}

                  {mine.length === 0 && others.length === 0 && (
                    <p className="text-muted-foreground/60 px-3 py-4 text-center text-xs">
                      {emptyText}
                    </p>
                  )}
                </CommandPrimitive.List>

                <Footer t={t} />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CommandPrimitive>

      {/* What the send did. Under the box, because the box collapses and a
          notice inside it would vanish with the panel that carried it. */}
      {links && links.length > 0 && (
        <ul className="border-input mt-3 space-y-1 rounded-lg border p-3 text-sm">
          <li className="text-muted-foreground pb-1 text-xs font-medium">
            {t.reviewLinksTitle}
          </li>
          {links.map((link) => (
            <li key={link.channel} className="flex items-center gap-2">
              <span className="text-muted-foreground w-24 shrink-0 text-xs">
                {link.channel}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="truncate font-mono text-xs underline underline-offset-4"
              >
                {link.url}
              </a>
            </li>
          ))}
        </ul>
      )}

      {(notice || error) && (
        <p
          role={error ? "alert" : "status"}
          className={cn(
            "mt-3 rounded-lg px-3 py-2 text-sm",
            error
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-500"
              : "text-muted-foreground",
          )}
        >
          {error ?? notice}
        </p>
      )}
    </div>
  );
}

/**
 * The panel's third face — what the post IS, before what it says.
 *
 * Two levels, not one long form. The first is boxes: Brand · Channels ·
 * Timing, each carrying the answer it currently holds, so the face reads as a
 * summary of the post's settings before it is a way to change them. Opening
 * one puts its choices in the middle of the same panel, with a way back.
 *
 * These three decide where the copy lands and when, and they were scattered
 * across the page header, a popover and a shell select — a writer changing
 * brand had to leave the box they were writing in. Approve-mode lives here
 * rather than behind its own popover because a portal over a raised column is
 * a stacking fight nobody wins: measured, the popover opened underneath the
 * queue rows.
 */
type ConfigSection =
  | "brand"
  | "feature"
  | "channels"
  | "postType"
  | "draft"
  | "media"
  | "destination"
  | "queue";

export function ConfigPanel({
  words: wordSubset,
  extra,
  t,
  isRTL,
  product,
  onProduct,
  wired,
  selected,
  onChannels,
  feature,
  onFeature,
  features,
  destination,
  onDestination,
  scheduleAt,
  onScheduleAt,
  ask,
  postType,
  onPostType,
  mediaFilter,
  onMediaFilter,
  mediaType,
  onMediaType,
  imageStyle,
  onImageStyle,
  drafts,
  onUseDraft,
  ago,
  onOpenDialog,
  openSection,
  onCloseSection,
}: {
  t: SocialDict;
  isRTL: boolean;
  product: string;
  onProduct: (id: ProductId) => void;
  wired: ChannelId[];
  selected: ChannelId[];
  onChannels: (next: ChannelId[]) => void;
  feature: string;
  onFeature: (next: string) => void;
  features: BrandFeature[];
  destination?: Destination;
  onDestination?: (next: Destination) => void;
  scheduleAt?: string;
  onScheduleAt?: (next: string) => void;
  ask?: AskLane;
  postType: PostType;
  onPostType: (next: PostType) => void;
  mediaFilter: MediaFilter;
  onMediaFilter: (next: MediaFilter) => void;
  mediaType: string;
  onMediaType: (next: string) => void;
  imageStyle: string;
  onImageStyle: (next: string) => void;
  /** This brand's drafts awaiting review, oldest first. */
  drafts?: { id: string; text: string; when: string }[];
  onUseDraft?: (id: string) => void;
  /** Relative age, formatted by the parent so one clock serves both faces. */
  ago?: (iso: string) => string;
  onOpenDialog: (section: ConfigSection) => void;
  /** Which box is open, and how to shut it. Held by the parent so Escape
   *  can be given to this card before it reaches the box underneath. */
  openSection: ConfigSection | null;
  onCloseSection: () => void;
  /**
   * Which words this stage shows, in this order. Publish shows all of them;
   * Draft and Media show the ones that mean something where they are — a
   * stage that cannot send has no business offering Timing, and a stage that
   * only finds pictures has no post shape to pick.
   */
  words?: ConfigSection[];
  /**
   * A face this stage owns and the others do not, keyed by a word of its own.
   * Draft's writing knobs are the only one today: they belong to that stage
   * alone, and passing them in beats teaching this panel about them.
   */
  extra?: { id: string; label: string; node: React.ReactNode }[];
}) {

  const brandName = (() => {
    const p = PRODUCTS.find((entry) => entry.id === product);
    return p ? (isRTL ? p.labelAr : p.label) : product;
  })();

  const channelName = (id: ChannelId) => {
    const c = CHANNELS.find((entry) => entry.id === id);
    return c ? (isRTL ? c.labelAr : c.label) : id;
  };

  const mediaName: Record<MediaFilter, string> = {
    any: t.mediaAny,
    image: t.mediaImage,
    video: t.mediaVideo,
  };

  const destinationName: Record<Destination, string> = {
    direct: t.destinationDirect,
    schedule: t.destinationSchedule,
    review: t.destinationReview,
  };

  const destinationHint: Record<Destination, string> = {
    direct: t.destinationDirectHint,
    schedule: t.destinationScheduleHint,
    review: t.destinationReviewHint,
  };

  const toggle = (id: ChannelId) =>
    onChannels(
      selected.includes(id)
        ? selected.filter((c) => c !== id)
        : [...selected, id],
    );

  const shell =
    cn(SPOTLIGHT_PANEL, "p-4 text-start");

  const pill = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
      on
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
    );

  // The order a post gets made in: whose it is, what it is about, where it
  // goes, what shape it takes, how it gets written, what pictures ride with
  // it — then what is already waiting, and last, what pressing the arrow does.
  const ALL_WORDS: { id: ConfigSection; label: string }[] = [
    { id: "brand", label: t.spotlightConfigBrand },
    { id: "feature", label: t.spotlightConfigFeature },
    { id: "channels", label: t.spotlightConfigChannels },
    { id: "postType", label: t.spotlightConfigPostType },
    { id: "draft", label: t.spotlightConfigDraft },
    { id: "media", label: t.spotlightConfigMedia },
    { id: "queue", label: t.spotlightConfigQueue },
    { id: "destination", label: t.spotlightConfigTiming },
  ];
  // A stage's own subset, in its own order, plus any face it owns alone.
  const WORDS: { id: string; label: string }[] = [
    ...(wordSubset
      ? wordSubset
          .map((id) => ALL_WORDS.find((w) => w.id === id))
          .filter((w): w is { id: ConfigSection; label: string } => Boolean(w))
      : ALL_WORDS),
    ...(extra ?? []).map((e) => ({ id: e.id, label: e.label })),
  ];
  const extraFace = extra?.find((e) => e.id === openSection);

  return (
    <div className={shell}>
      {/* Six words, and the one you press opens under it.
          
          They were boxes carrying their own values, and pressing one opened a
          card floating over the panel. Two things wrong with that: the card
          covered the rows it was launched from, and the value on every box
          made a settings summary out of a row that is really a nav. A word,
          then its choices, in the space below — nothing is hidden while you
          choose, and pressing the same word again shuts it. */}
      <div className="-mx-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        {WORDS.map((word) => {
          const active = openSection === word.id;
          return (
            <button
              key={word.id}
              type="button"
              aria-pressed={active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                active ? onCloseSection() : onOpenDialog(word.id as ConfigSection)
              }
              className={cn(
                "cursor-pointer py-1 text-sm transition-colors duration-150",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              {word.label}
            </button>
          );
        })}
      </div>

      {openSection && (
        <div className="border-t border-black/5 pt-3 pb-1 dark:border-white/10">
          {extraFace ? extraFace.node : <ConfigChoices
            section={openSection}
            t={t}
            isRTL={isRTL}
            product={product}
            onProduct={onProduct}
            wired={wired}
            selected={selected}
            onChannels={onChannels}
            feature={feature}
            onFeature={onFeature}
            features={features}
            postType={postType}
            onPostType={onPostType}
            mediaFilter={mediaFilter}
            onMediaFilter={onMediaFilter}
            mediaType={mediaType}
            onMediaType={onMediaType}
            imageStyle={imageStyle}
            onImageStyle={onImageStyle}
            destination={destination}
            onDestination={onDestination}
            scheduleAt={scheduleAt}
            onScheduleAt={onScheduleAt}
            ask={ask}
            drafts={drafts}
            onUseDraft={onUseDraft}
            ago={ago}
          />}
        </div>
      )}

    </div>
  );
}

/**
 * A post's shape, drawn as the post itself.
 *
 * Not an abstract diagram: a feed card with an avatar, a name, the copy, the
 * media and an action bar, because that is the thing being chosen and a
 * reader recognises it before reading a word. The 9:16 surfaces drop the feed
 * chrome — a story has no byline row above it — and the swipe frame lets the
 * next card peek in at the edge, which is the only thing that tells a carousel
 * apart from a single image at this size.
 */
function PostShape({
  meta,
  avatar,
  invertAvatar,
  pageName,
  when,
  selected,
  label,
}: {
  meta: PostTypeMeta;
  /** The current brand's mark — a Page's profile picture is its logo. */
  avatar?: string;
  invertAvatar?: boolean;
  /** What the Page calls itself, shown where Facebook shows it. */
  pageName?: string;
  /** The byline's second line — when this will appear, per the Send setting. */
  when?: string;
  selected?: boolean;
  /** The shape's name, shown on the chosen card. */
  label?: string;
}) {
  // Facebook's own furniture: a white card on a grey ground, with the
  // placeholder grey it uses for anything not yet loaded. Tokens rather than
  // the literal hexes, so the card follows the theme instead of staying white
  // in the dark.
  const surface = "bg-card";
  const skin = "bg-muted-foreground/20";
  const line = "bg-muted-foreground/20 h-1.5 rounded-full";
  const tall = meta.frame === "tall";

  return (
    <div
      aria-hidden
      className={cn(
        surface,
        "relative flex h-44 w-full flex-col gap-2 rounded-lg p-2.5 shadow-sm",
      )}
    >
      {/* Chosen is marked INSIDE the post, the way a picked photo is. A ring
          or a shadow frames the card from outside and makes the other eight
          look switched off; a radio underneath sits in space the strip does
          not have. This costs nothing but a corner — the bottom one, where
          the byline and the media are not.

          Foreground rather than clay: the avatar in every card is already
          clay, so a clay mark read as more of the brand instead of a state,
          and it followed the theme's ink either way. */}
      {selected && (
        // The name, not a tick. A check says "chosen" to someone who already
        // knows what they chose; the label says which of the nine it was, and
        // it is the only place the names appear now that the captions are
        // gone. Same corner, same ink.
        <span className="bg-foreground text-background absolute end-2 bottom-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-full px-2.5 py-1 text-[11px] leading-tight font-medium">
          {label}
        </span>
      )}
      {/* The byline. Every feed post has one; a full-bleed vertical surface
          does not, so the tall frames spend that room on the media. */}
      {!tall && (
        <div className="flex items-center gap-1.5">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className={cn(
                "size-6 shrink-0 rounded-full",
                // A Page picture fills its circle the way Facebook crops it;
                // a bare mark is padded so it does not touch the edge.
                invertAvatar
                  ? "bg-muted object-contain p-0.5 dark:invert"
                  : "object-cover",
              )}
            />
          ) : (
            <span className={cn(skin, "size-6 shrink-0 rounded-full")} />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {/* The Page's name, not a placeholder for one — it is known, and
                a bar where a name belongs is a skeleton pretending to load
                something that is already here. The timestamp stays a bar:
                when this posts is the Send setting's answer, not ours. */}
            {pageName ? (
              <span className="text-foreground/70 truncate text-start text-[9px] leading-none font-semibold">
                {pageName}
              </span>
            ) : (
              <span className={cn(line, "w-2/3")} />
            )}
            {/* Where Facebook prints the time and the audience. It is known
                too — the Send setting decides when this appears — so a grey
                bar here was a placeholder for an answer already given. */}
            {when ? (
              <span className="text-muted-foreground/70 truncate text-start text-[8px] leading-none">
                {when}
              </span>
            ) : (
              <span className={cn(line, "h-1 w-1/3")} />
            )}
          </span>
        </div>
      )}

      {meta.text && !tall && (
        <div className="flex flex-col gap-1">
          <span className={cn(line, "w-full")} />
          <span className={cn(line, "w-4/5")} />
          {meta.kind === "none" && (
            <>
              <span className={cn(line, "w-full")} />
              <span className={cn(line, "w-3/5")} />
            </>
          )}
        </div>
      )}

      {meta.kind !== "none" && (
        <div className="relative flex min-h-0 flex-1 gap-1">
          {meta.count === "many" && meta.frame !== "swipe" ? (
            <div className="grid h-full w-full grid-cols-2 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn(skin, "h-full w-full rounded-sm")} />
              ))}
            </div>
          ) : (
            <>
              <span
                className={cn(
                  skin,
                  "flex h-full items-center justify-center rounded-md",
                  // The swipe frame leaves a sliver for the next card.
                  meta.frame === "swipe" ? "w-4/5" : "w-full",
                )}
              >
                {meta.kind === "video" && (
                  <span className="border-s-card h-0 w-0 border-y-[7px] border-s-[12px] border-y-transparent rtl:rotate-180" />
                )}
              </span>
              {meta.frame === "swipe" && (
                <span className={cn(skin, "h-full flex-1 rounded-s-md")} />
              )}
            </>
          )}
        </div>
      )}

      {/* Copy under the media is where a reel or a caption-last post puts it. */}
      {meta.text && tall && <span className={cn(line, "w-3/4")} />}

    </div>
  );
}

/**
 * The choices for whichever word is open, rendered under it.
 *
 * One shape for all six, because they all answer the same question — which of
 * these — and five layouts would be five things to learn. Pills wrap, so a
 * dozen features need no grid maths and no card to be measured and clamped;
 * the row simply grows and the panel scrolls if it must.
 *
 * Send is the exception, and earns it: its three answers change what pressing
 * the arrow DOES, so each carries the sentence that says so.
 */
/**
 * Drag a horizontal strip with the pointer.
 *
 * A finger and a trackpad can already flick an overflow row; a mouse cannot —
 * it gets a scrollbar, and the scrollbar is the thing being hidden. So the
 * strip itself becomes the handle.
 *
 * A CALLBACK ref, not an effect on a ref object. The row only exists while its
 * word is open, so an effect with an empty dependency list runs once against a
 * node that is not there yet and never attaches — measured: the strip sat at
 * scrollLeft 4 through a ten-step drag. A callback ref fires on every mount
 * and unmount, which is exactly when the listener should come and go.
 *
 * `dragging` is reported back so the caller can switch the cursor, suspend
 * scroll-snap (mandatory snapping corrects every scrollLeft this sets, which
 * pins the strip in place), and make the cards inert mid-drag — without that
 * last one, releasing after a swipe lands as a click and silently changes the
 * setting.
 */
function useDragScroll(): {
  ref: (node: HTMLElement | null) => void;
  dragging: boolean;
} {
  const [dragging, setDragging] = React.useState(false);
  const cleanup = React.useRef<(() => void) | null>(null);

  const ref = React.useCallback((node: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!node) return;

    const from = { x: 0, left: 0, moved: false };
    const down = (e: PointerEvent) => {
      // Primary button only, and never a touch — a finger already scrolls,
      // and hijacking it would fight the platform's own momentum.
      if (e.pointerType === "touch" || e.button !== 0) return;
      from.x = e.clientX;
      from.left = node.scrollLeft;
      from.moved = false;

      const move = (m: PointerEvent) => {
        const dx = m.clientX - from.x;
        // A few pixels of slop, so a press that wobbles is still a press.
        if (!from.moved && Math.abs(dx) < 4) return;
        from.moved = true;
        setDragging(true);
        node.scrollLeft = from.left - dx;
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        // Released on the next frame: a click fires after pointerup, and the
        // cards must still be inert when it does.
        requestAnimationFrame(() => setDragging(false));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

    /**
     * A vertical wheel moves the strip sideways.
     *
     * A trackpad can send deltaX; a mouse cannot, so without this a mouse has
     * no way to reach the ninth card except by dragging. Only taken when the
     * strip actually has room in that direction — at either end the event goes
     * back to the page, so the strip never traps a scroll.
     */
    const wheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return; // the platform is already doing it
      const room =
        e.deltaY < 0
          ? node.scrollLeft > 0
          : node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
      if (!room) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };

    node.addEventListener("pointerdown", down);
    node.addEventListener("wheel", wheel, { passive: false });
    cleanup.current = () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("wheel", wheel);
    };
  }, []);

  return { ref, dragging };
}

/**
 * One media format, drawn at its own ratio — the post cards' pattern, applied
 * to a smaller question.
 *
 * Same card surface, same size, same ink check in the same corner. The post
 * strip taught the shape; a second strip that answered differently would make
 * a reader learn it twice.
 *
 * The taxonomy records what each type renders at — 16:9 for a hero, 9:16 for
 * a story, 1200x630 for an OG image — so the block inside IS that shape rather
 * than describing it. Types with no recorded ratio get a neutral square: an
 * invented ratio would be a claim about how they render that nothing backs.
 */
/**
 * What a visual register looks like, sketched edge to edge.
 *
 * Every card is the same square and every sketch bleeds to its corners — a
 * style is a treatment of the whole frame, so a drawing floating in the middle
 * of a white plate would be describing the opposite of the thing.
 *
 * Monochrome plus the house clay. These are registers, not palettes: showing
 * "Bold" in red and "Luxury" in gold would be inventing brand colours the kit
 * does not have, and the brands each bring their own.
 */
function StyleSketch({ id }: { id: string }) {
  const wash = "bg-muted-foreground/15";
  const mid = "bg-muted-foreground/30";
  const ink = "bg-muted-foreground/55";

  switch (id) {
    case "corporate":
      // Order: a rule, a column, room. Nothing raises its voice.
      return (
        <span className="bg-card absolute inset-0 p-4">
          <span className={cn(ink, "absolute inset-x-4 top-5 h-1 rounded-full")} />
          <span className={cn(mid, "absolute start-4 top-9 h-1 w-1/2 rounded-full")} />
          <span className={cn(wash, "absolute inset-x-4 bottom-4 h-14 rounded")} />
        </span>
      );

    case "modern":
      // One clean geometric gesture over a soft field.
      return (
        <span className="from-muted-foreground/25 to-muted-foreground/5 absolute inset-0 bg-gradient-to-br">
          <span className="border-muted-foreground/50 absolute end-5 bottom-5 size-16 rounded-full border-2" />
        </span>
      );

    case "minimalist":
      // Almost nothing, placed exactly.
      return (
        <span className="bg-card absolute inset-0">
          <span className={cn(ink, "absolute start-6 top-6 size-3 rounded-sm")} />
          <span className={cn(wash, "absolute end-6 bottom-6 h-1 w-10 rounded-full")} />
        </span>
      );

    case "bold":
      // Type as the picture: one word filling the frame.
      return (
        <span className="bg-foreground absolute inset-0 flex flex-col justify-center gap-2 p-4">
          <span className="bg-background h-5 w-4/5 rounded-sm" />
          <span className="bg-background/70 h-5 w-3/5 rounded-sm" />
        </span>
      );

    case "luxury":
      // Dark, quiet, one hairline and a lot of space.
      return (
        <span className="bg-foreground absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="bg-background/80 h-px w-16" />
          <span className="bg-background/90 size-6 rounded-full" />
          <span className="bg-background/80 h-px w-16" />
        </span>
      );

    case "creative":
      // Shapes that overlap and lean.
      return (
        <span className="bg-card absolute inset-0">
          <span className={cn(mid, "absolute start-5 top-7 size-16 rotate-12 rounded-lg")} />
          <span className={cn(ink, "absolute end-6 bottom-8 size-12 -rotate-6 rounded-full opacity-80")} />
          <span className={cn(wash, "absolute end-10 top-6 size-8 rotate-45")} />
        </span>
      );

    case "playful":
      // Scattered, round, unserious.
      return (
        <span className="bg-card absolute inset-0">
          {[
            "start-5 top-6 size-7",
            "end-6 top-10 size-4",
            "start-12 bottom-7 size-9",
            "end-8 bottom-6 size-6",
            "start-6 top-20 size-3",
          ].map((pos, i) => (
            <span
              key={i}
              className={cn(
                i % 2 ? mid : ink,
                "absolute rounded-full",
                pos,
              )}
            />
          ))}
        </span>
      );

    case "editorial":
      // A magazine page: headline, deck, columns.
      return (
        <span className="bg-card absolute inset-0 p-4">
          <span className={cn(ink, "absolute inset-x-4 top-4 h-3 rounded-sm")} />
          <span className={cn(mid, "absolute start-4 top-9 h-1.5 w-2/3 rounded-full")} />
          <span className="absolute inset-x-4 bottom-4 flex h-16 gap-2">
            <span className="flex flex-1 flex-col gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn(wash, "h-1 rounded-full")} />
              ))}
            </span>
            <span className={cn(mid, "w-1/2 rounded")} />
          </span>
        </span>
      );

    case "cinematic":
      // Letterboxed, graded, a figure lit from one side.
      return (
        <span className="from-muted-foreground/50 to-muted-foreground/10 absolute inset-0 bg-gradient-to-tr">
          <span className="bg-foreground absolute inset-x-0 top-0 h-5" />
          <span className="bg-foreground absolute inset-x-0 bottom-0 h-5" />
          <span className={cn(ink, "absolute bottom-8 start-8 h-14 w-6 rounded-t-full")} />
        </span>
      );

    case "retro":
      // Sun bands.
      return (
        <span className="bg-card absolute inset-0 flex flex-col justify-end gap-1.5 p-4">
          <span className="bg-clay/70 absolute end-6 top-6 size-12 rounded-full" />
          {[0.9, 0.7, 0.5, 0.3].map((o, i) => (
            <span
              key={i}
              className="bg-clay h-2.5 w-full rounded-full"
              style={{ opacity: o }}
            />
          ))}
        </span>
      );

    case "futuristic":
      // A grid, and something glowing on it.
      return (
        <span className="bg-foreground absolute inset-0 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={`h${i}`}
              className="bg-background/20 absolute inset-x-0 h-px"
              style={{ top: `${20 + i * 20}%` }}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <span
              key={`v${i}`}
              className="bg-background/20 absolute inset-y-0 w-px"
              style={{ left: `${20 + i * 20}%` }}
            />
          ))}
          <span className="bg-clay absolute start-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </span>
      );

    case "threeD":
      // An isometric solid, drawn as its three faces.
      return (
        <span className="bg-card absolute inset-0 flex items-center justify-center">
          <span className="relative h-20 w-20">
            <span className={cn(ink, "absolute inset-x-0 top-0 h-10 [clip-path:polygon(50%_0,100%_25%,50%_50%,0_25%)]")} />
            <span className={cn(mid, "absolute start-0 top-[25%] h-14 w-1/2 [clip-path:polygon(0_0,100%_50%,100%_100%,0_50%)]")} />
            <span className={cn(wash, "absolute end-0 top-[25%] h-14 w-1/2 [clip-path:polygon(100%_0,100%_50%,0_100%,0_50%)]")} />
          </span>
        </span>
      );

    case "illustration":
      // Drawn, not photographed: outlines and flat fills.
      return (
        <span className="bg-card absolute inset-0">
          <span className="border-muted-foreground/50 absolute start-6 bottom-8 size-12 rounded-full border-2" />
          <span className={cn(mid, "absolute end-7 bottom-8 h-16 w-10 rounded-t-full")} />
          <span className="bg-muted-foreground/50 absolute inset-x-5 bottom-6 h-0.5 rounded-full" />
          <span className="border-muted-foreground/40 absolute end-8 top-6 size-6 rotate-45 border-2" />
        </span>
      );

    case "abstract":
      // Overlapping organic fields, no subject at all.
      return (
        <span className="bg-card absolute inset-0 overflow-hidden">
          <span className={cn(mid, "absolute -start-4 top-4 size-24 rounded-full")} />
          <span className={cn(ink, "absolute end-2 bottom-2 size-20 rounded-[45%] opacity-70")} />
          <span className={cn(wash, "absolute start-10 bottom-6 size-16 rounded-[60%_40%]")} />
        </span>
      );

    case "ugc":
      // A snapshot: off-square, hand-held, a caption bar.
      return (
        <span className={cn(wash, "absolute inset-0 flex items-center justify-center")}>
          <span className="bg-card w-24 rotate-[-4deg] p-1.5 shadow-sm">
            <span className={cn(mid, "block h-16 w-full rounded-sm")} />
            <span className={cn(wash, "mt-1.5 block h-1 w-2/3 rounded-full")} />
          </span>
        </span>
      );

    case "product":
      // One object, lit, on a plinth with its own shadow.
      return (
        <span className="from-muted-foreground/20 to-card absolute inset-0 bg-gradient-to-b">
          <span className={cn(ink, "absolute start-1/2 top-10 size-16 -translate-x-1/2 rounded-2xl")} />
          <span className={cn(mid, "absolute start-1/2 bottom-9 h-1.5 w-20 -translate-x-1/2 rounded-full opacity-60")} />
          <span className="bg-muted-foreground/20 absolute inset-x-0 bottom-0 h-8" />
        </span>
      );

    default:
      // "Any", and any register added before this switch is.
      return <span className="bg-card absolute inset-0" />;
  }
}

/**
 * One visual register, as a card that is entirely its own sketch.
 *
 * Edge to edge: a style is a treatment of the whole frame, so the drawing goes
 * to the corners and the name sits on it rather than under it — the same ink
 * pill the chosen post shape wears, for the same reason.
 */
function StyleCard({
  id,
  label,
  on,
  inert,
  onPick,
}: {
  id: string;
  label: string;
  on: boolean;
  inert: boolean;
  onPick: () => void;
}) {
  const SIZE = 150;

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      style={{ width: SIZE, height: SIZE }}
      className={cn(
        "relative shrink-0 snap-start overflow-hidden rounded-lg shadow-sm",
        "transition-opacity duration-150",
        inert ? "pointer-events-none" : "cursor-pointer",
        on ? "opacity-100" : "opacity-90 hover:opacity-100",
      )}
    >
      <StyleSketch id={id} />
      <span
        className={cn(
          "absolute end-2 bottom-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-full",
          "px-2.5 py-1 text-[11px] leading-tight font-medium",
          on
            ? "bg-foreground text-background"
            : "bg-card/85 text-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * The ask, bundled — nine props for one errand would bury the eight settings
 * they sit under.
 */
interface AskLane {
  /** File it. */
  run: () => void;
  /** Filing, or waiting on an answer. */
  busy: boolean;
  /** Waiting specifically — the queue line has something to say. */
  waiting: boolean;
  queue: { pendingAhead?: number; lastDrainAt?: string } | null;
  /** Ten minutes gone. The ask is still saved; this window stopped looking. */
  stalled: boolean;
  again: () => void;
  /** An answer that arrived after the field had moved on. */
  ready: string | null;
  use: () => void;
  /** Is there a subject to write about at all. */
  can: boolean;
  /** Ask with a brief the writer picked rather than typed. */
  runWith: (brief: string) => void;
  /** File the next turn of the draft that is currently in the field. */
  refine: (instruction: string) => void;
  /** Is there a draft to refine — an ask that answered, or one loaded from the queue. */
  canRefine: boolean;
}

/**
 * A Date as `<input type="datetime-local">` wants it: local wall-clock, no
 * zone. `toISOString()` would be the instant in UTC, which the picker reads as
 * a wall-clock time and shows shifted by the reader's offset.
 */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The times anyone actually picks, so the common answers cost one press
 * instead of a date picker. The exact one stays available beside them — these
 * are shortcuts into the same field, not a second way of answering.
 */
const QUICK_TIMES = [
  {
    id: "hour",
    key: "scheduleInHour" as const,
    at: () => toLocalInput(new Date(Date.now() + 60 * 60_000)),
  },
  {
    id: "evening",
    key: "scheduleThisEvening" as const,
    at: () => {
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      // Past eight already — the reader means tomorrow evening.
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return toLocalInput(d);
    },
  },
  {
    id: "morning",
    key: "scheduleTomorrow" as const,
    at: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return toLocalInput(d);
    },
  },
] as const;

/**
 * "What should change?" — one line, and the press that files it.
 *
 * Local state on purpose. The instruction is spent the moment it is sent: it
 * rides the turn as a column and the next turn wants a new one, so keeping it
 * in the provider would mean carrying a sentence nobody will use again across
 * every stage in the Hub.
 */
function RefineRow({
  t,
  onRefine,
  busy,
}: {
  t: SocialDict;
  onRefine: (instruction: string) => void;
  busy: boolean;
}) {
  const [said, setSaid] = React.useState("");
  const ready = said.trim().length >= 3 && !busy;

  const file = () => {
    if (!ready) return;
    onRefine(said);
    setSaid("");
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={said}
        onChange={(e) => setSaid(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          file();
        }}
        placeholder={t.refinePlaceholder}
        className={cn(
          "border-input bg-background text-foreground min-w-0 flex-1 rounded-full border",
          "px-3 py-1.5 text-xs",
          "placeholder:text-muted-foreground/60 focus-visible:border-foreground/40 focus-visible:outline-none",
        )}
      />
      <button
        type="button"
        disabled={!ready}
        onMouseDown={(e) => e.preventDefault()}
        onClick={file}
        className={cn(
          "shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium",
          "bg-foreground text-background transition-opacity duration-150",
          !ready && "cursor-not-allowed opacity-40",
        )}
      >
        {t.refineAction}
      </button>
    </div>
  );
}

/**
 * One draft-direction answer, drawn the way a post shape and a visual register
 * are: a card in a strip, with its name on a pill in the corner.
 *
 * The body is the only thing that separates two of these, so it carries the
 * sentence that actually decides the choice — copy.mdx's definition of an
 * angle, the words a register sounds like, what a model is FOR. A card whose
 * body were the name again would be a pill with extra steps.
 *
 * Every card wears its name, not only the chosen one. A post shape identifies
 * itself once drawn, so the post strip can hold its labels back until you pick;
 * a sentence identifies nothing. Ink pill for the chosen one, the same as the
 * register strip in Media.
 */
export function DraftCard({
  label,
  body,
  on,
  inert,
  onPick,
  copy,
}: {
  label: string;
  body: string;
  on: boolean;
  inert: boolean;
  onPick: () => void;
  /**
   * The body is a real post rather than a written-for-the-card sentence.
   *
   * A definition is short, one thought, and reads best centred. A draft is as
   * long as it is, starts with a hook that must be the first thing seen, and
   * may be Arabic — so it hangs from the top edge, aligns to the start, and
   * clamps where the card ends instead of being balanced into the middle.
   */
  copy?: boolean;
}) {
  // Landscape, where a post shape is portrait and a visual register is square.
  // Each tab's card is the size of what it has to show, and this one shows a
  // sentence: 150 wide holds three lines of it, and 120 tall lets a second
  // strip sit inside the panel's 360px window with the first. Three questions
  // in one tab is the whole difference from Post, which asks one.
  const W = 150;
  const H = 120;

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      style={{ width: W, height: H }}
      className={cn(
        // A ground that is NOT bg-card, so an unchosen card's bg-card/85 pill
        // has something to sit on. The style cards get theirs from the drawing.
        "bg-muted relative shrink-0 snap-start overflow-hidden rounded-lg shadow-sm",
        "transition-opacity duration-150",
        inert ? "pointer-events-none" : "cursor-pointer",
        on ? "opacity-100" : "opacity-90 hover:opacity-100",
      )}
    >
      <span
        {...(copy ? { dir: "auto" as const } : {})}
        className={cn(
          "absolute inset-x-3 top-3 bottom-10 flex overflow-hidden",
          "text-foreground/75 text-[13px] leading-snug",
          copy
            ? "line-clamp-4 items-start text-start"
            : "items-center justify-center text-center text-balance",
        )}
      >
        {body}
      </span>
      <span
        className={cn(
          "absolute end-2 bottom-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-full",
          "px-2.5 py-1 text-[11px] leading-tight font-medium",
          on ? "bg-foreground text-background" : "bg-card/85 text-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * A named row of cards that scrolls.
 *
 * Module level rather than a closure inside the panel: a component defined
 * during render is a new type every render, so React would remount the row on
 * every pick — and a remounted scroll container loses its scrollLeft. The
 * strip would snap back to its first card each time you chose one.
 */
export function CardStrip({
  heading,
  rowRef,
  dragging,
  children,
}: {
  heading: string;
  rowRef: (node: HTMLElement | null) => void;
  dragging: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground/60 text-[11px] font-medium">
        {heading}
      </p>
      <div
        ref={rowRef}
        className={cn(
          "no-scrollbar -mx-1 flex gap-2 px-1 py-2",
          "overflow-x-auto overscroll-x-contain",
          dragging
            ? "cursor-grabbing snap-none"
            : "cursor-grab snap-x snap-mandatory",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ConfigChoices({
  section,
  t,
  isRTL,
  product,
  onProduct,
  wired,
  selected,
  onChannels,
  feature,
  onFeature,
  features,
  postType,
  onPostType,
  mediaFilter,
  onMediaFilter,
  mediaType,
  onMediaType,
  imageStyle,
  onImageStyle,
  destination,
  onDestination,
  scheduleAt,
  onScheduleAt,
  ask,
  drafts,
  onUseDraft,
  ago,
}: {
  section: ConfigSection;
  t: SocialDict;
  isRTL: boolean;
  product: string;
  onProduct: (id: ProductId) => void;
  wired: ChannelId[];
  selected: ChannelId[];
  onChannels: (next: ChannelId[]) => void;
  feature: string;
  onFeature: (next: string) => void;
  features: BrandFeature[];
  postType: PostType;
  onPostType: (next: PostType) => void;
  mediaFilter: MediaFilter;
  onMediaFilter: (next: MediaFilter) => void;
  mediaType: string;
  onMediaType: (next: string) => void;
  imageStyle: string;
  onImageStyle: (next: string) => void;
  destination?: Destination;
  onDestination?: (next: Destination) => void;
  /** When Later means, as local wall-clock. Empty until Later is chosen. */
  scheduleAt?: string;
  onScheduleAt?: (next: string) => void;
  ask?: AskLane;
  drafts?: { id: string; text: string; when: string }[];
  onUseDraft?: (id: string) => void;
  ago?: (iso: string) => string;
}) {
  const { ref: shapeRow, dragging } = useDragScroll();
  const { ref: mediaRow, dragging: mediaDragging } = useDragScroll();
  // One per strip, and never inside the branch that renders them — a hook in a
  // conditional is a rule React enforces at runtime and tsc does not see.
  const { ref: angleRow, dragging: angleDragging } = useDragScroll();
  const { ref: registerRow, dragging: registerDragging } = useDragScroll();
  const { ref: modelRow, dragging: modelDragging } = useDragScroll();
  const { ref: queueRow, dragging: queueDragging } = useDragScroll();
  const { ref: pillarRow, dragging: pillarDragging } = useDragScroll();
  // Read straight off the provider rather than threaded down as six more
  // props: this component is only ever rendered inside SocialProvider, and the
  // knobs belong to the drafting lane, not to the panel that displays them.
  const { draftKnobs: knobs, reviewQueue } = useSocial();
  // Which waiting draft is already in the field, so the queue can mark it the
  // way every other strip marks its choice.
  const activeDraftId = reviewQueue.activeDraftId;

  const pill = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
      on
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
    );

  const Pills = ({
    items,
  }: {
    items: { id: string; label: string; on: boolean; pick: () => void }[];
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.on}
          onMouseDown={(e) => e.preventDefault()}
          onClick={item.pick}
          className={pill(item.on)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  if (section === "brand") {
    // A brand with a mark shows it; the rest show their name. Mixed on
    // purpose — five wordmarks and one logo is the honest state of
    // public/brands/, and a placeholder for the missing five would be a
    // worse lie than a name.
    return (
      <div className="flex flex-wrap gap-1.5">
        {PICKABLE_PRODUCTS.map((p) => {
          const on = product === p.id;
          const name = isRTL ? p.labelAr : p.label;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              aria-label={name}
              title={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onProduct(p.id as ProductId)}
              className={cn(
                p.logo
                  ? cn(
                      // A mark needs room a word does not, and an outline of
                      // its own: a bare glyph on a bare background has no
                      // edge to say it is pressable, and no way to show it is
                      // the chosen one without dimming the others.
                      "flex size-20 shrink-0 cursor-pointer items-center justify-center",
                      "rounded-2xl border p-3.5 transition-colors duration-150",
                      on
                        ? "border-foreground/40 bg-accent"
                        : "border-input hover:border-foreground/30 hover:bg-accent/40",
                    )
                  : pill(on),
              )}
            >
              {p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logo}
                  alt={name}
                  className={cn(
                    // Full strength either way. Fading the ones you did not
                    // pick makes five brands look broken to say one is
                    // chosen; the outline says that.
                    "size-full object-contain",
                    // Monochrome-ink marks would vanish on a dark ground —
                    // the brand kit's own rule is that they invert to ivory
                    // there. Colour marks must never be inverted.
                    p.logoInvertsOnDark && "dark:invert",
                  )}
                />
              ) : (
                name
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (section === "feature") {
    // "Any" first, and always present: a pre-launch brand with no catalogue
    // still needs a way to say "no feature", not an empty row.
    return (
      <Pills
        items={[
          {
            id: ANY_FEATURE,
            label: t.mediaAny,
            on: feature === ANY_FEATURE,
            pick: () => onFeature(ANY_FEATURE),
          },
          ...features.map((f) => ({
            id: f.id,
            label: isRTL ? f.ar : f.en,
            on: feature === f.id,
            pick: () => onFeature(f.id),
          })),
        ]}
      />
    );
  }

  if (section === "channels") {
    if (wired.length === 0) {
      return (
        <p className="text-muted-foreground/60 text-xs">
          {t.spotlightConfigNoChannels}
        </p>
      );
    }
    // The same outlined tiles the brands get: a channel is picked by its mark
    // too, and two rows of the same question should not answer it in two
    // different shapes. Multi-select, so several can hold at once.
    return (
      <div className="flex flex-wrap gap-2">
        {wired.map((id) => {
          const channel = CHANNELS.find((entry) => entry.id === id);
          const label = channel ? (isRTL ? channel.labelAr : channel.label) : id;
          const Icon = CHANNEL_ICON[id];
          const on = selected.includes(id);
          const toggle = () =>
            onChannels(
              on ? selected.filter((x) => x !== id) : [...selected, id],
            );
          if (!Icon) {
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggle}
                className={pill(on)}
              >
                {label}
              </button>
            );
          }
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              aria-label={label}
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggle}
              className={cn(
                "flex size-20 shrink-0 cursor-pointer items-center justify-center",
                "rounded-2xl border transition-colors duration-150",
                on
                  ? "border-foreground/40 bg-accent text-foreground"
                  : "border-input text-muted-foreground hover:border-foreground/30 hover:bg-accent/40 hover:text-foreground",
              )}
            >
              <Icon size={32} stroke={1.5} />
            </button>
          );
        })}
      </div>
    );
  }

  if (section === "postType") {
    // A Page's profile picture is its logo, so the preview wears the brand
    // that is actually selected — the card is this brand's post, not a
    // stock one.
    const brandMark = SOCIAL_PRODUCTS.find((p) => p.id === product);
    // Cards, not pills: a shape is easier to recognise drawn than named, and
    // "Text + images" versus "Carousel" is a distinction a word makes badly.
    return (
      <>
        {/* One row that scrolls, rather than a grid that reflows. Nine
            shapes read as a strip of posts to flick through; wrapped into
            rows they read as a form.

            Swipeable in both senses: a trackpad or a finger flicks it and the
            cards land on their own edges, and a mouse can drag the strip
            directly — see useDragScroll, which exists because a desktop
            pointer has nothing to flick with. No bar underneath, since the
            cards running off the edge already say there is more. */}
        <div
          ref={shapeRow}
          className={cn(
            "no-scrollbar -mx-1 flex gap-2 px-1 py-3",
            "overflow-x-auto overscroll-x-contain",
            // Snap is suspended mid-drag. Mandatory snapping corrects every
            // scrollLeft the pointer handler sets, back to the nearest card,
            // so the strip refused to move at all — measured, 4px before and
            // after an eight-step drag. Off while dragging, back on at
            // release, which is also when it lands the strip on a card.
            dragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory",
          )}
        >
          {POST_TYPES.map((type) => {
            const meta = POST_TYPE_META[type];
            const on = postType === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                aria-label={t[POST_TYPE_LABEL[type]]}
                title={t[POST_TYPE_LABEL[type]]}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPostType(type)}
                // No tile around the post. A card inside a card, with a
                // caption under it, was three frames to say one thing — the
                // post IS the choice, so it is the button. Selection rides on
                // the post's own edge.
                className={cn(
                  "w-40 shrink-0 snap-start rounded-lg transition-opacity duration-150",
                  dragging ? "pointer-events-none" : "cursor-pointer",
                  on ? "opacity-100" : "opacity-90 hover:opacity-100",
                )}
              >
                <PostShape
                  meta={meta}
                  // The Page's own picture where one has been read, the mark
                  // otherwise — and a real avatar is never inverted, because
                  // it is colour artwork on its own ground.
                  avatar={brandMark?.avatar ?? brandMark?.logo}
                  invertAvatar={
                    !brandMark?.avatar && brandMark?.logoInvertsOnDark
                  }
                  pageName={brandMark?.pageName ?? brandMark?.label}
                  when={
                    destination === "review"
                      ? t.previewWhenReview
                      : destination === "schedule"
                        ? t.previewWhenLater
                        : t.previewWhenNow
                  }
                  selected={on}
                  label={t[POST_TYPE_LABEL[type]]}
                />
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground/60 pt-2 text-[11px]">
          {t.postTypeHint}
        </p>
      </>
    );
  }

  if (section === "draft") {
    // Publish's face: the drafts already waiting, and the lane that answers.
    // Draft's own stage shows its writing knobs here instead, passed in.
    if (!ask || !drafts || !onUseDraft || !ago) return null;
    // The knobs the drafting lane already has, reachable from the box the
    // writing actually happens in. They are NOT local state: `draftKnobs`
    // lives on the provider, the agent window at /social/draft reads the same
    // values, and the queued brief carries them — so a choice made here aims a
    // real ask rather than being remembered and ignored.
    //
    // Which is also why the hint at the bottom says what it says. Typing your
    // own copy into the field above and pressing the arrow publishes that
    // copy; no angle or register touches it. Three settings that apply to one
    // of the two ways out of this box need to name which one.
    const { model, setModel, angle, setAngle, register, setRegister } = knobs;
    const chosenRung = DRAFT_REGISTERS.find((r) => r.id === register);
    // "Rung 2 — simplified MSA" is a sentence, and a pill is not. The rung is
    // the name; the half after the dash is what the card's body already says.
    const rung = (label: string) => label.split(" — ")[0];
    // "Google Free (Gemini 3.6 Flash)" — the name goes on the pill, the model
    // it actually runs goes in the body next to what it is for.
    const modelName = (label: string) => label.split(" (")[0];
    const modelEngine = (label: string) =>
      label.match(/\(([^)]+)\)/)?.[1] ?? null;
    // Brand-scoped, and empty for a brand with no plan — sijillee and
    // moalimee are pre-launch, and an invented catalogue is worse than an
    // absence. The knobs still apply on top: copy.mdx settles the conflict
    // between a brief's written "Register: rung 2" and a knob set here — a
    // set knob is a decision, so the column wins.
    const pillars = pillarsFor(product);

    // The queue's own words while it waits. Position when a session will get
    // to it, the heartbeat's silence when none has looked — the two are
    // otherwise indistinguishable, which is the failure the agent window
    // already learned to name.
    const waitLine = ask.stalled
      ? t.askStalled
      : ask.queue
        ? ask.queue.lastDrainAt === undefined
          ? t.askNoDrain
          : ask.queue.pendingAhead
            ? fill(t.askQueuedAhead, { ahead: ask.queue.pendingAhead })
            : t.askQueuedNext
        : null;

    return (
      <div className="space-y-1">
        {/* The verb this tab never had. Angle, register and model were
            direction for an ask that could only be made somewhere else — a
            control panel wired to a lane its own box could not reach. */}
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          <button
            type="button"
            disabled={!ask.can || ask.busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={ask.run}
            title={ask.can ? t.askAction : t.askNoSubject}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full",
              "px-3 py-1.5 text-xs font-medium transition-opacity duration-150",
              "bg-foreground text-background",
              (!ask.can || ask.busy) && "cursor-not-allowed opacity-40",
            )}
          >
            {ask.busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <PenLine className="size-3.5" />
            )}
            {ask.busy ? t.askWorking : t.askAction}
          </button>

          {waitLine && (
            <span className="text-muted-foreground/70 text-[11px]">
              {waitLine}
            </span>
          )}
          {ask.stalled && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={ask.again}
              className={pill(false)}
            >
              {t.askCheckAgain}
            </button>
          )}

          {/* An answer that landed after the field had moved on. It waits
              behind a press rather than overwriting words someone spent the
              wait writing. */}
          {ask.ready && (
            <>
              <span className="text-muted-foreground/70 text-[11px]">
                {t.askHeld}
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={ask.use}
                className={pill(true)}
              >
                {t.askUse}
              </button>
            </>
          )}
        </div>

        <p className="text-muted-foreground/60 pb-1.5 text-[11px]">
          {t.askHint}
        </p>

        {/* Refining, once there is something to refine. It is a second field
            because the one above holds the POST — typing into that edits what
            will publish, which is the opposite of saying what to change about
            it. The Draft window can overload one field for both because its
            field never holds a post. */}
        {ask.canRefine && (
          <div className="pb-2">
            <RefineRow t={t} onRefine={ask.refine} busy={ask.busy} />
            <p className="text-muted-foreground/60 pt-1 text-[11px]">
              {t.refineHint}
            </p>
          </div>
        )}

        {/* The plan, as one-press starts. Zero typing to a post: press one,
            wait, read, send. */}
        {pillars.length > 0 && (
          <>
            <CardStrip
              heading={t.pillarHeading}
              rowRef={pillarRow}
              dragging={pillarDragging}
            >
              {pillars.map((p) => (
                <DraftCard
                  key={p.id}
                  copy
                  label={p.pillar}
                  body={pillarSubject(p.brief)}
                  on={false}
                  inert={pillarDragging || ask.busy}
                  onPick={() => ask.runWith(p.brief)}
                />
              ))}
            </CardStrip>
            <p className="text-muted-foreground/60 pb-1.5 text-[11px]">
              {t.pillarHint}
            </p>
          </>
        )}

        <CardStrip
          heading={t.spotlightConfigDraftAngle}
          rowRef={angleRow}
          dragging={angleDragging}
        >
          <DraftCard
            label={t.spotlightConfigDraftFree}
            body={t.spotlightConfigDraftFreeAngle}
            on={angle === null}
            inert={angleDragging}
            onPick={() => setAngle(null)}
          />
          {DRAFT_ANGLES.map((a) => (
            <DraftCard
              key={a.id}
              label={isRTL ? a.labelAr : a.label}
              body={isRTL ? a.hintAr : a.hint}
              on={angle === a.id}
              inert={angleDragging}
              onPick={() => setAngle(a.id)}
            />
          ))}
        </CardStrip>

        <CardStrip
          heading={t.spotlightConfigDraftRegister}
          rowRef={registerRow}
          dragging={registerDragging}
        >
          <DraftCard
            label={t.spotlightConfigDraftFree}
            body={t.spotlightConfigDraftFreeRegister}
            on={register === null}
            inert={registerDragging}
            onPick={() => setRegister(null)}
          />
          {DRAFT_REGISTERS.map((r) => (
            <DraftCard
              key={r.id}
              label={rung(isRTL ? r.labelAr : r.label)}
              // What the rung SOUNDS like, in Arabic in both locales. The
              // ladder is a fact about Arabic; an English gloss of `خليك`
              // would describe the rung without letting anyone hear it.
              body={r.markers}
              on={register === r.id}
              inert={registerDragging}
              onPick={() => setRegister(r.id)}
            />
          ))}
        </CardStrip>

        {/* The rung's full sentence, for the chosen one only. It is fifteen
            words — it would set the card height by itself, and every other
            card in the row would be padding around a shorter one. */}
        {chosenRung && (
          <p className="text-muted-foreground/70 pb-1 text-[11px]">
            {isRTL ? chosenRung.hintAr : chosenRung.hint}
          </p>
        )}

        <CardStrip
          heading={t.spotlightConfigDraftModel}
          rowRef={modelRow}
          dragging={modelDragging}
        >
          {DRAFT_MODELS.map((m) => {
            const engine = modelEngine(m.label);
            const role = isRTL ? m.roleAr : m.role;
            return (
              <DraftCard
                key={m.id}
                label={modelName(m.label)}
                // Its place in the engine's chain, which is the only thing
                // that distinguishes four names to someone choosing between
                // them. No "Writer's choice" card here: the chain has a
                // default and it is already the first card.
                body={engine ? `${role} · ${engine}` : role}
                on={model === m.id}
                inert={modelDragging}
                onPick={() => setModel(m.id)}
              />
            );
          })}
        </CardStrip>

        <p className="text-muted-foreground/60 pt-1 text-[11px]">
          {t.spotlightConfigDraftHint}
        </p>
      </div>
    );
  }

  if (section === "media") {
    return (
      <>
        {/* Two icons, not three pills. A still or a moving picture is the
            first question and it has two answers; pressing the lit one again
            clears it back to either, which is what most posts want. */}
        <div className="flex items-center gap-2">
          {(
            [
              ["image", ImageIcon, t.mediaImage],
              ["video", Video, t.mediaVideo],
            ] as const
          ).map(([value, Icon, label]) => {
            const on = mediaFilter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                aria-label={label}
                title={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMediaFilter(on ? "any" : value)}
                className={cn(
                  "flex size-11 cursor-pointer items-center justify-center rounded-xl border",
                  "transition-colors duration-150",
                  on
                    ? "border-foreground/40 bg-accent text-foreground"
                    : "border-input text-muted-foreground hover:border-foreground/30 hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>

        {/* And under it, how it should look. Sixteen registers, each card
            entirely its own sketch — a style is a treatment of the whole
            frame, so a drawing floating inside a plate would be describing
            the opposite of the thing. */}
        <div
          ref={mediaRow}
          className={cn(
            "no-scrollbar -mx-1 mt-3 flex gap-3 px-1 py-2",
            "overflow-x-auto overscroll-x-contain",
            mediaDragging
              ? "cursor-grabbing snap-none"
              : "cursor-grab snap-x snap-mandatory",
          )}
        >
          <StyleCard
            id={ANY_STYLE}
            label={t.mediaAny}
            on={imageStyle === ANY_STYLE}
            inert={mediaDragging}
            onPick={() => onImageStyle(ANY_STYLE)}
          />
          {IMAGE_STYLES.map((style) => (
            <StyleCard
              key={style.id}
              id={style.id}
              label={styleLabel(style.id, isRTL)}
              on={imageStyle === style.id}
              inert={mediaDragging}
              onPick={() => onImageStyle(style.id)}
            />
          ))}
        </div>

        <p className="text-muted-foreground/60 pt-2 text-[11px]">
          {t.styleHint}
        </p>
      </>
    );
  }

  if (section === "queue") {
    // Publish's faces only. A stage that never shows the word cannot reach
    // here, and one that does without the data has nothing to draw.
    if (!drafts || !onUseDraft || !ago) return null;
    if (drafts.length === 0) {
      return (
        <p className="text-muted-foreground/60 text-xs">
          {t.spotlightConfigQueueEmpty}
        </p>
      );
    }
    // Restored. This branch was deleted in 671d61b — a commit about media
    // radios — and the word kept working the way a word does: it opened the
    // panel and rendered whatever fell through, which was Plan's tiles. Two
    // words, one row, the same three tiles under both, and nothing to say
    // which one you were looking at.
    //
    // Cards now, like everything else in the row, and the body is the draft's
    // own copy — a queue is chosen from by reading the hook, which is exactly
    // what a card can show and a two-line row could not. The pill is the age,
    // because "how long has this been waiting" is the queue's whole question.
    return (
      <>
        <CardStrip
          heading={t.spotlightConfigQueue}
          rowRef={queueRow}
          dragging={queueDragging}
        >
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              copy
              label={ago(draft.when)}
              body={draft.text}
              on={draft.id === activeDraftId}
              inert={queueDragging}
              onPick={() => onUseDraft(draft.id)}
            />
          ))}
        </CardStrip>

        <p className="text-muted-foreground/60 pt-1 text-[11px]">
          {t.spotlightConfigQueueHint}
        </p>
      </>
    );
  }

  // The fall-through face is Timing, and it is Publish's alone: a stage that
  // cannot send has nothing to schedule. It never shows the word, so it never
  // arrives here — but say so rather than trust that.
  if (!destination || !onDestination || scheduleAt === undefined || !onScheduleAt) return null;

  const name: Record<Destination, string> = {
    direct: t.destinationDirect,
    schedule: t.destinationSchedule,
    review: t.destinationReview,
  };
  const hint: Record<Destination, string> = {
    direct: t.destinationDirectHint,
    schedule: t.destinationScheduleHint,
    review: t.destinationReviewHint,
  };
  // The picker's own floor. A past time is refused by the server and by the
  // send button; saying so in the widget is cheaper than either.
  const minSchedule = toLocalInput(new Date());
  const icon: Record<Destination, React.ComponentType<IconProps>> = {
    // The paper plane the seat beside the field already wears.
    direct: IconSend,
    schedule: IconCalendarClock,
    // Someone else looks before it goes out — the signed link's whole point.
    review: IconEye,
  };
  // The brand and channel rows' tiles. Three answers that differ in kind, and
  // the row above them already asks its question this way; a third shape for
  // the same kind of choice would only say they are unrelated.
  //
  // The sentence stays, for the chosen one only. A brand tile can drop its
  // label because a mark IS the name — nobody needs telling that the quill is
  // Balqalam. These three change what pressing the arrow DOES, and "hands
  // back one signed link per channel" is not something an eye can say.
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {DESTINATIONS.map((option) => {
          const Icon = icon[option];
          const on = destination === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              aria-label={name[option]}
              title={name[option]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onDestination(option)}
              className={cn(
                "flex size-20 shrink-0 cursor-pointer items-center justify-center",
                "rounded-2xl border transition-colors duration-150",
                on
                  ? "border-foreground/40 bg-accent text-foreground"
                  : "border-input text-muted-foreground hover:border-foreground/30 hover:bg-accent/40 hover:text-foreground",
              )}
            >
              <Icon size={32} stroke={1.5} />
            </button>
          );
        })}
      </div>

      {/* Later is the only one of the three that needs a second answer, and it
          appears under the tile that asked for it rather than living in the
          row permanently — Now and Review have no time, and an input greyed
          out beside them would be a control that is never for you. */}
      {destination === "schedule" && (
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          <input
            type="datetime-local"
            value={scheduleAt}
            min={minSchedule}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => onScheduleAt(e.target.value)}
            className={cn(
              "border-input bg-background text-foreground rounded-md border",
              "px-2.5 py-1.5 text-xs tabular-nums",
              "focus-visible:border-foreground/40 focus-visible:outline-none",
            )}
          />
          {QUICK_TIMES.map((quick) => (
            <button
              key={quick.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onScheduleAt(quick.at())}
              className={pill(false)}
            >
              {t[quick.key]}
            </button>
          ))}
        </div>
      )}

      <p className="text-muted-foreground/70 pt-2.5 text-[11px]">
        <span className="text-foreground/80 font-medium">
          {name[destination]}
        </span>{" "}
        — {hint[destination]}
      </p>
    </>
  );
}

/**
 * The panel's other face — where image and video get onto the post.
 *
 * It renders INSIDE the dropdown rather than in a popover of its own. The
 * panel is already open when the ⊕ is pressed, and a floating layer over an
 * open panel is one surface too many: two stacking contexts, two ways to
 * dismiss, and a picker that covers the thing it is attaching to.
 *
 * Three ways in, cheapest first: the brand's own library (the common case, and
 * it should not cost a trip to the showroom and a copied URL), a pasted CDN
 * link, and the showroom itself for actual browsing. What is already attached
 * sits on top with a remove on each — the tray has nowhere else to live now
 * that the composer's inline strip is gone.
 */
export function MediaPanel({
  t,
  urls,
  brandMedia,
  postType,
  mediaFilter,
  mediaType,
  onAttach,
  onRemove,
  onBrowse,
}: {
  t: SocialDict;
  urls: string[];
  brandMedia: BrandMedia[];
  postType: PostType;
  mediaFilter: MediaFilter;
  mediaType: string;
  onAttach: (url: string) => void;
  onRemove: (url: string) => void;
  onBrowse: () => void;
}) {
  const [draft, setDraft] = React.useState("");
  const valid = /^https?:\/\//i.test(draft.trim());

  /**
   * Library picks not already in the tray — attached ones would be inert —
   * narrowed by what the post says it is. Choosing Reel in the settings stops
   * this offering hero stills; choosing Video stops it offering images. The
   * settings face is not decoration: this is where two of its boxes land.
   */
  const suggestions = brandMedia.filter(
    (m) =>
      !urls.includes(m.url) &&
      libraryFits(m, postType, mediaFilter, mediaType),
  );

  const addUrl = () => {
    if (!valid) return;
    onAttach(draft.trim());
    setDraft("");
  };

  return (
    <div className={cn(SPOTLIGHT_PANEL, "p-4 text-start")}>
      {urls.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {urls.map((url) => (
            <div key={url} className="group/chip relative">
              {mediaKind(url) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="border-border size-16 rounded-xl border object-cover"
                />
              ) : (
                <span className="border-border bg-muted-foreground/10 flex size-16 items-center justify-center rounded-xl border font-mono text-[10px] tracking-wider uppercase">
                  {t.mediaKindVideo}
                </span>
              )}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRemove(url)}
                aria-label={t.attachRemove}
                className="bg-background border-border absolute -top-1.5 -end-1.5 rounded-full border p-0.5 opacity-0 transition-opacity group-hover/chip:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <p className="text-muted-foreground/60 pb-2 text-[11px]">
            {t.recommendedMedia}
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {suggestions.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAttach(asset.url)}
                title={asset.title}
                aria-label={fill(t.attachNamed, { name: asset.title })}
                className="border-border hover:border-foreground/40 focus-visible:border-foreground/40 size-16 shrink-0 overflow-hidden rounded-xl border transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </>
      )}

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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // The panel lives inside a cmdk root, which reads arrow keys and
          // Enter as list navigation. This field is not a list.
          onKeyDown={(e) => {
            e.stopPropagation();
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={addUrl}
          disabled={!valid}
          className="h-9 shrink-0 rounded-full"
          aria-label={t.attachAddAction}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{t.mediaHint}</p>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onBrowse}
        className="text-foreground mt-2 text-xs font-medium underline underline-offset-4"
      >
        {t.attachBrowse}
      </button>
    </div>
  );
}

/**
 * One block of rows. In "all" mode the kinds are headed, because a draft and a
 * published post look alike at a glance and mean opposite things.
 */
function ItemGroup({
  items,
  grouped,
  t,
  lang,
  brandLabel,
  channelLabel,
  onSelect,
}: {
  items: QueueItem[];
  grouped: boolean;
  t: SocialDict;
  lang: string;
  brandLabel: (id: string) => string;
  channelLabel: (id?: string) => string | null;
  onSelect: (item: QueueItem) => void;
}) {
  if (items.length === 0) return null;

  if (!grouped) {
    return (
      <CommandPrimitive.Group>
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            t={t}
            lang={lang}
            brandLabel={brandLabel}
            channelLabel={channelLabel}
            onSelect={onSelect}
          />
        ))}
      </CommandPrimitive.Group>
    );
  }

  const kinds: QueueItem["kind"][] = ["draft", "scheduled", "published"];
  return (
    <>
      {kinds.map((kind) => {
        const slice = items.filter((item) => item.kind === kind);
        if (slice.length === 0) return null;
        return (
          <React.Fragment key={kind}>
            <p className="text-muted-foreground/50 px-3 pt-2 pb-1 text-[11px] uppercase">
              {t[KIND_HEADING_KEY[kind]]}
            </p>
            <CommandPrimitive.Group>
              {slice.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  t={t}
                  lang={lang}
                  brandLabel={brandLabel}
                  channelLabel={channelLabel}
                  onSelect={onSelect}
                />
              ))}
            </CommandPrimitive.Group>
          </React.Fragment>
        );
      })}
    </>
  );
}

function Row({
  item,
  t,
  lang,
  brandLabel,
  channelLabel,
  onSelect,
}: {
  item: QueueItem;
  t: SocialDict;
  lang: string;
  brandLabel: (id: string) => string;
  channelLabel: (id?: string) => string | null;
  onSelect: (item: QueueItem) => void;
}) {
  const Icon = KIND_ICON[item.kind];
  const readOnly = item.kind !== "draft";
  const channel = channelLabel(item.channel);

  return (
    <CommandPrimitive.Item
      // cmdk uses `value` as its selection key; ids collide across the two
      // tables in principle, so the kind is part of it.
      value={`${item.kind}:${item.id}`}
      onSelect={() => onSelect(item)}
      className={cn(
        "relative flex cursor-default items-start gap-3 rounded-xl px-3 py-3 text-sm outline-hidden select-none",
        "transition-colors duration-100",
        "data-[selected=true]:bg-accent/50",
      )}
    >
      <span className="bg-muted/50 text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          dir="auto"
          className="line-clamp-2 min-w-0 text-start leading-relaxed"
        >
          {item.text}
        </span>
        <span className="text-muted-foreground/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className="border-input rounded-full border px-2 py-0.5 text-[10px]">
            {brandLabel(item.brand)}
          </span>
          {channel && <span>{channel}</span>}
          {item.turn && item.turn > 1 && (
            <span dir="ltr">{fill(t.spotlightTurn, { turn: item.turn })}</span>
          )}
          {item.mediaUrls.length > 0 && (
            <span className="flex items-center gap-1" dir="ltr">
              <Images className="size-3" />
              {item.mediaUrls.length}
            </span>
          )}
          <span dir="auto">{whenLabel(item, t, lang)}</span>
          {readOnly && (
            <span className="opacity-70">· {t.spotlightReadOnly}</span>
          )}
        </span>
      </span>
    </CommandPrimitive.Item>
  );
}

/**
 * Drafts read as an age ("3h ago") because the queue's question is how long
 * something has waited; variants read as a date, because theirs is when.
 */
function whenLabel(item: QueueItem, t: SocialDict, lang: string): string {
  const date = new Date(item.when);
  if (Number.isNaN(date.getTime())) return "";

  if (item.kind === "draft") {
    const minutes = Math.max(
      0,
      Math.round((Date.now() - date.getTime()) / 60_000),
    );
    const age =
      minutes >= 60 * 24
        ? `${Math.round(minutes / (60 * 24))}d`
        : minutes >= 60
          ? `${Math.round(minutes / 60)}h`
          : `${minutes}m`;
    return fill(t.reviewAgo, { age });
  }

  const when = date.toLocaleString(lang === "ar" ? "ar" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return fill(
    item.kind === "scheduled" ? t.spotlightGoesOut : t.spotlightWentOut,
    { when },
  );
}

/** hogwarts' keyboard hints, trimmed to the three keys this box binds. */
function Footer({ t }: { t: SocialDict }) {
  return (
    <div className="text-muted-foreground/50 flex items-center gap-4 border-t border-black/5 px-4 py-2 text-[11px] dark:border-white/10">
      <span className="flex items-center gap-1.5">
        <Key>↑</Key>
        <Key>↓</Key>
        <span>{t.spotlightHintNavigate}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Key>↵</Key>
        <span>{t.spotlightHintOpen}</span>
      </span>
      <span className="ms-auto flex items-center gap-1.5">
        <Key>esc</Key>
        <span>{t.spotlightHintClose}</span>
      </span>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      dir="ltr"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-black/10 bg-black/5 px-1.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5"
    >
      {children}
    </kbd>
  );
}
