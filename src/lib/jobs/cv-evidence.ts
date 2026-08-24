// ── CV-sourced evidence: the engineering track the repositories cannot prove ──
//
// The evidence extractor reads github.com/databayt and can therefore only ever
// prove software. Osman's other twelve years — protection & testing engineering
// at ALFALGI since Feb 2022, and marine Electro-Technical Officer work from
// 2014 to 2021 — leave no artifact in a package.json, so they entered the
// profile nowhere and the matcher scored a 33 kV substation posting at 48%.
//
// This module is that missing channel. `SourceType` and `ExtractionMethod`
// already admitted "manual" (types.ts:18-25); nothing had ever emitted it.
//
// Source of truth: jobs/cv/protection.html, jobs/cv/web.html, jobs/INVENTORY.md.
// The CV PDFs themselves stay in the gitignored jobs/ directory — personal
// documents. What lives here is the extracted claim, not the document.

import {
  CapabilityInference,
  EvidenceFact,
  MarketPositioningRole,
  TechnologySkillFact,
} from "./types";

/// Facts carry a `repositoryId` because the type was written for repo evidence.
/// CV facts use these two pseudo-ids so provenance stays legible in the dossier.
const CV_PROTECTION_SOURCE = "cv-protection-engineer";
const CV_MARINE_SOURCE = "cv-marine-eto";

/// Fixed rather than `new Date()`: the profile is cached and compared by
/// fingerprint, and a moving timestamp would churn it on every rebuild.
const CV_EXTRACTED_AT = "2026-08-23T00:00:00.000Z";

const fact = (
  f: Omit<EvidenceFact, "sourceType" | "extractionMethod" | "freshness" | "extractedAt">,
): EvidenceFact => ({
  ...f,
  sourceType: "manual",
  extractionMethod: "manual",
  freshness: "fresh",
  extractedAt: CV_EXTRACTED_AT,
});

// ── Layer A: observable facts ────────────────────────────────────────────────

export const CV_EVIDENCE_FACTS: EvidenceFact[] = [
  fact({
    id: "cv-alfalgi-sec-north",
    repositoryId: CV_PROTECTION_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "Protection relay testing and commissioning on SEC / NORTH 33/13.8 kV substations: schema verification, overcurrent, directional, line differential, distance, sync check, transducer, CT, VT, MFM, functional check, VCB, SCADA and battery charger.",
    rawProof: "ALFALGI Contracting, Feb 2022 – present · SEC / NORTH (33/13.8 kV)",
    evidenceWeight: "deep_production_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-alfalgi-sec-jubail",
    repositoryId: CV_PROTECTION_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "Protection testing on SEC / JUBAIL 33/13.8 kV: schema, overcurrent, distance protection, transducer and CT verification.",
    rawProof: "ALFALGI Contracting · SEC / JUBAIL (33/13.8 kV)",
    evidenceWeight: "deep_production_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-alfalgi-swcc-jubail",
    repositoryId: CV_PROTECTION_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "SWCC / JUBAIL 33/13.8 kV desalination plant: overcurrent, primary injection, VCB, auxiliary relays, cable VLF partial-discharge and tan-delta diagnostics, MFM, CT and VT.",
    rawProof: "ALFALGI Contracting · SWCC / JUBAIL (33/13.8 kV)",
    evidenceWeight: "deep_production_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-alfalgi-eeic-schem",
    repositoryId: CV_PROTECTION_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "EEIC / S-CHEM petrochemical plant 13.8/4.16 kV: busbar contact-resistance measurement, CT, VT, MFM, schema verification and motor control centre testing.",
    rawProof: "ALFALGI Contracting · EEIC / S-CHEM (13.8/4.16 kV)",
    evidenceWeight: "deep_production_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-alfalgi-albaha-kap",
    repositoryId: CV_PROTECTION_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "AL BAHA / KAP C2 13.8/4.16 kV: medium-voltage cable diagnostics — VLF withstand, partial discharge and tan-delta measurement.",
    rawProof: "ALFALGI Contracting · AL BAHA / KAP C2 (13.8/4.16 kV)",
    evidenceWeight: "deep_production_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-test-equipment-bench",
    repositoryId: CV_PROTECTION_SOURCE,
    artifactType: "configuration",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "Hands-on across the OMICRON and Megger test bench: CPC 100, CMC 500, CT Analyzer, EGIL, FREJA 360, SVERKER 760, B10E, ODEN, DLRO 600, TDPD60, HVA60, TTR 300 and MOM 200.",
    rawProof: "EQUIPMENT section, protection CV",
    evidenceWeight: "deep_production_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-marine-eto-service",
    repositoryId: CV_MARINE_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "Seven years as Electro-Technical Officer at sea (2014–2021) across four shipping lines — Sudan, Iraq, Marmar and Massi — covering main engine, auxiliary engines, boiler, switchboards, distribution boards, SCADA and fire alarm systems.",
    rawProof: "2014 – 2021, Electro-Technical Officer in Marine",
    evidenceWeight: "deep_production_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-marine-stcw",
    repositoryId: CV_MARINE_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/INVENTORY.md",
    claim:
      "STCW-certified seafarer: Sudanese Seafarer's Identity and Record Book (Port Sudan, 2014) and STCW Reg. A-V/2.4 crowd management training (Maritime Safety Center, Port Sudan, Jan 2019).",
    rawProof: "Figma document archive — IMG_2359 (seaman's book), IMG_2327 (STCW cert. 5-117)",
    evidenceWeight: "surface_manifest_proof",
    confidence: "high",
  }),
  fact({
    id: "cv-education-bsc-ee",
    repositoryId: CV_PROTECTION_SOURCE,
    artifactType: "documentation",
    artifactPath: "jobs/cv/Osman_Abdout_Protection_Engineer.pdf",
    claim:
      "BSc in Electrical Engineering, Arab Academy, Egypt (Jul 2013); registered with the Saudi Council of Engineers.",
    rawProof: "EDUCATION section, both CV variants",
    evidenceWeight: "surface_manifest_proof",
    confidence: "high",
  }),
];

