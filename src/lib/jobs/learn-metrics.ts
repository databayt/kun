// ── Outcome metrics for the learn step ───────────────────────────────────────
//
// Built from the send loop's ledger (jobs/ledger.jsonl), not from Neon: every
// send and every classified reply is a ledger line, so a variant's record is
// exact. Small samples are reported as small (the /measure rule — never a
// confident percentage over three sends).

export interface LedgerLine {
  ts: string;
  kind: string;
  crmId: string;
  campaign?: string | null;
  variant?: string | null;
  waveId?: string | null;
  source?: string | null; // board source, joined at report time
  detail?: string;
}

export interface Outcome {
  key: string;
  sent: number;
  replies: number; // any human reply (not an auto-acknowledgement)
  interviews: number;
  offers: number;
  rejections: number;
  replyRate: number | null; // null below MIN_N
  medianDaysToReply: number | null;
}

export const MIN_N = 5;

const REPLY_KINDS = new Set(["interview", "offer", "rejection", "response"]);

/// `sinceTs` limits the cohort to applications SENT on or after it (the
/// weekly view); their replies count whenever they arrived.
export function summarizeOutcomes(
  lines: LedgerLine[],
  keyOf: (sent: LedgerLine) => string[],
  sinceTs = "",
): Outcome[] {
  const sentBy = new Map<string, LedgerLine>();
  for (const l of lines)
    if (l.kind === "sent" && l.ts >= sinceTs) sentBy.set(l.crmId, l);

  const firstReply = new Map<string, LedgerLine>();
  const kinds = new Map<string, Set<string>>();
  for (const l of lines) {
    if (l.kind !== "reply" || !l.detail) continue;
    const kind = l.detail.split(":")[0];
    if (!REPLY_KINDS.has(kind)) continue;
    if (!firstReply.has(l.crmId)) firstReply.set(l.crmId, l);
    kinds.set(l.crmId, (kinds.get(l.crmId) ?? new Set()).add(kind));
  }

  const groups = new Map<string, string[]>();
  for (const [crmId, s] of sentBy) {
    for (const key of keyOf(s))
      groups.set(key, [...(groups.get(key) ?? []), crmId]);
  }

  return [...groups.entries()]
    .map(([key, ids]) => {
      const replied = ids.filter((id) => firstReply.has(id));
      const days = replied
        .map(
          (id) =>
            (new Date(firstReply.get(id)!.ts).getTime() -
              new Date(sentBy.get(id)!.ts).getTime()) /
            86_400_000,
        )
        .sort((a, b) => a - b);
      const has = (k: string) =>
        ids.filter((id) => kinds.get(id)?.has(k)).length;
      return {
        key,
        sent: ids.length,
        replies: replied.length,
        interviews: has("interview") + has("offer"),
        offers: has("offer"),
        rejections: has("rejection"),
        replyRate: ids.length >= MIN_N ? replied.length / ids.length : null,
        medianDaysToReply: days.length
          ? Math.round(days[Math.floor(days.length / 2)] * 10) / 10
          : null,
      };
    })
    .sort((a, b) => b.sent - a.sent);
}

// A person read it: acks and rejections don't count (every rejection so far
// was an automated ATS template — the 2026-10-27 review).
const HUMAN_KINDS = new Set(["interview", "offer", "response"]);
const DAY = 86_400_000;

/// Interviews (offers included) per rolling 7-day window, oldest first, the
/// last one ending `now`. The Friday report leads with this number.
export function interviewsByWeek(
  lines: LedgerLine[],
  weeks = 4,
  now = Date.now(),
): number[] {
  const out = Array<number>(weeks).fill(0);
  const seen = new Set<string>();
  for (const l of lines) {
    if (l.kind !== "reply" || !l.detail) continue;
    const kind = l.detail.split(":")[0];
    if (kind !== "interview" && kind !== "offer") continue;
    if (seen.has(l.crmId)) continue; // one interview per application
    seen.add(l.crmId);
    const ago = Math.floor((now - new Date(l.ts).getTime()) / (7 * DAY));
    if (ago >= 0 && ago < weeks) out[weeks - 1 - ago]++;
  }
  return out;
}

/// Lanes with `minSent`+ sends and no human reply — the channel isn't
/// reaching a person there. `sinceByLane` restarts a lane's count (its last
/// manual resume), so a lane Abdout resumed isn't paused again next Friday.
export function silentLanes(
  lines: LedgerLine[],
  minSent = 15,
  sinceByLane: Record<string, string> = {},
): { lane: string; sent: number }[] {
  const human = new Set(
    lines
      .filter(
        (l) =>
          l.kind === "reply" && HUMAN_KINDS.has((l.detail ?? "").split(":")[0]),
      )
      .map((l) => l.crmId),
  );
  const lanes = new Map<string, { sent: number; heard: boolean }>();
  for (const l of lines) {
    if (l.kind !== "sent") continue;
    const lane = l.campaign ?? "none";
    if (l.ts < (sinceByLane[lane] ?? "")) continue;
    const s = lanes.get(lane) ?? { sent: 0, heard: false };
    s.sent++;
    s.heard ||= human.has(l.crmId);
    lanes.set(lane, s);
  }
  return [...lanes.entries()]
    .filter(([, s]) => s.sent >= minSent && !s.heard)
    .map(([lane, s]) => ({ lane, sent: s.sent }));
}

export const byVariant = (s: LedgerLine): string[] =>
  (s.variant ?? "none").split(" ");
export const byLane = (s: LedgerLine): string[] => [s.campaign ?? "none"];
export const byWave = (s: LedgerLine): string[] => [s.waveId ?? "none"];
export const bySource = (s: LedgerLine): string[] => [s.source ?? "unknown"];
