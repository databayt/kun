// UTM tagging for outbound links.
//
// This is the measurement lane that works regardless of platform APIs. Reach
// and engagement have to be read back from each platform — and today none of
// them will tell us: the Facebook token would need `read_insights` for
// impressions and `pages_read_user_content` for reactions, and neither is
// granted. UTM parameters sidestep that entirely by measuring at the
// destination we own instead of at the platform.
//
// That matters beyond convenience. The strategy's kill criteria are "zero
// signal after 3 months of consistent posting", and a click that lands on our
// own site is the signal that survives however a platform feels about sharing
// its numbers.
//
// Applied at delivery, not when the copy is written: the stored text and the
// review message stay readable, and a link only grows parameters at the moment
// it becomes channel-specific.

export interface UtmContext {
  /** Channel id — becomes utm_source, so Telegram and Facebook are separable. */
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