const byId = (...ids: string[]): EvidenceFact[] =>
  CV_EVIDENCE_FACTS.filter((f) => ids.includes(f.id));

const protectionFacts = CV_EVIDENCE_FACTS.filter((f) => f.repositoryId === CV_PROTECTION_SOURCE);
const marineFacts = CV_EVIDENCE_FACTS.filter((f) => f.repositoryId === CV_MARINE_SOURCE);
const industrialFacts = CV_EVIDENCE_FACTS.filter((f) =>
  ["cv-alfalgi-eeic-schem", "cv-alfalgi-albaha-kap", "cv-test-equipment-bench"].includes(f.id),
);

// ── Layer B: capability inferences ───────────────────────────────────────────

export const CV_CAPABILITIES: CapabilityInference[] = [
  {
    id: "cap-protection-testing",
    name: "Protection Relay Testing & Substation Commissioning",
    category: "Power Systems",
    level: "Expert",
    description:
      "End-to-end testing and commissioning of protection schemes on 33/13.8 kV and 13.8/4.16 kV networks — relay settings and functional checks, primary and secondary injection, instrument transformer verification, and SCADA point-to-point.",
    reasoning:
      "Four consecutive years of utility and industrial substation work for Saudi Electricity Company, SWCC and EEIC, each with a distinct voltage class and protection scope, executed on a full OMICRON and Megger bench.",
    confidence: "high",
    supportingFactIds: protectionFacts.map((f) => f.id),
    facts: protectionFacts,
  },
  {
    id: "cap-industrial-electrical",
    name: "Industrial & Plant Electrical Engineering",
    category: "Power Systems",
    level: "Advanced",
    description:
      "Medium- and low-voltage plant electrical work: switchgear, motor control centres, busbar systems, cable diagnostics and instrumentation across petrochemical, desalination and utility sites.",
    reasoning:
      "S-CHEM petrochemical and KAP C2 scopes are plant electrical rather than grid protection — MCC, busbar CRM and cable VLF/PD/TD — and transfer directly to mining, cement and brewery plant work.",
    confidence: "high",
    supportingFactIds: industrialFacts.map((f) => f.id),
    facts: industrialFacts,
  },
  {
    id: "cap-marine-electrotechnical",
    name: "Marine Electro-Technical Officer",
    category: "Marine",
    level: "Expert",
    description:
      "Shipboard electrical and control responsibility: main and auxiliary engine electrics, boiler controls, main switchboards and distribution, engine-room SCADA, and fire alarm and safety systems.",
    reasoning:
      "Seven years of sea service as the sole electro-technical officer across four shipping lines, STCW-certified, with a Sudanese seaman's book on record.",
    confidence: "high",
    supportingFactIds: marineFacts.map((f) => f.id),
    facts: marineFacts,
  },
];

// ── Layer C: market positioning ──────────────────────────────────────────────

