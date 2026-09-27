// ── Find the address a posting says to apply to ──────────────────────────────
//
// Job boards mark every posting "apply via our form", but many Rwandan
// postings say "send your CV to hr@company.rw" in the body. Those are the
// applications the loop can send itself, so this parse decides the wave size.
//
// Preference: an address within ~160 chars after apply/send/submit/CV/email
// wording; otherwise the only non-board address on the page. Board, platform
// and placeholder addresses never count.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const NOT_APPLY =
  /@(jobinrwanda\.com|greatrwandajobs\.com|example\.(com|org)|domain\.com|email\.com|sentry\.io|wixpress\.com)$|^(noreply|no-reply|info@jobinrwanda|support@|privacy@|webmaster@)|^[^@]*(hotline|ethic|whistle|complain|fraud|safeguard|integrity|dpo|dataprotection)[^@]*@/i;
const CUE = /(apply|application|send|submit|forward|cv|resume|curriculum|e-?mail(ed)? to|addressed to)/gi;

export function extractApplyEmail(text) {
  if (!text) return undefined;
  const all = [...new Set((text.match(EMAIL) ?? []).map((e) => e.replace(/[.,;:]+$/, "").toLowerCase()))].filter(
    (e) => !NOT_APPLY.test(e),
  );
  if (all.length === 0) return undefined;
  for (const cue of text.matchAll(CUE)) {
    const window = text.slice(cue.index, cue.index + 160).toLowerCase();
    const hit = all.find((e) => window.includes(e));
    if (hit) return hit;
  }
  return all.length === 1 ? all[0] : undefined;
}
