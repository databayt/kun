import { CADENCE_DAYS } from "@/lib/jobs/cadence";
import { REPLY_STATUS } from "@/lib/jobs/reply-classifier";
import type { JobStatus } from "@/lib/jobs/types";
import type { StageDef, TrackDef } from "./types";

// The job track is the original job engine (src/lib/jobs) seen through the
// track shape — this file describes it, the lib still implements it.

const pipeline: readonly JobStatus[] = [
  "discovered",
  "qualified",
  "ready_to_apply",
  "applied",
  "response",
  "interview",
  "offer",
];

// The board's applicationStatus values (scripts/crm-kigali-object.mjs) — the
// send loop's own state machine, finer than the engine pipeline above.
const stages: readonly StageDef[] = [
  { id: "TO_APPLY", label: { en: "To apply", ar: "للتقديم" }, group: "inbox" },
  { id: "HOLD", label: { en: "On hold", ar: "معلّق" }, group: "needs" },
  { id: "QUEUED", label: { en: "Queued", ar: "في الطابور" }, group: "needs" },
  { id: "APPROVED", label: { en: "Approved", ar: "معتمد" }, group: "in_play" },
  { id: "APPLIED", label: { en: "Applied", ar: "تم التقديم" }, group: "in_play" },
  { id: "RESPONSE", label: { en: "Response", ar: "رد" }, group: "in_play" },
  { id: "INTERVIEW", label: { en: "Interview", ar: "مقابلة" }, group: "in_play" },
  { id: "OFFER", label: { en: "Offer", ar: "عرض" }, group: "won" },
  { id: "REJECTED", label: { en: "Rejected", ar: "مرفوض" }, group: "lost" },
  { id: "ARCHIVED", label: { en: "Archived", ar: "مؤرشف" }, group: "lost" },
];

export const jobTrack: TrackDef = {
  id: "job",
  status: "live",
  label: { en: "Jobs & gigs", ar: "وظائف وأعمال حرة" },
  summary: {
    en: "Full-time roles, remote contracts, freelance gigs, AI-training work and tenders.",
    ar: "وظائف بدوام كامل، عقود عن بُعد، أعمال حرة، تدريب نماذج الذكاء الاصطناعي، ومناقصات.",
  },
  sources: ["job boards", "company ATS portals", "Google search", "freelance platforms", "tender portals"],
  artifacts: ["cv", "cover-letter", "form-answers", "proposal"],
  pipeline,
  followUpDays: [CADENCE_DAYS.touch2, CADENCE_DAYS.touch3, CADENCE_DAYS.archive],
  // Every reply kind that moves a card is worth a brief.
  briefOn: Object.values(REPLY_STATUS).filter(
    (s): s is string => s !== null && s !== "rejected",
  ),
  stages,
};
