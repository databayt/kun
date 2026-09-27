#!/usr/bin/env node
// ── Create the "Kigali" object in the Twenty CRM Databayt workspace ──────────
//
//   node scripts/crm-kigali-object.mjs --dry-run   print payloads, write nothing
//   node scripts/crm-kigali-object.mjs             create what is missing
//
// Why an object rather than Opportunities: Opportunity has `name`, `amount`,
// `closeDate` and a five-value sales `stage`. It cannot hold a campaign, a
// tier, an engine score, a deadline or a job URL — the things a job pipeline is
// actually made of. Sales deals stay in Opportunities; jobs live here.
//
// Idempotent: reads what exists first and creates only the gaps, so a partial
// run can simply be re-run.

import {
  metadataRows,
  recordRows,
  twentyGet,
  twentyKey,
  twentyPatch,
  twentyPost,
  API_URL,
} from "./lib/twenty-rest.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

const OBJECT = {
  nameSingular: "kigaliOpportunity",
  namePlural: "kigaliOpportunities",
  labelSingular: "Opportunity",
  labelPlural: "Jobs & Opportunities",
  icon: "IconMapPin",
  isLabelSyncedWithName: false,
  description:
    "Jobs, gigs, contracts and tenders from Kigali, fed by the Kun Job Engine: Rwanda roles first, then remote, AI-training, freelance, tenders and engineering contracts. The API name stays kigaliOpportunity so every caller keeps working.",
};

const sel = (name, label, color, position) => ({ value: name, label, color, position });

