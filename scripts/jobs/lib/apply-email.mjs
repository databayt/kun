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

// ── "Send your CV on WhatsApp to +250 78…" ──────────────────────────────────
//
// Only a number the posting ties to BOTH WhatsApp and applying counts — job
// boards print their own "WhatsApp group" and alert numbers on every page.
// Returned as E.164; a local 07… number takes the board's country code, and a
// number we can't place in a country is dropped, never guessed.
const PHONE = /(\+?\d[\d\s().-]{7,18}\d)/g;
const WA_APPLY = /whats\s?app|wa\.me/i;
const APPLY_CUE = /(apply|application|send|submit|share|forward|cv|resume|curriculum)/i;
const NOT_WA_APPLY = /group|channel|join|alert|community|follow us|subscribe/i;

export function extractApplyWhatsApp(text, defaultCC) {
  if (!text) return undefined;
  for (const m of text.matchAll(PHONE)) {
    const around = text.slice(Math.max(0, m.index - 120), m.index + m[0].length + 60);
    if (!WA_APPLY.test(around) || !APPLY_CUE.test(around) || NOT_WA_APPLY.test(around)) continue;
    let n = m[1].replace(/[^\d+]/g, "");
    if (n.startsWith("00")) n = `+${n.slice(2)}`;
    if (!n.startsWith("+")) {
      if (!defaultCC || !/^0\d{9}$/.test(n)) continue;
      n = `+${defaultCC}${n.slice(1)}`;
    }
    if (/^\+\d{10,15}$/.test(n)) return n;
  }
  return undefined;
}
