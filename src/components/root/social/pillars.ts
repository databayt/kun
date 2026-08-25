// The recurring plan, reachable from the box that publishes.
//
// `content/social/pillars.json` is the seed lane's content plan: the briefs
// the Monday seeder rotates into the draft queue, and what /social/calendar
// renders with this ISO week's picks highlighted. Each one already carries its
// audience, its call to action, its constraint, an angle and a scene — better
// input than anything anyone types into a box in a hurry.
//
// They lived one stage away, behind Queue now, which files an ask and waits
// for the drain. The composer could not reach them at all: its Feature list is
// a different vocabulary (product blocks, from features.json). So the best
// briefs in the system and the field that needed one never met.
//
// Statically imported, the same way features.json is — a commit redeploys the
// plan, and a build of kun has no database to read it from.
//
// NOT a replacement for the Calendar stage. Two questions off one file: the
// calendar answers "what is the plan this week", with rotation picks and queue
// chips; this answers "give me something to post now".

import pillarsData from "../../../../content/social/pillars.json";

export interface PillarBrief {
  id: string;
  /** Which content pillar it serves — feature, trust, open-source, … */
  pillar: string;
  /** The brief itself, verbatim. It is what the ask sends. */
  brief: string;
}

interface RawPillar {
  id?: unknown;
  pillar?: unknown;
  brief?: unknown;
}

/**
 * This brand's briefs, or none.
 *
 * A brand with no entry gets an empty list and the strip does not render —
 * sijillee and moalimee are pre-launch and have no plan yet, and an invented
 * catalogue would be worse than an absence. Same rule features.json follows.
 */
export function pillarsFor(brand: string): PillarBrief[] {
  const raw = (pillarsData as Record<string, unknown>)[brand];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => entry as RawPillar)
    .filter(
      (entry): entry is { id: string; pillar: string; brief: string } =>
        typeof entry.id === "string" &&
        typeof entry.pillar === "string" &&
        typeof entry.brief === "string" &&
        entry.brief.length > 0,
    )
    .map((entry) => ({
      id: entry.id,
      pillar: entry.pillar,
      brief: entry.brief,
    }));
}

/**
 * The half of a brief worth showing on a 150px card.
 *
 * A pillar brief is one long sentence carrying subject, audience, CTA,
 * constraint, angle, scene and register in sequence. The subject is the part
 * that identifies it; the rest is direction the writer reads and the reader
 * does not need. Cut at the first sentence boundary that is not an em-dash
 * clause — "Feature highlight: online admission — parents apply from their
 * phone" reads; the full string does not.
 */
export function pillarSubject(brief: string): string {
  const firstStop = brief.indexOf(". ");
  return firstStop === -1 ? brief : brief.slice(0, firstStop + 1);
}
