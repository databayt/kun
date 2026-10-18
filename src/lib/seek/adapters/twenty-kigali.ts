import type { SeekItem } from "../item";
import type { SeekAdapter } from "./types";
import { link, markdown, recordUrl, splitName } from "./twenty";

// The jobs board (Twenty object kigaliOpportunity). Mirrors BoardRow in
// scripts/seek/board.ts — kept structural so this file has no script imports.
export interface KigaliRow {
  id: string;
  name: string;
  campaign: string | null;
  tier: string | null;
  engineScore: number | null;
  applicationStatus: string | null;
  deadline: string | null;
  jobUrl?: { primaryLinkUrl?: string } | null;
  assessment?: { markdown?: string } | null;
  applyUrl: string | null;
  channel: string | null;
  appliedAt: string | null;
  lastTouchAt: string | null;
  touchNumber: number | null;
  holdReason: string | null;
  remoteType?: string | null;
  country?: string | null;
  city?: string | null;
  track?: string | null;
  updatedAt: string;
}

export const kigaliAdapter: SeekAdapter<KigaliRow> = {
  track: "job",
  toItem(row, instance): SeekItem {
    const { title, org } = splitName(row.name);
    return {
      instance,
      track: "job",
      externalId: row.id,
      lane: row.campaign,
      stage: row.applicationStatus ?? "TO_APPLY",
      tier: row.tier,
      score: row.engineScore,
      title,
      org,
      country: row.country ?? null,
      city: row.city ?? null,
      remote: row.remoteType ?? null,
      channel: row.channel,
      beneficiary: row.track ?? null,
      deadline: row.deadline,
      touch: row.touchNumber,
      appliedAt: row.appliedAt,
      lastTouchAt: row.lastTouchAt,
      holdReason: row.holdReason,
      sourceUrl: link(row.jobUrl) ?? row.applyUrl,
      recordUrl: recordUrl("kigaliOpportunity", row.id),
      notes: markdown(row.assessment),
      updatedAt: row.updatedAt,
    };
  },
};
