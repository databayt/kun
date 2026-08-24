// The token canary.
//
// Publishing runs on Page access tokens that are derived from an identity —
// today a Business Portfolio System User, previously a personal grant. Those
// tokens do not announce their own death. If the identity is banned, its role
// on a Page is removed, or a scope is revoked, `sendFacebookPost` starts
// returning an auth error and the only symptom is that the brand Pages go
// quiet. The drain keeps retrying, variants pile up as `scheduled`, and nobody
// finds out until someone happens to look at a Page.
//
// This route is the thing that looks. It probes every brand that is supposed to
// be publishable and alerts the review channel the moment one stops answering.
// It is READ-ONLY: it never posts, never mutates a variant, and never touches
// the queue. A canary that can publish is not a canary.
//
// Silence is the failure mode it exists to convert into a message, so it is
// deliberately loud on failure and completely silent on success — a green run
// sends nothing, because an alert channel that chirps every hour gets muted,
// and a muted alert channel is worse than none.

import { isAuthorizedBearer } from "@/lib/cron-auth";
import { checkFacebookHealth, getFacebookConfig } from "@/lib/facebook";
import { PRODUCTS, productChannelWired } from "@/components/root/social/products";
import { CHANNELS } from "@/components/root/social/config";
import { canSendReview, sendReview } from "@/lib/social-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BrandProbe {
  product: string;
  ok: boolean;
  /** Page name when healthy — proof the token addresses the Page we think. */
  name?: string;
  error?: string;
  /** 0 means permanent. Anything else is a scheduled outage worth warning on. */
  expiresAt?: number;
  /**
   * When the GRANT behind the token dies, which is a different clock from the
   * token's own. A permanent Page token derived from a personal login reports
   * `expires_at: 0` and still stops working when the 90-day data-access window
   * closes. Also 0 for a System User token, which has no such window.
   */
  dataAccessExpiresAt?: number;
}

/**
 * A token that still works but expires is a future incident, so the canary
 * reports it alongside outright failure. `expires_at: 0` is the only healthy
 * value; the System User tokens and the older permanent Page tokens both
 * report it.
 *
 * Reading `expires_at` ALONE is how the canary spent months calling databayt
 * permanently healthy while it was the only brand with a deadline. A Page token
 * derived from a personal login reports `expires_at: 0` — the token really is
 * permanent — but dies anyway when the grant's 90-day `data_access_expires_at`
 * window closes. Two clocks, either one fatal, so probe both.
 */
async function probeToken(token: string): Promise<{
  expiresAt?: number;
  dataAccessExpiresAt?: number;
}> {
  try {
    const url = new URL("https://graph.facebook.com/v25.0/debug_token");
    url.searchParams.set("input_token", token);
    url.searchParams.set("access_token", token);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return {};
    const body = (await res.json()) as {
      data?: { expires_at?: number; data_access_expires_at?: number };
    };
    return {
      expiresAt: body.data?.expires_at,
      dataAccessExpiresAt: body.data?.data_access_expires_at,
    };
  } catch {
    return {};
  }
}

/** Days from now until `epochSeconds`, floored. Negative once it has passed. */
function daysUntil(epochSeconds: number): number {
  return Math.floor((epochSeconds * 1000 - Date.now()) / 86_400_000);
}

/**
 * How close a grant has to get before it is worth waking someone. Re-consenting
 * rolls the window a full 90 days, so there is no value in chirping the whole
 * time — but the fix needs a human at a browser, so it needs real notice.
 */
const GRANT_WARNING_DAYS = 21;

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedBearer(request)) {
    // 503 rather than 401 when the deployment simply has no secret, matching
    // the other machine routes: the scheduled caller treats it as a config gap
    // to warn about, not a failure to page someone over.
    const configured = Boolean((process.env.CRON_SECRET ?? "").trim());
    return Response.json(
      { ok: false, error: configured ? "unauthorized" : "CRON_SECRET not set" },
      { status: configured ? 401 : 503 },
    );
  }

  const facebook = CHANNELS.find((c) => c.id === "facebook");
  const brands = PRODUCTS.filter((p) =>
    productChannelWired(p.id, "facebook", Boolean(facebook?.wired)),
  );

  // Probed together: one hanging brand must not push the others past maxDuration.
  const probes: BrandProbe[] = await Promise.all(
    brands.map(async (p): Promise<BrandProbe> => {
      const health = await checkFacebookHealth(p.id);
      if (!health.ok) {
        return { product: p.id, ok: false, error: health.error };
      }
      const { token } = await getFacebookConfig(p.id);
      const probed = await probeToken(token);
      return {
        product: p.id,
        ok: true,
        name: health.name,
        expiresAt: probed.expiresAt,
        dataAccessExpiresAt: probed.dataAccessExpiresAt,
      };
    }),
  );

  const dead = probes.filter((p) => !p.ok);
  // Defined-and-nonzero. `undefined` means debug_token itself was unreachable,
  // which is not evidence of expiry and must not raise a false alarm.
  const expiring = probes.filter(
    (p) => p.ok && p.expiresAt !== undefined && p.expiresAt !== 0,
  );
  // The grant clock, warned on only once it is close — see GRANT_WARNING_DAYS.
  const grantExpiring = probes.filter(
    (p) =>
      p.ok &&
      p.dataAccessExpiresAt !== undefined &&
      p.dataAccessExpiresAt !== 0 &&
      daysUntil(p.dataAccessExpiresAt) <= GRANT_WARNING_DAYS,
  );

  // A canary that cannot sing is a canary you only think you have. This asks
  // sendReview itself rather than re-deriving the answer from env vars — the
  // two drifted apart before, and a canary reporting the wrong alertability is
  // worse than one that cannot alert at all.
  const canAlert = canSendReview();

  let alerted = false;
  if (dead.length || expiring.length || grantExpiring.length) {
    const lines = [
      "🐤 Facebook token canary — publishing is degraded.",
      "",
      ...dead.map((p) => `❌ ${p.product}: ${p.error}`),
      ...expiring.map(
        (p) =>
          `⏳ ${p.product}: token expires at ${p.expiresAt} (should be 0 — it will stop working)`,
      ),
      ...grantExpiring.map(
        (p) =>
          `⏳ ${p.product}: the GRANT behind this token dies in ` +
          `${daysUntil(p.dataAccessExpiresAt ?? 0)} days ` +
          `(data_access_expires_at ${p.dataAccessExpiresAt}). The token itself ` +
          `still reads permanent — re-consent, or migrate the brand to the ` +
          `System User so it has no such window.`,
      ),
      "",
      "Publishing to these brands is failing or will fail. Re-mint from the",
      "Business Portfolio System User and swap FACEBOOK_PAGE_ACCESS_TOKEN_<BRAND>",
      "— see /docs/social/channels/facebook.",
    ];
    const sent = await sendReview(lines.join("\n"), "Token canary");
    alerted = sent.ok;
  }

  return Response.json({
    ok: dead.length === 0 && expiring.length === 0 && grantExpiring.length === 0,
    checked: probes.length,
    canAlert,
    alerted,
    probes,
  });
}
