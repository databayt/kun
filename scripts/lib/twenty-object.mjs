// ── Ensure a custom object + its fields exist in a Twenty workspace ──────────
//
// The shared body of scripts/crm-*-object.mjs. Idempotent: reads what exists
// first and creates only the gaps; a SELECT only grows (live options keep
// their ids, new ones are appended), so a partial run can simply be re-run.

import {
  metadataRows,
  recordRows,
  twentyGet,
  twentyKey,
  twentyPatch,
  twentyPost,
  API_URL,
} from "./twenty-rest.mjs";

export async function ensureObject(
  OBJECT,
  FIELDS,
  {
    workspace = "databayt",
    dryRun = false,
    host = "https://sales.databayt.org",
  } = {},
) {
  const DRY_RUN = dryRun;
  const key = twentyKey(workspace);
  if (!key && !DRY_RUN) {
    console.error(
      "No Twenty API key. Expected env TWENTY_API_KEY_DATABAYT or Keychain databayt-twenty/databayt.",
    );
    process.exit(1);
  }

  console.log(
    `${DRY_RUN ? "DRY RUN — " : ""}${OBJECT.nameSingular} → ${API_URL} (${workspace} workspace)\n`,
  );

  // ── 1. the object ────────────────────────────────────────────────────────────

  const objectsRes = await twentyGet("/rest/metadata/objects", key);
  if (!objectsRes.ok) {
    console.error(
      `Could not read objects: ${objectsRes.status}`,
      JSON.stringify(objectsRes.body).slice(0, 300),
    );
    process.exit(1);
  }
  const objects = metadataRows(objectsRes.body);
  console.log(`${objects.length} objects in the workspace`);

  let target = objects.find((o) => o.nameSingular === OBJECT.nameSingular);

  if (target) {
    console.log(
      `✓ object "${OBJECT.nameSingular}" already exists (${target.id})`,
    );
    const drift = ["labelSingular", "labelPlural", "description"].filter(
      (k) => target[k] !== OBJECT[k],
    );
    if (drift.length === 0) {
      console.log("  · labels current\n");
    } else if (DRY_RUN) {
      console.log(`  would PATCH object — ${drift.join(", ")}\n`);
    } else {
      const patch = Object.fromEntries(drift.map((k) => [k, OBJECT[k]]));
      const res = await twentyPatch(
        `/rest/metadata/objects/${target.id}`,
        patch,
        key,
      );
      console.log(
        res.ok
          ? `  ✓ relabelled — ${drift.join(", ")}\n`
          : `  ✗ relabel ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}\n`,
      );
    }
  } else if (DRY_RUN) {
    console.log(`\nwould POST /rest/metadata/objects`);
    console.log(JSON.stringify(OBJECT, null, 2));
    console.log();
  } else {
    const res = await twentyPost("/rest/metadata/objects", OBJECT, key);
    if (!res.ok) {
      console.error(
        `✗ create object failed ${res.status}:`,
        JSON.stringify(res.body).slice(0, 600),
      );
      process.exit(1);
    }
    target = res.body?.data?.createOneObject ?? res.body?.data ?? res.body;
    console.log(`✓ created object "${OBJECT.labelPlural}" (${target.id})\n`);
  }

  // ── 2. the fields ────────────────────────────────────────────────────────────

  const companyObject = objects.find((o) => o.nameSingular === "company");
  if (!companyObject) {
    console.error("No `company` object found — cannot wire the relation.");
    process.exit(1);
  }

  const existingFields =
    target?.fields?.edges?.map((e) => e.node) ?? target?.fields ?? [];
  const existingFieldNames = new Set(existingFields.map((f) => f.name));

  let created = 0;
  let present = 0;
  let failed = 0;

  for (const field of FIELDS) {
    if (existingFieldNames.has(field.name)) {
      present++;
      const live = existingFields.find((f) => f.name === field.name);
      const missing = (field.options ?? []).filter(
        (o) => !(live?.options ?? []).some((l) => l.value === o.value),
      );
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
        console.log(
          `  would PATCH ${field.name} — add ${missing.map((o) => o.value).join(", ")}`,
        );
        continue;
      }
      const res = await twentyPatch(
        `/rest/metadata/fields/${live.id}`,
        { options },
        key,
      );
      console.log(
        res.ok
          ? `  ✓ ${field.name} — added ${missing.map((o) => o.value).join(", ")}`
          : `  ✗ ${field.name} options ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`,
      );
      if (!res.ok) failed++;
      continue;
    }

    const payload = {
      objectMetadataId: target?.id ?? "<object-id>",
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
      console.log(
        `  would POST /rest/metadata/fields — ${field.name} (${field.type})`,
      );
      console.log(`    ${JSON.stringify(payload).slice(0, 220)}…`);
      continue;
    }

    const res = await twentyPost("/rest/metadata/fields", payload, key);
    if (res.ok) {
      created++;
      console.log(`  ✓ ${field.name} (${field.type})`);
    } else {
      failed++;
      console.log(
        `  ✗ ${field.name} (${field.type}) — ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`,
      );
    }
  }

  if (DRY_RUN) {
    console.log(
      `\nDRY RUN — nothing written. ${FIELDS.filter((f) => !existingFieldNames.has(f.name)).length} fields would be created.`,
    );
    process.exit(0);
  }

  console.log(
    `\nFields: ${created} created, ${present} already present, ${failed} failed.`,
  );

  // ── 3. read it back ──────────────────────────────────────────────────────────

  const check = await twentyGet(`/rest/${OBJECT.namePlural}?limit=1`, key);
  console.log(
    check.ok
      ? `✓ GET /rest/${OBJECT.namePlural} → ${check.status}, ${recordRows(check.body, OBJECT.namePlural).length} records (total ${check.body?.totalCount ?? 0})`
      : `✗ GET /rest/${OBJECT.namePlural} → ${check.status}: ${JSON.stringify(check.body).slice(0, 300)}`,
  );
  console.log(`\nSidebar: "${OBJECT.labelPlural}" at ${host}`);

  if (failed > 0) process.exit(1);
  return target;
}
