#!/usr/bin/env node
// ── Organize the Databayt (sales) workspace boards ───────────────────────────
//
//   node scripts/crm-organize.mjs --dry-run   print the plan, write nothing
//   node scripts/crm-organize.mjs             apply it
//
// The crm-*-object.mjs scripts create objects and fields; Twenty then shows
// every field as a column, in creation order, unsorted — 32 columns on Jobs,
// fingerprints and createdBy included — and gives no pipeline view. This
// declares how each board reads instead: which columns, in what order, the
// default sort, and the kanban / filtered views the work actually runs on.
//
// Metadata only — labels, icons, views. Never renames an API name or a SELECT
// value: the jobs loop, funding and leads scripts address those directly.
// Idempotent: reads what exists, patches drift, creates views only by name.

import {
  metadataRows,
  twentyGet,
  twentyKey,
  twentyPatch,
  twentyPost,
} from "./lib/twenty-rest.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Object + relation labels ─────────────────────────────────────────────────
// kigaliOpportunity's singular was "Opportunity" — the same word as the stock
// sales object, so search and the command menu showed two "Opportunity" kinds.

const OBJECT_PATCHES = {
  kigaliOpportunity: {
    labelSingular: "Job",
    icon: "IconBriefcase",
    description:
      "Jobs, gigs, contracts and tenders across Rwanda, Kenya, Nigeria, the Gulf (remote) and Sudan, fed by the Kun Job Engine. The loop's control surface: HOLD = needs Abdout, QUEUED = sending after the veto window. API name stays kigaliOpportunity so every caller keeps working.",
  },
};

const FIELD_PATCHES = {
  kigaliOpportunity: {
    campaign: { description: "Which job-search lane this belongs to." },
  },
  company: {
    kigali: { label: "Jobs", icon: "IconBriefcase", description: "Jobs and tenders at this organisation." },
    funding: { label: "Funding Programs", description: "Programs this organisation runs." },
  },
};

// ── Board layouts ────────────────────────────────────────────────────────────
// `columns` = visible, in order ([name, width]); every other field is hidden.
// Kanban `groups` = column order; groups listed in `hidden` are collapsed out.