/// Field order here is the order they are created, which is the order they
/// appear in the record view. Identity first, then judgement, then logistics.
const FIELDS = [
  {
    name: "company",
    label: "Company",
    type: "RELATION",
    icon: "IconBuildingSkyscraper",
    description: "The employer or target organisation.",
    relation: {
      targetObjectNameSingular: "company",
      targetFieldLabel: "Kigali",
      targetFieldIcon: "IconMapPin",
      type: "MANY_TO_ONE",
    },
  },
  {
    name: "campaign",
    label: "Campaign",
    type: "SELECT",
    icon: "IconTarget",
    description: "Which job-search lane this belongs to.",
    options: [
      sel("PROTECTION", "Protection Engineer", "blue", 0),
      sel("ELECTRICAL", "Electrical Engineer", "turquoise", 1),
      sel("MARINE_ETO", "Marine ETO", "green", 2),
      sel("WEB_DEVELOPER", "Web Developer — Kigali", "purple", 3),
      sel("REMOTE_WORLDWIDE", "Remote — Worldwide", "orange", 4),
      sel("AI_TRAINING", "AI Training Gigs", "pink", 5),
      sel("FREELANCE", "Freelance Contracts", "sky", 6),
      sel("TENDER", "Tender — Databayt", "red", 7),
      sel("ENGINEERING_CONTRACT", "Engineering Contract", "yellow", 8),
    ],
  },
  {
    name: "tier",
    label: "Tier",
    type: "SELECT",
    icon: "IconTrophy",
    description: "The Job Engine's 5D recommendation.",
    options: [
      sel("HIGH_PRIORITY", "High Priority", "green", 0),
      sel("STRONG_FIT", "Strong Fit", "turquoise", 1),
      sel("PREPARE_AND_APPLY", "Prepare & Apply", "yellow", 2),
      sel("LOW_PROBABILITY", "Low Probability", "gray", 3),
    ],
  },
  {
    name: "engineScore",
    label: "Engine Score",
    type: "NUMBER",
    icon: "IconChartBar",
    description: "5D overall match, 0-100.",
  },
  {
    name: "applicationStatus",
    label: "Status",
    type: "SELECT",
    icon: "IconProgressCheck",
    description: "Where this sits in the application process.",
    options: [
      sel("TO_APPLY", "To apply", "blue", 0),
      sel("APPLIED", "Applied", "purple", 1),
      sel("RESPONSE", "Response", "turquoise", 2),
      sel("INTERVIEW", "Interview", "yellow", 3),
      sel("OFFER", "Offer", "green", 4),
      sel("REJECTED", "Rejected", "red", 5),
      sel("ARCHIVED", "Archived", "gray", 6),
      // The send loop (2026-09-27): QUEUED goes out at the next send window
      // unless a human moves the card; HOLD needs Abdout; APPROVED is his yes.
      sel("QUEUED", "Queued — sends next window", "sky", 7),
      sel("HOLD", "Hold — needs you", "orange", 8),
      sel("APPROVED", "Approved — send", "pink", 9),
    ],
  },
  {
    name: "remoteType",
    label: "Remote Type",
    type: "SELECT",
    icon: "IconWorld",
    options: [
      sel("REMOTE", "Remote", "green", 0),
      sel("HYBRID", "Hybrid", "yellow", 1),
      sel("ONSITE", "Onsite", "blue", 2),
    ],
  },
  {
    name: "employmentType",
    label: "Employment Type",
    type: "SELECT",
    icon: "IconBriefcase",
    options: [
      sel("FULL_TIME", "Full-time", "blue", 0),
      sel("PART_TIME", "Part-time", "turquoise", 1),
      sel("CONTRACT", "Contract", "purple", 2),
      sel("FREELANCE", "Freelance", "orange", 3),
    ],
  },
  {
    name: "location",
    label: "Location",
    type: "TEXT",
    icon: "IconMap",
    description: "For remote rows this carries the timezone constraint.",
  },
  {
    name: "jobUrl",
    label: "Job URL",
    type: "LINKS",
    icon: "IconLink",
    description: "The posting or the direct-approach target page.",
  },
  {
    name: "deadline",
    label: "Deadline",
    type: "DATE_TIME",
    icon: "IconCalendarDue",
    description: "Application closing date where the posting states one.",
  },
  {
    name: "source",
    label: "Source",
    type: "TEXT",
    icon: "IconRoute",
    description: "Where it was found: direct-approach, jobinrwanda, indeed, board, network.",
  },
  {
    name: "fingerprint",
    label: "Fingerprint",
    type: "TEXT",
    icon: "IconFingerprint",
    description:
      "sha256(company:title:remoteType) first 16 chars, from the engine. The dedup key — a re-push skips anything already carrying its fingerprint.",
  },
  {
    name: "assessment",
    label: "Assessment",
    type: "RICH_TEXT",
    icon: "IconFileDescription",
    description: "Role description, required skills, and the engine's reasoning.",
  },
  // ── send-loop state (2026-09-27) — the board, not Neon, carries the loop,
  // which keeps it clear of the prod enum drift in kun#152.
  { name: "applyEmail", label: "Apply Email", type: "TEXT", icon: "IconMail", description: "Where the application goes, as stated on the posting." },
  {
    name: "channel",
    label: "Channel",
    type: "SELECT",
    icon: "IconSend",
    description: "How this one is applied to.",
    options: [
      sel("EMAIL", "Email", "blue", 0),
      sel("PORTAL", "Portal", "purple", 1),
      sel("PLATFORM", "Platform sign-up", "turquoise", 2),
      sel("IN_PERSON", "In person", "green", 3),
      sel("TENDER", "Tender portal", "red", 4),
    ],
  },
  { name: "variant", label: "Variant", type: "TEXT", icon: "IconFlask", description: "CV + letter variant ids used, e.g. cv:web@1 letter:kigali-tech@1." },
  { name: "waveId", label: "Wave", type: "TEXT", icon: "IconWaveSine", description: "The send wave (date) this went out in." },
  { name: "appliedAt", label: "Applied At", type: "DATE_TIME", icon: "IconCalendarCheck" },
  { name: "lastTouchAt", label: "Last Touch", type: "DATE_TIME", icon: "IconCalendarTime" },
  { name: "responseAt", label: "Response At", type: "DATE_TIME", icon: "IconMessageReply" },
  { name: "touchNumber", label: "Touch #", type: "NUMBER", icon: "IconHash", description: "1 = application, 2-3 = follow-ups." },
  { name: "holdReason", label: "Hold Reason", type: "TEXT", icon: "IconAlertTriangle", description: "Why the loop stopped — what Abdout has to supply or decide." },
];

const key = twentyKey("databayt");
if (!key && !DRY_RUN) {
  console.error(
    "No Twenty API key. Expected env TWENTY_API_KEY_DATABAYT or Keychain databayt-twenty/databayt.",
  );
  process.exit(1);
}

console.log(`${DRY_RUN ? "DRY RUN — " : ""}Kigali object → ${API_URL} (Databayt workspace)\n`);

// ── 1. the object ────────────────────────────────────────────────────────────

const objectsRes = await twentyGet("/rest/metadata/objects", key);
if (!objectsRes.ok) {
  console.error(`Could not read objects: ${objectsRes.status}`, JSON.stringify(objectsRes.body).slice(0, 300));
  process.exit(1);
}
const objects = metadataRows(objectsRes.body);
console.log(`${objects.length} objects in the workspace`);

let kigali = objects.find((o) => o.nameSingular === OBJECT.nameSingular);

