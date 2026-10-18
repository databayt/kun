import { jobTrack } from "./job";
import { admissionTrack, fundingTrack, scholarshipTrack, visaTrack } from "./soon";
import type { TrackDef, TrackId } from "./types";

export const TRACKS: readonly TrackDef[] = [
  jobTrack,
  scholarshipTrack,
  admissionTrack,
  visaTrack,
  fundingTrack,
];

export function getTrack(id: TrackId): TrackDef {
  const track = TRACKS.find((t) => t.id === id);
  if (!track) throw new Error(`Unknown seek track: ${id}`);
  return track;
}

export type { ArtifactKind, Bilingual, StageDef, StageGroup, TrackDef, TrackId } from "./types";
