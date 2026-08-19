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
import { sendReview } from "@/lib/social-review";

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
}

/**
 * A token that still works but expires is a future incident, so the canary
 * reports it alongside outright failure. `expires_at: 0` is the only healthy
 * value; the System User tokens and the older permanent Page tokens both
 * report it.
 */
async function probeExpiry(token: string): Promise<number | undefined> {
  try {
    const url = new URL("https://graph.facebook.com/v25.0/debug_token");
    url.searchParams.set("input_token", token);
    url.searchParams.set("access_token", token);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { data?: { expires_at?: number } };
    return body.data?.expires_at;
  } catch {
    return undefined;
  }
}

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
      return {
        product: p.id,
        ok: true,
        name: health.name,
        expiresAt: await probeExpiry(token),
      };
    }),
  );

  const dead = probes.filter((p) => !p.ok);
  // Defined-and-nonzero. `undefined` means debug_token itself was unreachable,
  // which is not evidence of expiry and must not raise a false alarm.
  const expiring = probes.filter(
    (p) => p.ok && p.expiresAt !== undefined && p.expiresAt !== 0,
  );

  // A canary that cannot sing is a canary you only think you have. `sendReview`
  // needs Hermes or a private Telegram chat; if neither is configured the
  // detection still works but the message goes nowhere, so this is reported
  // even on a healthy run — the scheduled caller turns it into a warning.
  const canAlert = Boolean(
    (process.env.HERMES_API_URL ?? "").trim() ||
      ((process.env.TELEGRAM_BOT_TOKEN ?? "").trim() &&
        (process.env.TELEGRAM_REVIEW_CHAT_ID ?? "").trim()),
  );

  let alerted = false;
  if (dead.length || expiring.length) {
    const lines = [
      "🐤 Facebook token canary — publishing is degraded.",
      "",
      ...dead.map((p) => `❌ ${p.product}: ${p.error}`),
      ...expiring.map(
        (p) =>
          `⏳ ${p.product}: token expires at ${p.expiresAt} (should be 0 — it will stop working)`,
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
    ok: dead.length === 0 && expiring.length === 0,
    checked: probes.length,
    canAlert,
    alerted,
    probes,
  });
}
