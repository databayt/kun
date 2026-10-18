import type { StageDef, TrackDef } from "./types";

// Declared, not yet running. Each gets a discover adapter and artifact
// templates before its status flips to "live".

const SOON_PIPELINE = ["discovered", "qualified", "ready_to_apply", "applied", "response", "interview", "offer"] as const;

export const scholarshipTrack: TrackDef = {
  id: "scholarship",
  status: "soon",
  label: { en: "Scholarships & fellowships", ar: "منح دراسية وزمالات" },
  summary: {
    en: "Funded study, fellowships and exchange programmes, matched to your field and deadlines.",
    ar: "دراسة ممولة وزمالات وبرامج تبادل، مطابقة لتخصصك ومواعيدك.",
  },
  sources: ["scholarship portals", "university funding pages", "government programmes"],
  artifacts: ["cv", "statement", "document-checklist", "form-answers"],
  pipeline: SOON_PIPELINE,
  followUpDays: [14, 28],
  briefOn: ["interview", "offer"],
};

export const admissionTrack: TrackDef = {
  id: "admission",
  status: "soon",
  label: { en: "University admission", ar: "القبول الجامعي" },
  summary: {
    en: "Programmes that fit your grades and goals, with the statement and documents each one asks for.",
    ar: "برامج تناسب درجاتك وأهدافك، مع خطاب الغرض والمستندات المطلوبة لكل برنامج.",
  },
  sources: ["university programme lists", "application portals"],
  artifacts: ["cv", "statement", "document-checklist", "form-answers"],
  pipeline: SOON_PIPELINE,
  followUpDays: [21, 42],
  briefOn: ["interview", "offer"],
};

export const visaTrack: TrackDef = {
  id: "visa",
  status: "soon",
  label: { en: "Visa & residency", ar: "التأشيرة والإقامة" },
  summary: {
    en: "The permit routes you qualify for, the document checklist, the cover letter and every deadline.",
    ar: "مسارات الإقامة المتاحة لك، وقائمة المستندات، وخطاب التغطية، وكل المواعيد.",
  },
  sources: ["immigration portals", "embassy pages"],
  artifacts: ["cover-letter", "document-checklist", "form-answers"],
  pipeline: SOON_PIPELINE,
  followUpDays: [7, 14],
  briefOn: ["response", "interview", "offer"],
};

// The fundingProgram board's status values (scripts/crm-funding-object.mjs).
// Funding runs on its own board ahead of a discover adapter, so the console
// shows it while the loop still lists it as coming.
const fundingStages: readonly StageDef[] = [
  { id: "TO_REVIEW", label: { en: "To review", ar: "للمراجعة" }, group: "inbox" },
  { id: "ELIGIBLE", label: { en: "Eligible", ar: "مؤهل" }, group: "needs" },
  { id: "PREPARING", label: { en: "Preparing", ar: "قيد التحضير" }, group: "needs" },
  { id: "SUBMITTED", label: { en: "Submitted", ar: "تم التقديم" }, group: "in_play" },
  { id: "INTERVIEW", label: { en: "Interview", ar: "مقابلة" }, group: "in_play" },
  { id: "ACCEPTED", label: { en: "Accepted", ar: "مقبول" }, group: "won" },
  { id: "CLAIMED", label: { en: "Claimed", ar: "تم الاستلام" }, group: "won" },
  { id: "NOT_ELIGIBLE", label: { en: "Not eligible", ar: "غير مؤهل" }, group: "lost" },
  { id: "REJECTED", label: { en: "Rejected", ar: "مرفوض" }, group: "lost" },
];

export const fundingTrack: TrackDef = {
  id: "funding",
  status: "soon",
  label: { en: "Funding & grants", ar: "التمويل والمنح" },
  summary: {
    en: "Grants, accelerators and investors, with a pitch deck and proposal tailored to each call.",
    ar: "منح ومسرّعات ومستثمرون، مع عرض تقديمي ومقترح مفصّل لكل دعوة.",
  },
  sources: ["grant calls", "accelerator programmes", "investor lists"],
  artifacts: ["pitch", "proposal", "form-answers"],
  pipeline: SOON_PIPELINE,
  followUpDays: [7, 21],
  briefOn: ["response", "interview", "offer"],
  stages: fundingStages,
};
