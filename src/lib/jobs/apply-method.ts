// ── applyMethod → the board's channel + applyEmail ────────────────────────────
//
// Scanners write applyMethod as `email:<addr>` | `portal:<url>` |
// `tender-portal:<url>` | `in-person`. The send loop only ever touches EMAIL
// rows with an address, so this parse decides what can go out unattended.

export type Channel = "EMAIL" | "PORTAL" | "PLATFORM" | "IN_PERSON" | "TENDER" | "ATS";

const PLATFORM_HOSTS =
  /mercor\.com|micro1\.ai|mindrift|toloka|alignerr|outlier\.ai|invisible|turing\.com|upwork\.com|contra\.com|mostaql\.com|andela\.com|arc\.dev|toptal\.com/i;

export function parseApplyMethod(method: string | undefined | null): {
  channel?: Channel;
  applyEmail?: string;
  applyUrl?: string;
} {
  if (!method) return {};
  const m = method.trim();
  const email = m.match(/^email:\s*([^\s,;]+@[^\s,;]+)/i);
  if (email) return { channel: "EMAIL", applyEmail: email[1].toLowerCase() };
  // ats:<greenhouse|lever|ashby>:<form url> — a hosted form the submitter fills.
  const ats = m.match(/^ats:(greenhouse|lever|ashby):(https?:\/\/\S+)/i);
  if (ats) return { channel: "ATS", applyUrl: ats[2] };
  if (/^tender-portal:/i.test(m)) return { channel: "TENDER" };
  if (/^in-person/i.test(m)) return { channel: "IN_PERSON" };
  if (/^portal:/i.test(m))
    return { channel: PLATFORM_HOSTS.test(m) ? "PLATFORM" : "PORTAL" };
  return {};
}
