// ── Funding & Programs: seed file → the Twenty board ────────────────────────
//
//   pnpm jobs:funding                 dry run: what would be created
//   pnpm jobs:funding --apply         create the missing programs
//   pnpm jobs:funding --due [days]    programs closing within N days (default 14)
//
// jobs/funding.seed.json (gitignored, researched in-session by the `jobs`
// skill's `funding` verb) holds one object per program. The dedup key is the
// fingerprint slug(organisation + name), so a re-run creates nothing and a
// card Abdout has moved keeps its status — the seed never overwrites the board.

import { existsSync, readFileSync } from "node:fs";

import { call } from "./board";

const PATH = "/rest/fundingPrograms";
const SEED = "jobs/funding.seed.json";

export interface FundingSeed {
  name: string;
  organisation: string;
  programType: string;
  country: string;
  city: string | null;
  beneficiary: string;
  equity: string;
  amountUsd: number | null;
  ladderRung: number;
  deadline: string | null;
  cohortStart: string | null;
  status: string;
  eligibility: string;
  programUrl: string;
  applyUrl: string | null;
  source: string;
}

export interface FundingRow {
  id: string;
  name: string;
  status: string | null;
  deadline: string | null;
  programType: string | null;
  country: string | null;
  fingerprint: string | null;
  applyUrl: string | null;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const fingerprintOf = (p: Pick<FundingSeed, "organisation" | "name">) =>
  `${slug(p.organisation)}:${slug(p.name)}`.slice(0, 120);

export async function listFunding(): Promise<FundingRow[]> {
  const rows: FundingRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await call<{
      data: { fundingPrograms: FundingRow[] };
      pageInfo?: { hasNextPage?: boolean; endCursor?: string };
    }>(`${PATH}?limit=60${cursor ? `&starting_after=${cursor}` : ""}`);
    rows.push(...page.data.fundingPrograms);
    if (!page.pageInfo?.hasNextPage || page.data.fundingPrograms.length === 0)
      break;
    cursor = page.pageInfo.endCursor;
  }
  return rows;
}

/// Open programs closing within `days` — the digest's funding line.
export async function fundingDue(days = 14): Promise<FundingRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const open = new Set(["TO_REVIEW", "ELIGIBLE", "PREPARING"]);
  return (await listFunding())
    .filter((r) => r.deadline && open.has(r.status ?? ""))
    .filter(
      (r) =>
        r.deadline!.slice(0, 10) >= today && r.deadline!.slice(0, 10) <= until,
    )
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
}

const iso = (d: string | null) => (d ? `${d}T12:00:00.000Z` : null);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--due")) {
    const days = Number(args[args.indexOf("--due") + 1]) || 14;
    const due = await fundingDue(days);
    console.log(`${due.length} program(s) closing within ${days} days`);
    for (const r of due)
      console.log(
        `  ${r.deadline!.slice(0, 10)}  ${r.name}  [${r.programType} · ${r.country}]  ${r.applyUrl ?? ""}`,
      );
    return;
  }
  if (!existsSync(SEED)) {
    console.error(
      `${SEED} not found — run the jobs skill's \`funding\` verb to research it.`,
    );
    process.exit(1);
  }
  const apply = args.includes("--apply");
  const seed = JSON.parse(readFileSync(SEED, "utf-8")) as FundingSeed[];
  const live = new Set((await listFunding()).map((r) => r.fingerprint));
  let created = 0;
  let present = 0;
  for (const p of seed) {
    const fingerprint = fingerprintOf(p);
    if (live.has(fingerprint)) {
      present++;
      continue;
    }
    live.add(fingerprint);
    console.log(
      `  + [${p.programType} · ${p.country} · ${p.status}] ${p.name} — ${p.organisation}${p.deadline ? ` (closes ${p.deadline})` : ""}`,
    );
    if (!apply) continue;
    await call(PATH, {
      method: "POST",
      body: {
        name: `${p.name} — ${p.organisation}`,
        programType: p.programType,
        status: p.status,
        country: p.country,
        city: p.city,
        beneficiary: p.beneficiary,
        equity: p.equity,
        amountUsd: p.amountUsd,
        ladderRung: p.ladderRung,
        deadline: iso(p.deadline),
        cohortStart: iso(p.cohortStart),
        eligibility: { markdown: p.eligibility, blocknote: null },
        programUrl: {
          primaryLinkUrl: p.programUrl,
          primaryLinkLabel: "",
          secondaryLinks: [],
        },
        applyUrl: p.applyUrl,
        source: p.source,
        fingerprint,
      },
    });
    created++;
  }
  console.log(
    apply
      ? `\nDone: ${created} created, ${present} already on the board.`
      : `\nDRY RUN — ${seed.length - present} would be created, ${present} already there. Re-run with --apply.`,
  );
}

if (process.argv[1]?.endsWith("funding.ts")) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
