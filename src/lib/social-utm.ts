// UTM tagging for outbound links.
//
// This is the measurement lane that works regardless of platform APIs. Reach
// and engagement have to be read back from each platform, and on Facebook that
// lane is now open: `read_insights` and `pages_read_user_content` were granted
// on 2026-07-27 — Standard Access, no App Review, no Business Verification —
// and both were verified returning real numbers against a live Hogwarts post
// (kun#139). The client that reads them is `lib/facebook-metrics.ts`.
//
// The scopes were never the whole story. Meta retired the `post_impressions*`
// metric family during 2025, so even a correctly-scoped token gets `(#100)`
// from the old names — see the retirement table in `lib/facebook-metrics.ts`.
//
// UTM stays the primary signal regardless, because it measures at the
// destination we own instead of at the platform. A platform can retire a
// metric, gate it behind a permission, or answer with an approximate count
// carrying a debug notice — all three of those happened here, on one feature,
// inside one year. The strategy's kill criteria are "zero signal after 3 months
// of consistent posting", and that verdict should not rest on a number whose
// definition someone else can change underneath it.
//
// Applied at delivery, not when the copy is written: the stored text and the
// review message stay readable, and a link only grows parameters at the moment
// it becomes channel-specific.

export interface UtmContext {
  /** Channel id — becomes utm_source, so each platform's traffic is separable. */
  channel: string;
  /** Product id — becomes part of utm_campaign. */
  brand: string;
}

// Matches bare URLs in plain text. Deliberately conservative: trailing
// punctuation is excluded so "see https://x.com/y." does not capture the stop.
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;

function tag(raw: string, { channel, brand }: UtmContext): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  // Someone hand-tagged it, or /higgs did. Their intent wins — silently
  // rewriting a deliberate campaign name would make attribution lie.
  if (url.searchParams.has("utm_source")) return raw;

  url.searchParams.set("utm_source", channel);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", brand);
  return url.toString();
}

/**
 * Add UTM parameters to every untagged link in a post body.
 *
 * Idempotent: a text that has already been through this is unchanged, so it is
 * safe on a retry, and safe if a caller applies it twice.
 */
export function applyUtm(text: string, context: UtmContext): string {
  if (!text) return text;
  return text.replace(URL_PATTERN, (match) => tag(match, context));
}
