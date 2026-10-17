import type { TrackDef } from "./types";

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
};
