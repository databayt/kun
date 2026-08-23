// Channel registry for the Social Hub — single source of truth shared by the
// dashboard toggles, the server-action Zod schema, and every delivery lane.
//
// Two orthogonal axes, and conflating them is the mistake this file exists to
// prevent:
//
//   kind      — what the channel is FOR. The distribution channels carry
//               marketing to an audience; Slack is the one communication
//               channel, the internal team surface where approvals and notices
//               land. Slack is never reach and never a publish target.
//   transport — how bytes actually move. Orthogonal to kind: two distribution
//               channels can be equally audience-facing and still need
//               completely different delivery machinery.
//
// `wired` means kun can deliver there unattended. A `manual` channel is never
// wired — there is nothing to execute.
//
// Per-channel reality lives in /docs/social/status; setup guides are under
// /docs/social/channels. This module imports nothing, deliberately: products.ts
// imports it, so an import here would close a cycle.

/**
 * How bytes reach the platform.
 *   slack     — direct incoming webhook from the site (works on Vercel). The
 *               internal review lane only; never an audience channel.
 *   facebook  — direct Graph API from the site (works on Vercel)
 *   instagram — direct Graph API from the site, two-step container publish on
 *               the linked Page's token (lib/instagram.ts). Image required.
 *   hermes    — the gateway delivers; it PULLS its work from /api/social/queue,
 *               because Vercel can never call into a localhost listener
 *   manual    — no posting API exists. /publish renders a copy-out block and a
 *               human forwards it. Never queued, never drained.
 */
export type ChannelTransport =
  "slack" | "facebook" | "instagram" | "hermes" | "manual";

/**
 * What the channel is for.
 *   distribution  — audience-facing marketing. Counts as reach.
 *   communication — internal team surface. Never reach, never a publish target.
 */
export type ChannelKind = "distribution" | "communication";

export interface SocialChannel {
  id: string;
  label: string;
  labelAr: string;
  kind: ChannelKind;
  /** kun can deliver here unattended. A `manual` channel is never wired. */
  wired: boolean;
  transport: ChannelTransport;
  /**
   * The platform reports numbers back, so /api/social/metrics can read them.
   * Facebook only today; a `manual` channel has no platform surface at all.
   */
  metrics?: boolean;
}

export const CHANNELS = [
  {
    id: "slack",
    label: "Slack",
    labelAr: "سلاك",
    // The one communication channel. It stays in the registry because the
    // review lane genuinely delivers here and /api/social/relay must be able to
    // name it in a refusal — but `kind` keeps it out of every audience path.
    kind: "communication",
    wired: true,
    // Direct incoming webhook, not the gateway. The approval notice and the
    // token alarm must arrive when nobody is watching; routing them through a
    // laptop at home is how three posts sat unapproved for 23 days.
    transport: "slack",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    labelAr: "واتساب",
    // Primary by audience value, manual by transport. Meta offers no organic
    // posting API for Channels or broadcast lists — that is not a gate we can
    // pass, it is a capability that is not offered. The pipeline still drafts,
    // renders media for, and gates WhatsApp like any other channel; only the
    // publish step differs. See /docs/social/channels/whatsapp.
    kind: "distribution",
    wired: false,
    transport: "manual",
  },
  {
    id: "x",
    label: "X / Twitter",
    labelAr: "إكس",
    kind: "distribution",
    wired: false,
    transport: "hermes",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    labelAr: "لينكدإن",
    kind: "distribution",
    wired: false,
    transport: "hermes",
  },
  {
    id: "facebook",
    label: "Facebook",
    labelAr: "فيسبوك",
    kind: "distribution",
    // Transport is implemented (lib/facebook.ts + direct Graph API).
    wired: true,
    transport: "facebook",
    // read_insights + pages_read_user_content granted 2026-07-27, verified live.
    metrics: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    labelAr: "إنستغرام",
    kind: "distribution",
    // The adapter is ready (lib/instagram.ts); the gate is the Standard-Access
    // publish test via Mkan plus INSTAGRAM_USER_ID_<PRODUCT> and a Page token
    // re-minted with instagram_content_publish. Flip to true when the test
    // passes and the env lands — see kun#141 and /docs/social/channels/instagram.
    wired: false,
    transport: "instagram",
  },
  {
    id: "tiktok",
    label: "TikTok",
    labelAr: "تيك توك",
    kind: "distribution",
    wired: false,
    transport: "hermes",
  },
  {
    id: "snapchat",
    label: "Snapchat",
    labelAr: "سناب شات",
    kind: "distribution",
    wired: false,
    transport: "hermes",
  },
] as const satisfies readonly SocialChannel[];

