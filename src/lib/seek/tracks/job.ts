import { CADENCE_DAYS } from "@/lib/jobs/cadence";
import { REPLY_STATUS } from "@/lib/jobs/reply-classifier";
import type { JobStatus } from "@/lib/jobs/types";
import type { TrackDef } from "./types";

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
};
