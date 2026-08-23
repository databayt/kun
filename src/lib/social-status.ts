// Egress health, in one shape.
//
// Both the server-rendered first paint (the /social page) and the client-side
// "Test Connections" button read through here, so the panel can't disagree with
// itself depending on which path filled it. The three probes are independent
// endpoints — they run together, and one hanging transport can't stall the rest.

import { db } from "@/lib/db";
import { checkHermesHealth } from "@/lib/hermes";
import { checkFacebookHealth } from "@/lib/facebook";
import { checkInstagramHealth, getInstagramConfig } from "@/lib/instagram";
import { isSlackConfigured } from "@/lib/slack";

export interface TransportStatus {
  connected: boolean;
  /** Proof-of-identity for the connection: gateway version, @bot, Page name. */
  detail?: string;
  error?: string;
  /**
   * When the component last called in, ISO. Hermes only.
   *
   * `connected` for Hermes means "reachable FROM this deployment", which is
   * permanently false in production — it listens on localhost with no public
   * route. That says nothing about whether the gateway is alive. This does:
   * it is written every time Hermes polls /api/social/queue.
   */
  lastSeen?: string;
  /**
   * Deliberately unconfigured — Hermes without a gateway URL, a transport without
   * a bot token (deferred 2026-07-30: the focus is Facebook + Instagram).
   * Parked is a choice, not a failure: it must not render red or drag the
   * toolbar dot down. The moment the env lands, the row goes live again.
   */
  parked?: boolean;
}

export interface EgressStatus {
  hermes: TransportStatus;
  facebook: TransportStatus;
  instagram: TransportStatus;
  /**
   * The review lane's destination. Surfaced deliberately: on 2026-08-23 it was
   * configured nowhere, so approval notices and token alarms went nowhere, and
   * three finished posts sat unapproved for 23 days with every other row green.
   * A missing review destination is not a quiet condition — it is the one that
   * hides all the others.
   */
  slack: TransportStatus;
  /**
   * The draft queue's liveness: pending count + when a drafting session last
   * ran `social-drafts.mjs list` (heartbeat key "draft-drain"). Optional so
   * the client-side error fallback doesn't have to fake it.
   */
  draftDrain?: { pending: number; lastSeen?: string };
}

// The health helpers already catch their own failures; allSettled is the guard
// against an unexpected throw taking down the whole panel with it.
function settled<T>(
  result: PromiseSettledResult<T>,
  map: (value: T) => TransportStatus,
): TransportStatus {
  if (result.status === "fulfilled") return map(result.value);
  return { connected: false, error: String(result.reason) };
}

export async function getEgressStatus(product?: string): Promise<EgressStatus> {
  const [
    hermes,
    facebook,
    instagram,
    igConfig,
    heartbeat,
    drainBeat,
    drainPending,
  ] = await Promise.allSettled([
    checkHermesHealth(),
    checkFacebookHealth(product),
    checkInstagramHealth(product),
    getInstagramConfig(product),
    db.systemHeartbeat.findUnique({ where: { key: "hermes" } }),
    db.systemHeartbeat.findUnique({ where: { key: "draft-drain" } }),
    db.socialDraftRequest.count({ where: { status: "pending" } }),
  ]);

  const lastSeen =
    heartbeat.status === "fulfilled" && heartbeat.value
      ? heartbeat.value.at.toISOString()
      : undefined;

  const draftDrain =
    drainPending.status === "fulfilled"
      ? {
          pending: drainPending.value,
          lastSeen:
            drainBeat.status === "fulfilled" && drainBeat.value
              ? drainBeat.value.at.toISOString()
              : undefined,
        }
      : undefined;

  const hermesParked = !(process.env.HERMES_API_URL ?? "").trim();
  // Per-product, unlike the two above: mkan can be configured while hogwarts
  // waits on its account — the row follows the brand selector.
  const instagramParked =
    igConfig.status === "fulfilled" ? !igConfig.value.igUserId : true;

  // No probe: an incoming webhook has no read endpoint, and POSTing to find out
  // would put a test message in the review channel every time the panel opens.
  // Configured-or-not is the honest signal available.
  const slackReady = isSlackConfigured();

  return {
    slack: {
      connected: slackReady,
      detail: slackReady ? "webhook set" : undefined,
      error: slackReady
        ? undefined
        : "No review destination — approvals and token alarms reach nobody. Set SLACK_WEBHOOK_URL.",
    },
    hermes: settled(hermes, (v) => ({
      connected: v.ok,
      detail: v.version ? `v${v.version}` : undefined,
      error: v.error,
      lastSeen,
      parked: hermesParked,
    })),
    // Bot AND destination — a green dot that only vouched for the token lied
    // about a channel that existed nowhere.
    // The Page name is the proof the selected product resolved to the right
    // Page — the only pre-publish signal that the token isn't crossed.
    facebook: settled(facebook, (v) => ({
      connected: v.ok,
      detail: v.name,
      error: v.error,
    })),
    // Same crossed-token guard as Facebook, via the @username.
    instagram: settled(instagram, (v) => ({
      connected: v.ok,
      detail: v.username ? `@${v.username}` : undefined,
      error: v.error,
      parked: instagramParked,
    })),
    draftDrain,
  };
}
