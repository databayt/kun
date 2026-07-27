// Egress health, in one shape.
//
// Both the server-rendered first paint (the /social page) and the client-side
// "Test Connections" button read through here, so the panel can't disagree with
// itself depending on which path filled it. The three probes are independent
// endpoints — they run together, and one hanging transport can't stall the rest.

import { db } from "@/lib/db";
import { checkHermesHealth } from "@/lib/hermes";
import { checkTelegramHealth } from "@/lib/telegram";
import { checkFacebookHealth } from "@/lib/facebook";

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
}

export interface EgressStatus {
  hermes: TransportStatus;
  telegram: TransportStatus;
  facebook: TransportStatus;
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
  const [hermes, telegram, facebook, heartbeat] = await Promise.allSettled([
    checkHermesHealth(),
    checkTelegramHealth(),
    checkFacebookHealth(product),
    db.systemHeartbeat.findUnique({ where: { key: "hermes" } }),
  ]);

  const lastSeen =
    heartbeat.status === "fulfilled" && heartbeat.value
      ? heartbeat.value.at.toISOString()
      : undefined;

  return {
    hermes: settled(hermes, (v) => ({
      connected: v.ok,
      detail: v.version ? `v${v.version}` : undefined,
      error: v.error,
      lastSeen,
    })),
    telegram: settled(telegram, (v) => ({
      connected: v.ok,
      detail: v.username ? `@${v.username}` : undefined,
      error: v.error,
    })),
    // The Page name is the proof the selected product resolved to the right
    // Page — the only pre-publish signal that the token isn't crossed.
    facebook: settled(facebook, (v) => ({
      connected: v.ok,
      detail: v.name,
      error: v.error,
    })),
  };
}
