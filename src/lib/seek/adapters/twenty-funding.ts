import type { SeekItem } from "../item";
import type { SeekAdapter } from "./types";
import { link, markdown, recordUrl } from "./twenty";

// The funding board (Twenty object fundingProgram). Field set from
// scripts/crm-funding-object.mjs; everything optional because older rows
// predate some fields.
export interface FundingProgramRow {
  id: string;
  name: string;
  status: string | null;
  programType?: string | null;
  country?: string | null;
  city?: string | null;
  beneficiary?: string | null;
  amountUsd?: number | null;
  ladderRung?: number | null;
  deadline: string | null;
  programUrl?: { primaryLinkUrl?: string } | null;
  applyUrl?: string | null;
  eligibility?: { markdown?: string } | null;
  company?: { name?: string } | null;
  updatedAt?: string;
  createdAt?: string;
}

export const fundingAdapter: SeekAdapter<FundingProgramRow> = {
  track: "funding",
  toItem(row, instance): SeekItem {
    return {
      instance,
      track: "funding",
      externalId: row.id,
      lane: row.programType ?? null,
      stage: row.status ?? "TO_REVIEW",
      tier: row.ladderRung == null ? null : `RUNG_${row.ladderRung}`,
      score: row.amountUsd ?? null,
      title: row.name,
      org: row.company?.name ?? null,
      country: row.country ?? null,
      city: row.city ?? null,
      remote: null,
      channel: null,
      beneficiary: row.beneficiary ?? null,
      deadline: row.deadline,
      touch: null,
      appliedAt: null,
      lastTouchAt: null,
      holdReason: null,
      sourceUrl: link(row.programUrl) ?? row.applyUrl ?? null,
      recordUrl: recordUrl("fundingProgram", row.id),
      notes: markdown(row.eligibility),
      updatedAt: row.updatedAt ?? row.createdAt ?? new Date(0).toISOString(),
    };
  },
};
