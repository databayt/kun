#!/usr/bin/env tsx
// ── Variants: which CV and letter a card gets, and Abdout's yes on new ones ──
//
//   pnpm jobs:variant                     list, with sends per variant
//   pnpm jobs:variant activate <id>       adopt a proposal from the learn step
//   pnpm jobs:variant deactivate <id>     retire one
//
// Two active variants of the same kind for the same lane split 50/50 by send
// count — the fewer-sent one goes next — so a new variant gets a fair test
// against the incumbent. Learn reports the winner; a human decides.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const REGISTRY = "jobs/variants.json";

export interface Variant {
  id: string;
  kind: "cv" | "letter" | "followup1" | "followup2";
  lanes: string[];
  pdf?: string;
  source?: string;
  template?: string;
  active: boolean;
  parent: string | null;
  createdAt: string;
  hypothesis?: string;
}

/// The board stores the CRM select value; variants are keyed by campaign id.
export const CRM_TO_CAMPAIGN: Record<string, string> = {
  PROTECTION: "kigali-protection-engineer",
  ELECTRICAL: "kigali-electrical-engineer",
  MARINE_ETO: "kivu-marine-eto",
  WEB_DEVELOPER: "kigali-web-developer",
  REMOTE_WORLDWIDE: "remote-web-developer-worldwide",
  AI_TRAINING: "ai-training-gigs",
  FREELANCE: "freelance-contracts",
  TENDER: "rwanda-tenders-databayt",
  ENGINEERING_CONTRACT: "engineering-contracts",
};

export function loadVariants(): Variant[] {
  return (
    JSON.parse(readFileSync(REGISTRY, "utf-8")) as { variants: Variant[] }
  ).variants;
}

function saveVariants(variants: Variant[]): void {
  const doc = JSON.parse(readFileSync(REGISTRY, "utf-8")) as Record<
    string,
    unknown
  >;
  writeFileSync(REGISTRY, JSON.stringify({ ...doc, variants }, null, 2) + "\n");
}

export function sendCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  if (!existsSync("jobs/ledger.jsonl")) return counts;
  for (const line of readFileSync("jobs/ledger.jsonl", "utf-8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line) as { kind: string; variant?: string };
    if (e.kind !== "sent" || !e.variant) continue;
    for (const id of e.variant.split(" "))
      counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function pick(
  kind: Variant["kind"],
  lane: string,
  all: Variant[],
  counts: Map<string, number>,
): Variant | undefined {
  const candidates = all.filter(
    (v) =>
      v.active &&
      v.kind === kind &&
      (v.lanes.includes(lane) || v.lanes.includes("*")),
  );
  return candidates.sort(
    (a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0),
  )[0];
}

/// An electrical-expert AI gig wants the engineering CV, not the web one.
export function pickVariants(
  crmCampaign: string | null,
  title: string,
): { lane: string; cv?: Variant; letter?: Variant } {
  const lane = CRM_TO_CAMPAIGN[crmCampaign ?? ""] ?? "kigali-web-developer";
  const all = loadVariants();
  const counts = sendCounts();
  const engineeringTitle =
    /electrical|protection|substation|commissioning|power|hardware|circuit/i.test(
      title,
    );
  const cvLane =
    lane === "ai-training-gigs" && engineeringTitle
      ? "kigali-electrical-engineer"
      : lane;
  return {
    lane,
    cv: pick("cv", cvLane, all, counts),
    letter: pick("letter", lane, all, counts),
  };
}

export function pickFollowUp(touch: 2 | 3): Variant | undefined {
  return pick(
    touch === 2 ? "followup1" : "followup2",
    "*",
    loadVariants(),
    sendCounts(),
  );
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("variants.ts")) {
  const [verb, id] = process.argv.slice(2);
  const all = loadVariants();
  if (verb === "activate" || verb === "deactivate") {
    const v = all.find((x) => x.id === id);
    if (!v) {
      console.error(`no variant "${id}"`);
      process.exit(1);
    }
    v.active = verb === "activate";
    saveVariants(all);
    console.log(`${id} → ${v.active ? "active" : "inactive"}`);
  } else {
    const counts = sendCounts();
    for (const v of all) {
      console.log(
        `${v.active ? "●" : "○"} ${v.id.padEnd(30)} sends ${String(counts.get(v.id) ?? 0).padStart(3)}  ${v.lanes.join(",").slice(0, 60)}${v.hypothesis ? `\n    hypothesis: ${v.hypothesis}` : ""}`,
      );
    }
  }
}