export const CV_POSITIONING_ROLES: MarketPositioningRole[] = [
  {
    title: "Protection & Testing Engineer",
    justification:
      "Four years of continuous 33/13.8 kV protection testing and commissioning for SEC, SWCC and EEIC, executed on OMICRON CPC 100 / CMC 500 and the Megger FREJA / SVERKER / EGIL bench.",
    readinessScore: 94,
    supportingCapabilityIds: ["cap-protection-testing", "cap-industrial-electrical"],
    strongestProjectProofs: ["SEC / NORTH", "SWCC / JUBAIL", "EEIC / S-CHEM"],
  },
  {
    title: "Marine Electro-Technical Officer",
    justification:
      "Seven years of sea service as ETO across four shipping lines — main and auxiliary engines, boiler, switchboards, SCADA and fire alarm — STCW-certified with a seaman's record book.",
    readinessScore: 90,
    supportingCapabilityIds: ["cap-marine-electrotechnical", "cap-industrial-electrical"],
    strongestProjectProofs: ["Sudan Shipping Line", "Marmar Shipping Line", "Massi Shipping Line"],
  },
  {
    title: "Electrical / E&I Engineer (Industrial Plant)",
    justification:
      "Plant-side scope from the petrochemical and desalination projects — MCC, busbar, switchgear, cable diagnostics and instrumentation — on a BSc in Electrical Engineering and Saudi Council of Engineers registration.",
    readinessScore: 88,
    supportingCapabilityIds: ["cap-industrial-electrical", "cap-protection-testing"],
    strongestProjectProofs: ["EEIC / S-CHEM", "AL BAHA / KAP C2"],
  },
];

// ── Technologies ─────────────────────────────────────────────────────────────
//
// NAMING IS LOAD-BEARING. The matcher tests
// `t.includes(req) || req.includes(t.split(" ")[0])` (matcher.ts:166), so each
// name's FIRST WORD is a live wildcard against every required skill. Two traps:
//   • a name containing "maintenance" or "repair" swallows the bare skill "AI"
//   • a name starting "Systems" or "Embedded" neutralises the hard blockers
//     that the C++ / bare-metal golden scenarios depend on
// The categories below also partition these out of the software lane entirely
// (see lanes.ts) — belt as well as braces.

export const CV_TECHNOLOGY_SKILLS: TechnologySkillFact[] = [
  // Three broad entries first. Postings phrase the requirement generically far
  // more often than they name a test set — "Electrical engineering", "Power
  // distribution", "Testing and commissioning" — and without these the narrow
  // equipment names below match almost nothing.
  {
    name: "Electrical Engineering (BSc, Saudi Council of Engineers)",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: byId("cv-education-bsc-ee"),
  },
  {
    name: "Power Distribution & Networks",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: protectionFacts,
  },
  {
    name: "Testing, Commissioning & Diagnostics",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: protectionFacts,
  },
  {
    name: "Protection Relays & Coordination",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: protectionFacts,
  },
  {
    name: "Substation Testing & Commissioning",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: protectionFacts,
  },
  {
    name: "CT/VT & Instrument Transformers",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: protectionFacts,
  },
  {
    name: "OMICRON Test Sets (CPC 100, CMC 500, CT Analyzer)",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: byId("cv-test-equipment-bench"),
  },
  {
    name: "Megger Test Sets (FREJA, SVERKER, EGIL, DLRO, TTR)",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: byId("cv-test-equipment-bench"),
  },
  {
    name: "Cable Diagnostics (VLF, Partial Discharge, Tan Delta)",
    category: "Power Systems",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: industrialFacts,
  },
  {
    name: "SCADA & Grid Telemetry",
    category: "Power Systems",
    level: "Proficient",
    depth: "deep_production_proof",
    facts: byId("cv-alfalgi-sec-north", "cv-marine-eto-service"),
  },
  {
    name: "MV/LV Switchgear & Distribution",
    category: "Industrial & Plant",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: industrialFacts,
  },
  {
    name: "Industrial Instrumentation & MCC",
    category: "Industrial & Plant",
    level: "Proficient",
    depth: "deep_production_proof",
    facts: industrialFacts,
  },
  {
    name: "Motors, Drives & Rotating Plant",
    category: "Industrial & Plant",
    level: "Proficient",
    depth: "surface_manifest_proof",
    facts: industrialFacts,
  },
  {
    name: "Marine Engine & Boiler Auxiliaries",
    category: "Marine",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: marineFacts,
  },
  {
    name: "Switchboards & Distribution Boards",
    category: "Marine",
    level: "Deep Production",
    depth: "deep_production_proof",
    facts: marineFacts,
  },
  {
    name: "Fire Alarm & Vessel Safety Systems",
    category: "Marine",
    level: "Proficient",
    depth: "deep_production_proof",
    facts: marineFacts,
  },
  {
    name: "STCW Certification & Sea Service",
    category: "Marine",
    level: "Proficient",
    depth: "surface_manifest_proof",
    facts: byId("cv-marine-stcw"),
  },
];

/// Every category that exists only because of the CV. `lanes.ts` uses this to
/// keep the software lane's verified stack byte-identical to what it was.
export const CV_TECHNOLOGY_CATEGORIES: ReadonlySet<TechnologySkillFact["category"]> = new Set([
  "Power Systems",
  "Industrial & Plant",
  "Marine",
]);
