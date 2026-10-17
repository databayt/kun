// ── Backfill country / city / track on existing board cards ──────────────────
//
//   pnpm jobs:markets            dry run: print what would change
//   pnpm jobs:markets --apply    patch the cards
//
// New cards get these at push time (src/lib/jobs/twenty-crm.ts); this fills
// the cards created before the fields existed (2026-10-03). Only empty fields
// are written, so a hand-set country is never overwritten.

import { marketOf, trackOf } from "@/lib/jobs/markets";

import { listBoard, patchRow } from "./board";

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  const rows = await listBoard();
  const tally: Record<string, number> = {};
  let changed = 0;
  for (const r of rows) {
    const { country, city } = marketOf(
      r.location ?? undefined,
      r.remoteType?.toLowerCase(),
    );
    const patch: Record<string, string> = {};
    if (!r.country) patch.country = country;
    if (!r.city && city) patch.city = city;
    if (!r.track) patch.track = trackOf(r.campaign);
    tally[r.country ?? country] = (tally[r.country ?? country] ?? 0) + 1;
    if (Object.keys(patch).length === 0) continue;
    changed++;
    if (APPLY) await patchRow(r.id, patch);
  }
  console.log(
    `${rows.length} cards · ${changed} ${APPLY ? "patched" : "would change"}`,
  );
  console.log(
    Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} ${n}`)
      .join(" · "),
  );
  if (!APPLY) console.log("DRY RUN — re-run with --apply.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
