// A track is one kind of opportunity the seek loop can chase — a job, a
// scholarship, a university place, a visa, a grant. Every track runs the same
// five beats (discover → tailor → apply → follow up → brief); what changes is
// where the chances are found, which documents each one needs, and which
// replies are worth waking the person for.

export type TrackId = "job" | "scholarship" | "admission" | "visa" | "funding";

export type ArtifactKind =
  | "cv"
  | "cover-letter"
  | "pitch"
  | "proposal"
  | "statement"
  | "form-answers"
  | "document-checklist";

export interface Bilingual {
  en: string;
  ar: string;
}

// Where a stage sits on the console board. Groups are track-agnostic, so the
// same columns, counts and public pulse work for jobs, funding or visas.
export type StageGroup = "inbox" | "needs" | "in_play" | "won" | "lost";

export interface StageDef {
  // The value the source record stores (a CRM SELECT option, a status enum).
  id: string;
  label: Bilingual;
  group: StageGroup;
}

export interface TrackDef {
  id: TrackId;
  // "soon" tracks are declared so the page and skill can name them; the loop
  // only runs "live" ones.
  status: "live" | "soon";
  label: Bilingual;
  summary: Bilingual;
  // Example sources the discover step reads — boards, portals, programme lists.
  sources: string[];
  artifacts: ArtifactKind[];
  // Status order from first sight to the outcome worth celebrating.
  pipeline: readonly string[];
  // Days after applying when a follow-up goes out; the last one archives.
  followUpDays: number[];
  // Statuses that trigger a brief to the person ("you got an interview").
  briefOn: string[];
  // The board stages the console shows, in order. Tracks without a console
  // (still "soon") leave it out.
  stages?: readonly StageDef[];
}
