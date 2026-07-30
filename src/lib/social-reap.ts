// Recovery for variants stranded in `publishing`.
//
// Both the approval POST and the drain claim `pending/scheduled → publishing`
// BEFORE delivering; a function killed between the claim and the terminal
// write (timeout, OOM, deploy) leaves the row in a state nothing reads. The
// drain reaps those rows on every run.
//
// Why `updatedAt` is the claim time: the only writes that ever touch a
// `publishing` row are the claim (which set the status) and the terminal
// write (which leaves it), and metrics writes touch only `published` rows —
// so for any row STILL in `publishing`, the claim was the last write. Prisma
// maintains @updatedAt on update and updateMany alike, and every writer goes
// through Prisma. No extra column needed on the shared DB.
//
// Residual risk, accepted: a reaped row whose delivery actually landed but
// whose terminal write was lost will republish (once per remaining attempt;
// the approval lane additionally needs a human to press the button again).
// Persisting externalId between deliver and terminal write cannot close that
// window — the crash can precede any write. The threshold guarantees we only
// ever reap dead functions: routes cap at maxDuration 60s, and 30 minutes is
// a 30x margin over that.

/** A publishing row older than this is abandoned, never in-flight. */
export const REAP_AFTER_MS = 30 * 60_000;

export type ReapDecision =
  /** Approval lane — the 12h link is still valid and can be pressed again. */
  | { status: "pending" }
  /** Drain lane with retry budget left — next drain run is the backoff. */
  | { status: "scheduled"; scheduledFor: Date }
  /** Drain lane, budget exhausted. */
  | { status: "failed" };

// Lane discrimination rides on scheduledFor: approval-lane rows are created
// `pending` without one (cron + stageForReview), drain-lane rows are created
// `scheduled` and always carry one. Attempts were already incremented at
// claim time, so the reaper never spends another.
export function reapDecision(
  row: { scheduledFor: Date | null; attempts: number },
  now: Date,
  maxAttempts: number,
): ReapDecision {
  if (row.scheduledFor === null) return { status: "pending" };
  if (row.attempts >= maxAttempts) return { status: "failed" };
  return { status: "scheduled", scheduledFor: now };
}