if (kigali) {
  console.log(`✓ object "${OBJECT.nameSingular}" already exists (${kigali.id})`);
  const drift = ["labelSingular", "labelPlural", "description"].filter((k) => kigali[k] !== OBJECT[k]);
  if (drift.length === 0) {
    console.log("  · labels current\n");
  } else if (DRY_RUN) {
    console.log(`  would PATCH object — ${drift.join(", ")}\n`);
  } else {
    const patch = Object.fromEntries(drift.map((k) => [k, OBJECT[k]]));
    const res = await twentyPatch(`/rest/metadata/objects/${kigali.id}`, patch, key);
    console.log(res.ok ? `  ✓ relabelled — ${drift.join(", ")}\n` : `  ✗ relabel ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}\n`);
  }
} else if (DRY_RUN) {
  console.log(`\nwould POST /rest/metadata/objects`);
  console.log(JSON.stringify(OBJECT, null, 2));
  console.log();
} else {
  const res = await twentyPost("/rest/metadata/objects", OBJECT, key);
  if (!res.ok) {
    console.error(`✗ create object failed ${res.status}:`, JSON.stringify(res.body).slice(0, 600));
    process.exit(1);
  }
  kigali = res.body?.data?.createOneObject ?? res.body?.data ?? res.body;
  console.log(`✓ created object "${OBJECT.labelPlural}" (${kigali.id})\n`);
}

// ── 2. the fields ────────────────────────────────────────────────────────────

const companyObject = objects.find((o) => o.nameSingular === "company");
if (!companyObject) {
  console.error("No `company` object found — cannot wire the relation.");
  process.exit(1);
}

const existingFields = kigali?.fields?.edges?.map((e) => e.node) ?? kigali?.fields ?? [];
const existingFieldNames = new Set(existingFields.map((f) => f.name));

let created = 0;
let present = 0;
let failed = 0;

for (const field of FIELDS) {
  if (existingFieldNames.has(field.name)) {
    present++;
    const live = existingFields.find((f) => f.name === field.name);
    const missing = (field.options ?? []).filter((o) => !(live?.options ?? []).some((l) => l.value === o.value));
    if (missing.length === 0) {
      console.log(`  · ${field.name} — already present`);
      continue;
    }
    // A SELECT only grows: keep every live option (with its id, so existing
    // records keep their value) and append the new ones after it.
    const options = [
      ...live.options,
      ...missing.map((o, i) => ({ ...o, position: live.options.length + i })),
    ];
    if (DRY_RUN) {
      console.log(`  would PATCH ${field.name} — add ${missing.map((o) => o.value).join(", ")}`);
      continue;
    }
    const res = await twentyPatch(`/rest/metadata/fields/${live.id}`, { options }, key);
    console.log(
      res.ok
        ? `  ✓ ${field.name} — added ${missing.map((o) => o.value).join(", ")}`
        : `  ✗ ${field.name} options ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`,
    );
    if (!res.ok) failed++;
    continue;
  }

  const payload = {
    objectMetadataId: kigali?.id ?? "<object-id>",
    type: field.type,
    name: field.name,
    label: field.label,
    icon: field.icon,
    isLabelSyncedWithName: false,
    ...(field.description ? { description: field.description } : {}),
    ...(field.options ? { options: field.options } : {}),
    ...(field.relation
      ? {
          relationCreationPayload: {
            targetObjectMetadataId: companyObject.id,
            targetFieldLabel: field.relation.targetFieldLabel,
            targetFieldIcon: field.relation.targetFieldIcon,
            type: field.relation.type,
          },
        }
      : {}),
  };

  if (DRY_RUN) {
    console.log(`  would POST /rest/metadata/fields — ${field.name} (${field.type})`);
    console.log(`    ${JSON.stringify(payload).slice(0, 220)}…`);
    continue;
  }

  const res = await twentyPost("/rest/metadata/fields", payload, key);
  if (res.ok) {
    created++;
    console.log(`  ✓ ${field.name} (${field.type})`);
  } else {
    failed++;
    console.log(`  ✗ ${field.name} (${field.type}) — ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`);
  }
}

if (DRY_RUN) {
  console.log(`\nDRY RUN — nothing written. ${FIELDS.filter((f) => !existingFieldNames.has(f.name)).length} fields would be created.`);
  process.exit(0);
}

console.log(`\nFields: ${created} created, ${present} already present, ${failed} failed.`);

// ── 3. read it back ──────────────────────────────────────────────────────────

const check = await twentyGet(`/rest/${OBJECT.namePlural}?limit=1`, key);
console.log(
  check.ok
    ? `✓ GET /rest/${OBJECT.namePlural} → ${check.status}, ${recordRows(check.body, OBJECT.namePlural).length} records (total ${check.body?.totalCount ?? 0})`
    : `✗ GET /rest/${OBJECT.namePlural} → ${check.status}: ${JSON.stringify(check.body).slice(0, 300)}`,
);
console.log(`\nSidebar: "${OBJECT.labelPlural}" at https://sales.databayt.org`);

if (failed > 0) process.exit(1);
