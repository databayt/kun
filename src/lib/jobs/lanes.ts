// ── Engineering lanes: one matcher, four professions ─────────────────────────
//
// calculateDeterministicMatch used to hardcode four literals that all assumed
// the job was a software job: the verified technology list, the blocker keyword
// ladder, a title test for capability, and a "does the domain say SaaS" test.
// A 33 kV substation posting therefore scored 0/5 on technical, 76 on
// capability, 82 on domain, and came out at 48% — "Low Probability", the
// archive bucket, for the single best structural match in the market.
//
// Those four literals now live here, once per lane. The "software" entry is a
// byte-for-byte copy of what was inlined before, so every existing golden
// scenario stays on exactly the code path it asserts; the other three lanes
// describe the professions the CV proves.
//
// Two independent guards keep the software lane fixed:
//   1. resolveJobLane defaults to "software" and its keywords are specific —
//      never bare "systems", which "Embedded Systems" and "Defense Systems"
//      would otherwise trip.
//   2. techCategories partitions the CV technologies out of the software lane
//      entirely, so its verified stack is the same nine entries even if lane
//      resolution were somehow wrong.

import { NormalizedJobInput, TechnologySkillFact } from "./types";

export type EngineeringLane = "software" | "protection" | "electrical" | "marine";

type TechCategory = TechnologySkillFact["category"];

export interface LaneConfig {
  id: EngineeringLane;
  label: string;
  /// Which technology categories count as verified proof in this lane.
  techCategories: ReadonlySet<TechCategory>;
  /// Keywords routing a job here. Empty for "software" — it is the default.
  laneKeywords: readonly string[];
  /// Unbridgeable requirements: -25 points each, 2 forces "Low Probability".
  hardBlockers: readonly string[];
  /// Real but bridgeable gaps.
  significantGaps: readonly string[];
  significantGapReason: string;
  significantGapMitigation: string;
  learnableGapReason: string;
  learnableGapMitigation: string;
  /// Title keywords earning the high capability score.
  capabilityKeywords: readonly string[];
  capabilityHigh: number;
  capabilityLow: number;
  capabilityHighExplanation: string;
  capabilityLowExplanation: string;
  capabilityFacts: readonly string[];
  /// Domain keywords earning the high domain score.
  domainKeywords: readonly string[];
  domainHigh: number;
  domainLow: number;
  domainExplanation: string;
  domainFacts: readonly string[];
  seniorityExplanation: string;
  seniorityFacts: readonly string[];
  whyDrivers: string;
  assumptions: readonly string[];
  standardRisk: string;
  talkingPoints: readonly string[];
}

const SOFTWARE_TECH_CATEGORIES: ReadonlySet<TechCategory> = new Set([
  "Frontend",
  "Backend",
  "Database",
  "AI / ML",
  "DevOps / Infra",
  "Mobile",
  "Systems",
  "Design",
  "Automation",
]);

const POWER_TECH_CATEGORIES: ReadonlySet<TechCategory> = new Set([
  "Power Systems",
  "Industrial & Plant",
]);

const MARINE_TECH_CATEGORIES: ReadonlySet<TechCategory> = new Set([
  "Marine",
  "Power Systems",
  "Industrial & Plant",
]);