const BOARDS = {
  kigaliOpportunity: {
    index: "All Jobs & Opportunities",
    recordPage: { from: "Kigali Opportunity Record Page Fields", to: "Job Record Page Fields" },
    columns: [
      ["name", 320], ["company", 180], ["applicationStatus", 130], ["campaign", 170],
      ["tier", 150], ["engineScore", 110], ["country", 120], ["city", 120],
      ["channel", 110], ["deadline", 130], ["holdReason", 240], ["appliedAt", 130],
      ["lastTouchAt", 130], ["touchNumber", 90], ["jobUrl", 200],
    ],
    sort: ["engineScore", "DESC"],
    views: [
      {
        name: "Pipeline", type: "KANBAN", icon: "IconLayoutKanban", groupBy: "applicationStatus",
        groups: ["HOLD", "APPROVED", "QUEUED", "TO_APPLY", "APPLIED", "RESPONSE", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"],
        hidden: ["REJECTED", "ARCHIVED"],
        columns: [["name", 0], ["company", 0], ["campaign", 0], ["engineScore", 0], ["deadline", 0], ["holdReason", 0]],
        sort: ["engineScore", "DESC"],
      },
      {
        name: "Needs me", type: "TABLE", icon: "IconAlertTriangle",
        filter: ["applicationStatus", ["HOLD"]],
        columns: [["name", 320], ["company", 180], ["holdReason", 360], ["channel", 110], ["engineScore", 110], ["deadline", 130], ["jobUrl", 200]],
        sort: ["engineScore", "DESC"],
      },
      {
        name: "In play", type: "TABLE", icon: "IconMessageReply",
        filter: ["applicationStatus", ["APPLIED", "RESPONSE", "INTERVIEW", "OFFER"]],
        columns: [["name", 320], ["company", 180], ["applicationStatus", 130], ["appliedAt", 130], ["lastTouchAt", 130], ["touchNumber", 90], ["responseAt", 130], ["channel", 110]],
        sort: ["appliedAt", "DESC"],
      },
    ],
  },

  fundingProgram: {
    index: "All Funding & Programs",
    columns: [
      ["name", 300], ["company", 180], ["status", 130], ["programType", 130],
      ["beneficiary", 120], ["amountUsd", 130], ["equity", 120], ["ladderRung", 100],
      ["deadline", 130], ["cohortStart", 130], ["country", 120], ["programUrl", 200],
    ],
    sort: ["ladderRung", "ASC"],
    views: [
      {
        name: "Pipeline", type: "KANBAN", icon: "IconLayoutKanban", groupBy: "status",
        groups: ["TO_REVIEW", "ELIGIBLE", "PREPARING", "SUBMITTED", "INTERVIEW", "ACCEPTED", "CLAIMED", "REJECTED", "NOT_ELIGIBLE"],
        hidden: ["REJECTED", "NOT_ELIGIBLE"],
        columns: [["name", 0], ["company", 0], ["programType", 0], ["amountUsd", 0], ["deadline", 0]],
        sort: ["deadline", "ASC"],
      },
      {
        name: "By deadline", type: "TABLE", icon: "IconCalendarDue",
        filter: ["status", ["TO_REVIEW", "ELIGIBLE", "PREPARING"]],
        columns: [["name", 300], ["company", 180], ["deadline", 130], ["status", 130], ["programType", 130], ["amountUsd", 130], ["equity", 120], ["applyUrl", 200]],
        sort: ["deadline", "ASC"],
      },
    ],
  },

  websiteLead: {
    index: "All Website Leads",
    columns: [
      ["name", 280], ["stage", 120], ["tier", 80], ["auditScore", 110], ["auditFinding", 140],
      ["offer", 140], ["sector", 130], ["city", 120], ["country", 110], ["website", 200],
      ["phone", 150], ["email", 200], ["touchNumber", 90], ["lastTouchAt", 130],
    ],
    sort: ["auditScore", "DESC"],
    views: [
      {
        name: "Pipeline", type: "KANBAN", icon: "IconLayoutKanban", groupBy: "stage",
        groups: ["DISCOVERED", "AUDITED", "QUALIFIED", "CONTACTED", "REPLIED", "CALL", "PROPOSAL", "WON", "LOST", "DORMANT"],
        hidden: ["LOST", "DORMANT"],
        columns: [["name", 0], ["tier", 0], ["auditFinding", 0], ["offer", 0], ["city", 0]],
        sort: ["auditScore", "DESC"],
      },
      {
        name: "Tier A", type: "TABLE", icon: "IconTrophy",
        filter: ["tier", ["A"]],
        columns: [["name", 280], ["stage", 120], ["auditScore", 110], ["auditFinding", 140], ["offer", 140], ["phone", 150], ["email", 200], ["website", 200], ["city", 120]],
        sort: ["auditScore", "DESC"],
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────

const key = twentyKey("databayt");
if (!key) {
  console.error("No Twenty API key (TWENTY_API_KEY_DATABAYT or Keychain databayt-twenty/databayt).");
  process.exit(1);
}

let failures = 0;
const write = async (label, fn) => {
  if (DRY_RUN) return console.log(`  would ${label}`), null;
  const res = await fn();
  if (!res.ok) {
    failures++;
    console.log(`  ✗ ${label} — ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    return null;
  }
  console.log(`  ✓ ${label}`);
  return res.body?.data ?? res.body;
};

const objectsRes = await twentyGet("/rest/metadata/objects?limit=200", key);
if (!objectsRes.ok) {
  console.error(`Could not read objects: ${objectsRes.status}`);
  process.exit(1);
}
const objects = metadataRows(objectsRes.body);
const byName = Object.fromEntries(objects.map((o) => [o.nameSingular, o]));
const fieldOf = (obj, name) => byName[obj].fields.find((f) => f.name === name);

const loadViews = async () => metadataRows((await twentyGet("/rest/metadata/views?limit=500", key)).body);
let views = await loadViews();

console.log(`${DRY_RUN ? "DRY RUN — " : ""}${objects.length} objects, ${views.length} views\n`);

// ── 1. objects + fields ──────────────────────────────────────────────────────

for (const [obj, patch] of Object.entries(OBJECT_PATCHES)) {
  const live = byName[obj];
  const drift = Object.keys(patch).filter((k) => live[k] !== patch[k]);
  console.log(`object ${obj}`);
  if (drift.length) {
    await write(`PATCH ${drift.join(", ")}`, () =>
      twentyPatch(`/rest/metadata/objects/${live.id}`, Object.fromEntries(drift.map((k) => [k, patch[k]])), key));
  } else console.log("  · current");
}

for (const [obj, fields] of Object.entries(FIELD_PATCHES)) {
  for (const [name, patch] of Object.entries(fields)) {
    const live = fieldOf(obj, name);
    if (!live) { console.log(`  ✗ ${obj}.${name} missing`); failures++; continue; }
    const drift = Object.keys(patch).filter((k) => live[k] !== patch[k]);
    if (!drift.length) { console.log(`field ${obj}.${name} · current`); continue; }
    console.log(`field ${obj}.${name}`);
    await write(`PATCH ${drift.join(", ")}`, () =>
      twentyPatch(`/rest/metadata/fields/${live.id}`, Object.fromEntries(drift.map((k) => [k, patch[k]])), key));
  }
}

// ── 2. views ─────────────────────────────────────────────────────────────────

/// Column visibility + order + width. Fields absent from the view get a
/// viewField; listed ones are shown in order, everything else is hidden.
async function layoutColumns(obj, view, columns) {
  const wanted = new Map(columns.map(([n, w], i) => [fieldOf(obj, n).id, { position: i, size: w }]));
  const existing = new Map((view.viewFields ?? []).map((vf) => [vf.fieldMetadataId, vf]));
  for (const [fieldMetadataId, { position, size }] of wanted) {
    const vf = existing.get(fieldMetadataId);
    const want = { isVisible: true, position, ...(size ? { size } : {}) };
    if (!vf) {
      await write(`add column ${columns[position][0]}`, () =>
        twentyPost("/rest/metadata/viewFields", { viewId: view.id, fieldMetadataId, ...want, size: size || 150 }, key));
    } else if (Object.keys(want).some((k) => vf[k] !== want[k])) {
      await write(`column ${columns[position][0]} → #${position}`, () =>
        twentyPatch(`/rest/metadata/viewFields/${vf.id}`, want, key));
    }
  }
  let tail = columns.length;
  for (const vf of existing.values()) {
    if (wanted.has(vf.fieldMetadataId) || !vf.isVisible) continue;
    const name = byName[obj].fields.find((f) => f.id === vf.fieldMetadataId)?.name;
    await write(`hide ${name}`, () =>
      twentyPatch(`/rest/metadata/viewFields/${vf.id}`, { isVisible: false, position: tail++ }, key));
  }
}

async function layoutSort(obj, view, [field, direction]) {
  const fieldMetadataId = fieldOf(obj, field).id;
  const sorts = view.viewSorts ?? [];
  if (sorts.some((s) => s.fieldMetadataId === fieldMetadataId && s.direction === direction)) return;
  for (const s of sorts) await write(`drop sort`, () => twentyFetchDelete(`/rest/metadata/viewSorts/${s.id}`));
  await write(`sort ${field} ${direction}`, () =>
    twentyPost("/rest/metadata/viewSorts", { viewId: view.id, fieldMetadataId, direction }, key));
}

async function twentyFetchDelete(path) {
  const { twentyFetch } = await import("./lib/twenty-rest.mjs");
  return twentyFetch(path, { method: "DELETE", key });
}

async function layoutGroups(obj, view, spec) {
  const groups = view.viewGroups ?? [];
  const field = fieldOf(obj, spec.groupBy);
  for (const [position, value] of spec.groups.entries()) {
    if (!field.options.some((o) => o.value === value)) continue;
    const isVisible = !(spec.hidden ?? []).includes(value);
    const g = groups.find((x) => x.fieldValue === value);
    if (!g) {
      await write(`group ${value}`, () =>
        twentyPost("/rest/metadata/viewGroups", { viewId: view.id, fieldValue: value, position, isVisible }, key));
    } else if (g.position !== position || g.isVisible !== isVisible) {
      await write(`group ${value} → #${position}${isVisible ? "" : " (hidden)"}`, () =>
        twentyPatch(`/rest/metadata/viewGroups/${g.id}`, { position, isVisible }, key));
    }
  }
}

async function layoutFilter(obj, view, [field, values]) {
  const fieldMetadataId = fieldOf(obj, field).id;
  const value = JSON.stringify(values);
  const live = (view.viewFilters ?? []).find((f) => f.fieldMetadataId === fieldMetadataId);
  if (live?.value === value && live.operand === "IS") return;
  if (live) {
    await write(`filter ${field} = ${values.join("|")}`, () =>
      twentyPatch(`/rest/metadata/viewFilters/${live.id}`, { operand: "IS", value }, key));
  } else {
    await write(`filter ${field} = ${values.join("|")}`, () =>
      twentyPost("/rest/metadata/viewFilters", { viewId: view.id, fieldMetadataId, operand: "IS", value }, key));
  }
}

for (const [obj, board] of Object.entries(BOARDS)) {
  const objectMetadataId = byName[obj].id;
  const mine = () => views.filter((v) => v.objectMetadataId === objectMetadataId);

  console.log(`\n${byName[obj].labelPlural}`);

  if (board.recordPage) {
    const rp = mine().find((v) => v.name === board.recordPage.from);
    if (rp) await write(`rename "${rp.name}" → "${board.recordPage.to}"`, () =>
      twentyPatch(`/rest/metadata/views/${rp.id}`, { name: board.recordPage.to }, key));
  }

  const index = mine().find((v) => v.key === "INDEX");
  console.log(` ${index.name}`);
  await layoutColumns(obj, index, board.columns);
  await layoutSort(obj, index, board.sort);

  for (const [i, spec] of board.views.entries()) {
    let view = mine().find((v) => v.name === spec.name);
    console.log(` ${spec.name} (${spec.type})`);
    if (!view) {
      const created = await write(`create view`, () =>
        twentyPost("/rest/metadata/views", {
          objectMetadataId,
          name: spec.name,
          type: spec.type,
          icon: spec.icon,
          position: i + 1,
          visibility: "WORKSPACE",
          ...(spec.groupBy ? { mainGroupByFieldMetadataId: fieldOf(obj, spec.groupBy).id } : {}),
        }, key));
      if (!created) continue;
      views = await loadViews();
      view = mine().find((v) => v.name === spec.name);
      if (!view) { console.log("  ✗ created view not found on re-read"); failures++; continue; }
    }
    await layoutColumns(obj, view, spec.columns);
    if (spec.sort) await layoutSort(obj, view, spec.sort);
    if (spec.groupBy) await layoutGroups(obj, view, spec);
    if (spec.filter) await layoutFilter(obj, view, spec.filter);
  }
}

console.log(DRY_RUN ? "\nDRY RUN — nothing written." : `\nDone, ${failures} failure(s). Board: https://sales.databayt.org`);
if (failures) process.exit(1);
