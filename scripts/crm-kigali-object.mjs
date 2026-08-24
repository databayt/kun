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
  twentyPost,
  API_URL,
} from "./lib/twenty-rest.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

const OBJECT = {
  nameSingular: "kigaliOpportunity",
  namePlural: "kigaliOpportunities",
  labelSingular: "Kigali Opportunity",
  labelPlural: "Kigali",
  icon: "IconMapPin",
  isLabelSyncedWithName: false,
  description:
    "Job and opportunity pipeline for the Kigali stay, 31 Aug – 30 Sep 2026, plus the worldwide remote developer lane. Fed by the Kun Job Engine.",
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
    description: "Which of the five job-search lanes this belongs to.",
    options: [
      sel("PROTECTION", "Protection Engineer", "blue", 0),
      sel("ELECTRICAL", "Electrical Engineer", "turquoise", 1),
      sel("MARINE_ETO", "Marine ETO", "green", 2),
      sel("WEB_DEVELOPER", "Web Developer — Kigali", "purple", 3),
      sel("REMOTE_WORLDWIDE", "Remote — Worldwide", "orange", 4),
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
  console.log(`✓ object "${OBJECT.labelPlural}" already exists (${kigali.id})\n`);
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

const existingFieldNames = new Set(
  (kigali?.fields?.edges?.map((e) => e.node) ?? kigali?.fields ?? []).map((f) => f.name),
);

let created = 0;
let present = 0;
let failed = 0;

for (const field of FIELDS) {
  if (existingFieldNames.has(field.name)) {
    present++;
    console.log(`  · ${field.name} — already present`);
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
  console.log(`\nDRY RUN — nothing written. ${FIELDS.length} fields would be created.`);
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
