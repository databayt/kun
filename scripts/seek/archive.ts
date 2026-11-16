// ── Bulk-archive board cards by lane ─────────────────────────────────────────
//
//   pnpm jobs:archive --campaign AI_TRAINING,WEB_DEVELOPER          dry run
//   pnpm jobs:archive --campaign AI_TRAINING --status APPLIED,RESPONSE --apply
//
// Written for the 2026-11-16 contracts pivot (66 sends, 0 interviews): the job
// lanes close, and the AI-training platform cards (Mercor, micro1, Meridial)
// that waited five weeks on Abdout's own steps are dropped. A card is archived
// with a dated note, never deleted, so any of it can be reopened from the board.
// Default statuses = not yet sent. INTERVIEW and OFFER are never archived.

import { ledger, listBoard, noteRow, type BoardRow } from "./board";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const list = (v: string | undefined): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const campaigns = list(opt("--campaign"));
const statuses = list(opt("--status") ?? "TO_APPLY,HOLD,QUEUED,APPROVED");
const note =
  opt("--note") ?? "archived — contracts pivot 2026-11-16 (job lanes closed)";
const NEVER = new Set(["INTERVIEW", "OFFER"]);

async function main(): Promise<number> {
  if (campaigns.length === 0) {
    console.error(
      "usage: pnpm jobs:archive --campaign <A,B> [--status S1,S2] [--note text] [--apply]",
    );
    return 2;
  }
  const refused = statuses.filter((s) => NEVER.has(s));
  if (refused.length) {
    console.error(
      `refused: ${refused.join(", ")} — a live interview or offer is never archived in bulk`,
    );
    return 2;
  }
  const rows = await listBoard();
  const hits = rows.filter(
    (r: BoardRow) =>
      campaigns.includes(r.campaign ?? "") &&
      statuses.includes(r.applicationStatus ?? ""),
  );
  const by: Record<string, number> = {};
  for (const r of hits) {
    const k = `${r.campaign} · ${r.applicationStatus}`;
    by[k] = (by[k] ?? 0) + 1;
  }
  console.log(`${APPLY ? "" : "DRY RUN — "}${hits.length} card(s) to archive`);
  for (const [k, n] of Object.entries(by).sort())
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  for (const r of hits.slice(0, 15))
    console.log(`        ${r.applicationStatus} | ${r.name.slice(0, 80)}`);
  if (hits.length > 15) console.log(`        … and ${hits.length - 15} more`);
  if (!APPLY) return 0;

  let done = 0;
  for (const r of hits) {
    try {
      await noteRow(r.id, note, { applicationStatus: "ARCHIVED" });
      ledger({
        kind: "archive",
        crmId: r.id,
        name: r.name,
        campaign: r.campaign,
        detail: note,
      });
      done++;
    } catch (e) {
      console.error(
        `  ✗ ${r.name.slice(0, 60)}: ${(e as Error).message.slice(0, 80)}`,
      );
    }
  }
  console.log(`archived ${done}/${hits.length}`);
  return done === hits.length ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