export type ChannelId = (typeof CHANNELS)[number]["id"];

/**
 * Every id the system may legitimately encounter, communication included.
 * This is the READ contract — what a stored `SocialVariant.channel` may hold
 * and what /api/social/relay recognises well enough to refuse by name.
 * For "what may a composer target", use DISTRIBUTION_CHANNEL_IDS.
 */
export const CHANNEL_IDS = CHANNELS.map((c) => c.id) as [
  ChannelId,
  ...ChannelId[],
];

export type DistributionChannelId = Extract<
  (typeof CHANNELS)[number],
  { kind: "distribution" }
>["id"];

/**
 * The eight. The WRITE contract — the only channels a post may be addressed to.
 * `DistributionChannelId` is a subtype of `ChannelId`, so these flow into every
 * existing signature unchanged.
 */
export const DISTRIBUTION_CHANNELS = CHANNELS.filter(
  (c): c is Extract<(typeof CHANNELS)[number], { kind: "distribution" }> =>
    c.kind === "distribution",
);

export const DISTRIBUTION_CHANNEL_IDS = DISTRIBUTION_CHANNELS.map(
  (c) => c.id,
) as [DistributionChannelId, ...DistributionChannelId[]];

/** Internal surfaces. Slack today, and ideally forever. */
export const COMMUNICATION_CHANNEL_IDS: ChannelId[] = CHANNELS.filter(
  (c) => c.kind === "communication",
).map((c) => c.id);

/**
 * Transports the site itself can execute inside a Vercel function.
 *
 * Deliberately an allow-list. A deny-list ("everything except hermes") has to
 * be updated whenever a transport is ADDED, and forgetting means the drain
 * attempts something impossible. An allow-list has to be updated when a
 * transport becomes DRAINABLE, and forgetting means work waits in the queue —
 * visible as a growing `scheduled` backlog. For a system that writes to public
 * brand pages, fail-closed is the only defensible default.
 */
const DRAIN_TRANSPORTS: readonly ChannelTransport[] = ["facebook", "instagram"];

export const DRAIN_CHANNEL_IDS: ChannelId[] = CHANNELS.filter((c) =>
  DRAIN_TRANSPORTS.includes(c.transport),
).map((c) => c.id);

/**
 * Channels kun cannot post to directly — Hermes owns their delivery and pulls
 * them from /api/social/queue. The drain must skip these or it races the
 * gateway and burns their retry budget on a webhook it cannot reach.
 */
export const HERMES_CHANNEL_IDS: ChannelId[] = CHANNELS.filter(
  (c) => c.transport === "hermes",
).map((c) => c.id);

/** Copy-out only. Never queued, never drained, never auto-published. */
export const MANUAL_CHANNEL_IDS: ChannelId[] = CHANNELS.filter(
  (c) => c.transport === "manual",
).map((c) => c.id);

/**
 * Channels /api/social/metrics can read numbers back from.
 * `in` rather than a plain property read: `as const` keeps each entry's exact
 * literal type, so the optional field simply does not exist on the members
 * that omit it.
 */
export const METRIC_CHANNEL_IDS: ChannelId[] = CHANNELS.filter(
  (c) => "metrics" in c && c.metrics,
).map((c) => c.id);
