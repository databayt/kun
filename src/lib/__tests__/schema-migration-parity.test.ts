import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Every model in schema.prisma must be created by some migration.
//
// On 2026-08-21 three models — JobOpportunity, JobAssessment and
// EvidenceProfileSnapshot — were added to the schema with no migration file.
// They exist in the shared Neon database anyway, because someone ran
// `prisma db push`, so nothing ever complained. But `package.json` ships
// `db:deploy` as `prisma migrate deploy`: run that against any environment
// built from the migration history and those tables are simply never created,
// and the app fails at its first query. The drift was invisible for three days
// and only surfaced under a deliberate audit.
//
// This test is the thing that would have caught it on the same push. It needs
// no database: it compares model names in the schema against CREATE TABLE
// statements across the migration history, which is enough to catch the shape
// the bug actually took — a model that no migration creates at all.
//
// It deliberately does NOT try to be a full drift check. Column-level drift
// needs a shadow database (`prisma migrate diff --from-migrations`), which is
// the right tool but not one CI can run for free. Catching "this table is
// created nowhere" is the cheap 90%.

// Known debt, tracked in kun#152. These three landed via `prisma db push` on
// 2026-08-21 and the database already carries them, so the fix is not "add a
// migration" alone — the generated migration must also be marked applied
// (`prisma migrate resolve --applied`) or `db:deploy` will try to create tables
// that exist and fail. That touches the shared production database, so it is
// deliberately a human step. Listing them here keeps the debt visible and lets
// the guard catch the NEXT one immediately. Delete an entry when #152 lands —
// the test fails if an entry here is no longer missing, so the list cannot rot.
const KNOWN_MISSING = [
  "JobOpportunity",
  "JobAssessment",
  "EvidenceProfileSnapshot",
] as const;

const root = fileURLToPath(new URL("../../..", import.meta.url));
const schemaPath = `${root}/prisma/schema.prisma`;
const migrationsDir = `${root}/prisma/migrations`;

function modelsInSchema(): string[] {
  const src = readFileSync(schemaPath, "utf8");
  return [...src.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
}

function tablesCreatedByMigrations(): Set<string> {
  if (!existsSync(migrationsDir)) return new Set();
  const sql = readdirSync(migrationsDir)
    .map((d) => `${migrationsDir}/${d}/migration.sql`)
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  return new Set(
    [...sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([\w.]+)"?/gi)].map(
      (m) => m[1].toLowerCase().replace(/^public\./, ""),
    ),
  );
}

describe("every Prisma model is created by a migration", () => {
  it("has no model that the migration history never creates", () => {
    const models = modelsInSchema();
    const tables = tablesCreatedByMigrations();

    // @@map lets a model use a different table name; read those so a renamed
    // table is not reported as missing.
    const src = readFileSync(schemaPath, "utf8");
    const mapped = new Map<string, string>();
    for (const block of src.split(/^model\s+/m).slice(1)) {
      const name = block.match(/^(\w+)/)?.[1];
      const map = block.match(/@@map\("([^"]+)"\)/)?.[1];
      if (name && map) mapped.set(name, map);
    }

    const missing = models.filter((m) => {
      const table = (mapped.get(m) ?? m).toLowerCase();
      return !tables.has(table);
    });

    const unexpected = missing.filter(
      (m) => !(KNOWN_MISSING as readonly string[]).includes(m),
    );

    expect(
      unexpected,
      unexpected.length
        ? `These models have no CREATE TABLE in prisma/migrations — they were probably applied with \`prisma db push\`. ` +
            `\`prisma migrate deploy\` would not create them on a fresh environment, and the app fails at its first query. ` +
            `Generate the migration and \`prisma migrate resolve --applied\` it (see kun#152). Missing: ${unexpected.join(", ")}`
        : "",
    ).toEqual([]);
  });

  it("keeps the known-debt list honest — no stale entries", () => {
    // If a KNOWN_MISSING model gains its migration, this fails and tells you to
    // shrink the list. Without it the allowlist would quietly outlive the debt
    // and start hiding real drift.
    const models = modelsInSchema();
    const tables = tablesCreatedByMigrations();
    const stale = (KNOWN_MISSING as readonly string[]).filter((m) => {
      if (!models.includes(m)) return true; // model deleted entirely
      return tables.has(m.toLowerCase()); // migration now exists
    });
    expect(
      stale,
      stale.length
        ? `These are no longer missing (or no longer exist). Remove them from KNOWN_MISSING: ${stale.join(", ")}`
        : "",
    ).toEqual([]);
  });

  it("finds a migration history at all, so the check cannot pass vacuously", () => {
    expect(tablesCreatedByMigrations().size).toBeGreaterThan(0);
    expect(modelsInSchema().length).toBeGreaterThan(0);
  });
});
