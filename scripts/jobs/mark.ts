#!/usr/bin/env tsx
// ── Move one opportunity along the pipeline ──────────────────────────────────
//
//   pnpm jobs:mark <crm-id> applied
//   pnpm jobs:mark <crm-id> interview "Call with Irembo CTO Tue 10:00"
//   pnpm jobs:mark <crm-id> rejected "Needs 5y Kubernetes"
//
// Status is the engine's JobOpportunityStatus (applied, response, screen,
// interview, technical_round, final_round, offer, rejected, withdrawn). The CRM
// board and the Neon row move together; a board-only record (added by hand in
// Twenty) moves on the board alone.

import {
  crmStatusFor,
  updateTwentyApplicationStatus,
} from "@/lib/jobs/twenty-crm";
import type { JobOpportunityStatus } from "@/generated/prisma/client";

import { openDb } from "./engine";

/// Prod Neon's JobOpportunityStatus enum holds 9 of the schema's 18 values —
/// the models exist without the migration that would have grown it (kun#152).
/// Until that migration lands, store the nearest value the database accepts;
/// the board keeps the precise status.
const NEON_SAFE: Record<string, JobOpportunityStatus> = {
  needs_review: "analyzed",
  preparing: "qualified",
  ready_to_apply: "qualified",
  response: "applied",
  screen: "interview",
  technical_round: "interview",
  final_round: "interview",
  withdrawn: "archived",
  ghosted: "archived",
};

function neonStatus(status: string): JobOpportunityStatus {
  return NEON_SAFE[status] ?? (status as JobOpportunityStatus);
}

async function main(): Promise<void> {
  const [crmId, status, ...rest] = process.argv.slice(2);
  const note = rest.join(" ") || undefined;

  if (!crmId || !status || !crmStatusFor(status)) {
    console.error(
      "usage: pnpm jobs:mark <crm-id> <applied|response|interview|offer|rejected|withdrawn> [note]",
    );
    process.exit(1);
  }

  const crm = await updateTwentyApplicationStatus(crmId, status, note);
  console.log(crm.ok ? `✓ board: ${crm.message}` : `✗ board: ${crm.message}`);

  const db = openDb();
  const { count } = await db.jobOpportunity.updateMany({
    where: { twentyOpportunityId: crmId },
    data: { status: neonStatus(status) },
  });
  console.log(
    count
      ? `✓ engine: ${count} row → ${status}`
      : "· engine: no Neon row for this record (board-only)",
  );
  await db.$disconnect();

  if (!crm.ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