export const LANE_CONFIG: Record<EngineeringLane, LaneConfig> = {
  // ── software ───────────────────────────────────────────────────────────────
  // Every value below was lifted verbatim from matcher.ts. Do not "improve"
  // them: the golden dataset asserts the numbers they produce.
  software: {
    id: "software",
    label: "Software & Product Engineering",
    techCategories: SOFTWARE_TECH_CATEGORIES,
    laneKeywords: [],
    hardBlockers: ["kubernetes", "c++", "embedded", "security clearance"],
    significantGaps: ["aws", "gcp", "docker"],
    significantGapReason:
      "Cloud/DevOps preference where candidate has Vercel/Neon proof but limited direct evidence.",
    significantGapMitigation:
      "Highlight container and cloud deployment familiarity from self-hosted Twenty CRM setup.",
    learnableGapReason: "Secondary library easily mastered on the job.",
    learnableGapMitigation:
      "Reference deep TypeScript/React architecture foundation from Codebase design system.",
    capabilityKeywords: ["full", "next", "react", "ai", "founding", "product"],
    capabilityHigh: 94,
    capabilityLow: 76,
    capabilityHighExplanation:
      "Demonstrated full-stack 0-to-1 builder scope across Hogwarts, Kun, and Codebase.",
    capabilityLowExplanation: "General software engineering capability matches required scope.",
    capabilityFacts: [
      "Hogwarts: Multi-tenant SaaS with PostgreSQL, NextAuth v5, and WhatsApp Evolution API",
      "Codebase: 54 UI primitives and 62 compound atoms conforming to Shadcn registry standards",
      "Kun: AI workflow orchestration and Gemini 2.5 structured schema generation",
    ],
    domainKeywords: ["saas"],
    domainHigh: 95,
    domainLow: 82,
    domainExplanation: "Strong SaaS and product engineering background.",
    domainFacts: ["Education SaaS (Hogwarts)", "Rental Marketplace (Mkan)", "Operations Hub (Kun)"],
    seniorityExplanation:
      "Excellent fit for builder/generalist, founding engineer, or senior full-stack roles.",
    seniorityFacts: [
      "Full-lifecycle ownership from database schema to responsive bilingual frontend.",
    ],
    whyDrivers:
      "direct production evidence in Next.js, React, TypeScript, Prisma, and multi-tenant SaaS architecture",
    assumptions: [
      "Candidate is open to remote or flexible working arrangements.",
      "Role values full-stack product engineering depth.",
    ],
    standardRisk: "Standard systems architecture and scalability interview prep.",
    talkingPoints: [
      "Anchor your discussion on Hogwarts: explain the multi-tenant PostgreSQL schema and Evolution API WhatsApp automation.",
      "Emphasize frontend craftsmanship: reference the 150+ component Shadcn registry built in Codebase.",
      "Highlight AI engineering reliability: describe schema-enforced LLM generation with Zod and error boundaries in Kun.",
    ],
  },

  // ── protection ─────────────────────────────────────────────────────────────
  protection: {
    id: "protection",
    label: "Protection & Testing Engineering",
    techCategories: POWER_TECH_CATEGORIES,
    laneKeywords: [
      "protection relay",
      "protection engineer",
      "protection and control",
      "substation",
      "relay testing",
      "testing and commissioning",
      "grid protection",
      "switchyard",
      "transmission line",
      "high voltage",
      "33kv",
      "33 kv",
      "132kv",
      "11kv",
      "distribution network",
      "utility grid",
    ],
    hardBlockers: ["security clearance"],
    significantGaps: ["iec 61850", "etap", "digsilent", "pscad", "sel ", "abb rel", "siemens siprotec"],
    significantGapReason:
      "Vendor platform or modelling tool not on the verified bench — the discipline is proven, the specific product is not.",
    significantGapMitigation:
      "Four years of relay settings and injection work across SEC, SWCC and EEIC transfers directly; vendor familiarity is days, not months.",
    learnableGapReason: "Adjacent to the proven protection scope and picked up on site.",
    learnableGapMitigation:
      "Reference the OMICRON CPC 100 / CMC 500 and Megger FREJA / SVERKER bench across five projects.",
    capabilityKeywords: [
      "protection",
      "substation",
      "commissioning",
      "testing",
      "relay",
      "scada",
      "grid",
      "high voltage",
    ],
    capabilityHigh: 94,
    capabilityLow: 80,
    capabilityHighExplanation:
      "Four years of continuous 33/13.8 kV protection testing and commissioning across utility, desalination and petrochemical clients.",
    capabilityLowExplanation:
      "Core electrical engineering capability applies; the specific protection scope is narrower than the proven record.",
    capabilityFacts: [
      "SEC / NORTH: overcurrent, directional, line differential, distance, sync check, CT, VT, MFM, VCB, SCADA",
      "SWCC / JUBAIL: primary injection, auxiliary relays, cable VLF PD/TD diagnostics",
      "EEIC / S-CHEM: busbar contact-resistance measurement, MCC, schema verification",
    ],
    domainKeywords: ["energy", "utilit", "power", "grid", "electric", "transmission", "distribution"],
    domainHigh: 95,
    domainLow: 84,
    domainExplanation:
      "Four years inside utility and industrial power networks — the exact domain, not an adjacent one.",
    domainFacts: [
      "Saudi Electricity Company (SEC) — NORTH and JUBAIL regions",
      "Saline Water Conversion Corporation (SWCC) — Jubail",
      "EEIC / S-CHEM petrochemical, AL BAHA / KAP C2",
    ],
    seniorityExplanation:
      "Mid-to-senior protection engineer: independent on site, owns a test scope end to end, reports to client engineers.",
    seniorityFacts: [
      "Sole test engineer across five named projects at three voltage classes.",
      "BSc Electrical Engineering, Saudi Council of Engineers registered.",
    ],
    whyDrivers:
      "four years of 33/13.8 kV protection testing and commissioning on a full OMICRON and Megger bench",
    assumptions: [
      "Role is site-based or rotational rather than purely design-office.",
      "Employer values hands-on testing experience over vendor-specific certification.",
    ],
    standardRisk:
      "Expect questions on relay settings philosophy, coordination studies, and IEC 61850 station bus familiarity.",
    talkingPoints: [
      "Walk through a full SEC / NORTH commissioning: schema verification, then overcurrent, directional, line differential and distance, closing with sync check and SCADA point-to-point.",
      "Use the SWCC cable work to show diagnostic range — VLF withstand plus partial discharge and tan delta on the same circuit, and what each one told you.",
      "Name the bench precisely: CPC 100 and CMC 500 for injection, CT Analyzer for saturation, DLRO 600 and MOM 200 for contact resistance, FREJA and SVERKER as the secondary sets.",
    ],
  },

  // ── electrical ─────────────────────────────────────────────────────────────
  electrical: {
    id: "electrical",
    label: "Industrial & Plant Electrical Engineering",
    techCategories: POWER_TECH_CATEGORIES,
    laneKeywords: [
      "electrical engineer",
      "electrical technician",
      "e&i",
      "electromechanical",
      "switchgear",
      "motor control",
      "mcc",
      "plant electrical",
      "industrial electrical",
      "electrical maintenance",
      "mv/lv",
      "medium voltage",
      "low voltage",
      "biomedical engineer",
      "battery",
      "solar",
      "mini-grid",
      "electrification",
    ],
    hardBlockers: ["security clearance"],
    significantGaps: ["plc programming", "dcs", "autocad", "revit", "hazop", "atex"],
    significantGapReason:
      "Design-office or automation-programming tooling that sits beside, not inside, the proven test-and-commission scope.",
    significantGapMitigation:
      "Point at the S-CHEM MCC and busbar work and the KAP C2 cable diagnostics — plant electrical, executed, not observed.",
    learnableGapReason: "Within reach of the proven plant electrical scope.",
    learnableGapMitigation:
      "Reference MV/LV switchgear, MCC and instrumentation work across petrochemical and desalination sites.",
    capabilityKeywords: [
      "electrical",
      "e&i",
      "maintenance",
      "plant",
      "electromechanical",
      "engineer",
      "technician",
      "instrumentation",
    ],
    capabilityHigh: 92,
    capabilityLow: 80,
    capabilityHighExplanation:
      "Plant-side electrical scope proven at petrochemical and desalination sites: MCC, busbar, switchgear, cable diagnostics and instrumentation.",
    capabilityLowExplanation:
      "Electrical engineering foundation applies; this particular plant scope is adjacent to the proven record.",
    capabilityFacts: [
      "EEIC / S-CHEM 13.8/4.16 kV: busbar CRM, MCC, CT, VT, MFM",
      "AL BAHA / KAP C2: medium-voltage cable VLF, partial discharge and tan delta",
      "BSc Electrical Engineering; Saudi Council of Engineers",
    ],
    domainKeywords: [
      "manufactur",
      "mining",
      "cement",
      "fmcg",
      "industrial",
      "plant",
      "energy",
      "power",
      "utilit",
      "e-mobility",
      "climate",
      "healthcare",
    ],
    domainHigh: 92,
    domainLow: 84,
    domainExplanation:
      "Heavy-industrial and utility plant environments — petrochemical, desalination and grid — across four years.",
    domainFacts: [
      "S-CHEM petrochemical complex (EEIC)",
      "SWCC Jubail desalination",
      "KAP C2 industrial site",
    ],
    seniorityExplanation:
      "Mid-level plant electrical engineer with site autonomy and a testing specialism most maintenance engineers lack.",
    seniorityFacts: [
      "Four years across five industrial and utility projects.",
      "Seven prior years of shipboard electrical responsibility.",
    ],
    whyDrivers:
      "plant electrical evidence — MV/LV switchgear, MCC, busbar and cable diagnostics — from petrochemical and desalination sites",
    assumptions: [
      "Role is site-based maintenance or projects rather than pure design.",
      "Employer values diagnostic and testing depth alongside routine maintenance.",
    ],
    standardRisk:
      "Expect questions on preventive maintenance planning, PLC/automation exposure, and plant-specific process knowledge.",
    talkingPoints: [
      "Lead with the S-CHEM scope: busbar contact-resistance measurement and MCC testing on a live 13.8/4.16 kV petrochemical plant.",
      "Frame the testing specialism as the differentiator — most plant electricians replace, you measure first and know which reading condemns a cable.",
      "Bridge the marine years: seven years of boiler, switchboard and distribution-board responsibility at sea is plant electrical under a different name.",
    ],
  },

  // ── marine ─────────────────────────────────────────────────────────────────
  marine: {
    id: "marine",
    label: "Marine Electro-Technical",
    techCategories: MARINE_TECH_CATEGORIES,
    laneKeywords: [
      // Bare "ship", "boat" and "eto" were tried and removed: "Partner<ship>s"
      // routed the Norrsken developer-network record into the marine lane and
      // cost it 18 points. Keywords here must be words, not fragments.
      "electro-technical",
      "electro technical",
      "marine",
      "maritime",
      "vessel",
      "barge",
      "shipboard",
      "shipping line",
      "seagoing",
      "sea service",
      "engine room",
      "stcw",
      "main engine",
      "auxiliary engine",
      "switchboard",
      "cruise",
      "houseboat",
    ],
    hardBlockers: ["security clearance"],
    significantGaps: ["dynamic positioning", "dp certificate", "refrigeration", "wärtsilä certified", "class survey"],
    significantGapReason:
      "Vessel- or vendor-specific certification beyond the general ETO scope already served.",
    significantGapMitigation:
      "Seven years of sea service covering main engine, auxiliaries, boiler, switchboards and SCADA carries most of the requirement.",
    learnableGapReason: "Adjacent to the proven electro-technical scope.",
    learnableGapMitigation:
      "Reference ETO service across four shipping lines, STCW-certified, with a seaman's record book.",
    capabilityKeywords: [
      "electro",
      "marine",
      "vessel",
      "barge",
      "technician",
      "electrician",
      "engineer",
      "crew",
      "plant",
    ],
    capabilityHigh: 93,
    capabilityLow: 80,
    capabilityHighExplanation:
      "Seven years as the sole electro-technical officer aboard: main and auxiliary engines, boiler, switchboards, SCADA and fire alarm.",
    capabilityLowExplanation:
      "Marine electrical foundation applies; this specific vessel or plant scope is adjacent.",
    capabilityFacts: [
      "Sudan, Iraq, Marmar and Massi Shipping Lines — ETO, 2014 to 2021",
      "Main engine, auxiliary engines, boiler, switchboard, distribution board, SCADA, fire alarm",
      "STCW-certified; Sudanese Seafarer's Identity and Record Book",
    ],
    domainKeywords: ["marine", "maritime", "shipping", "vessel", "energy", "power", "hospitality"],
    domainHigh: 94,
    domainLow: 84,
    domainExplanation:
      "Seven years at sea across four shipping lines — the domain itself, not a transfer from it.",
    domainFacts: [
      "Sudan Shipping Line",
      "Iraq Shipping Line",
      "Marmar and Massi Shipping Lines",
    ],
    seniorityExplanation:
      "Certified ETO with sole electro-technical responsibility aboard — the rank the role asks for.",
    seniorityFacts: [
      "Seven years of continuous sea service across four operators.",
      "Followed by four years of shore-based high-voltage testing.",
    ],
    whyDrivers:
      "seven years of ETO sea service — main and auxiliary engines, boiler, switchboards, SCADA and fire alarm — plus four years of shore-based HV testing",
    assumptions: [
      "Role accepts a seagoing ETO background for a plant or vessel posting.",
      "Seaman's book and STCW certification remain valid or renewable.",
    ],
    standardRisk:
      "Expect questions on specific engine makes, class-survey procedures, and time since last sea service.",
    talkingPoints: [
      "Map the ETO scope onto the role directly: main and auxiliary engine electrics, boiler controls, main switchboard and distribution, engine-room SCADA, fire alarm and safety systems.",
      "The four shore years since add high-voltage testing depth most ETOs never get — 33 kV protection, injection testing, cable diagnostics.",
      "Bring the dossier: seaman's record book, STCW certificates, and sea-service testimonials from all four lines.",
    ],
  },
};

/// Score each lane's keywords across the job text, weighted by where they land:
/// the title is the strongest signal, then the domain, then required skills.
/// Ties and zero-scores fall through to "software" — the safe default, and the
/// reason every existing golden scenario keeps its exact behaviour.
export function resolveJobLane(job: NormalizedJobInput): EngineeringLane {
  const title = job.title.toLowerCase();
  const domain = (job.domain || "").toLowerCase();
  const skills = job.requiredSkills.concat(job.preferredSkills || []).join(" ").toLowerCase();

  let bestLane: EngineeringLane = "software";
  let bestScore = 0;

  for (const lane of ["protection", "electrical", "marine"] as const) {
    let score = 0;
    for (const keyword of LANE_CONFIG[lane].laneKeywords) {
      if (title.includes(keyword)) score += 3;
      if (domain.includes(keyword)) score += 2;
      if (skills.includes(keyword)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLane = lane;
    }
  }

  return bestLane;
}

export function laneConfigFor(job: NormalizedJobInput): LaneConfig {
  return LANE_CONFIG[resolveJobLane(job)];
}
