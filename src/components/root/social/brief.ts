// The composer's settings, written out as a brief the drafting lane can read.
//
// WHY PROSE. `SocialDraftRequest` carries angle, register, reference and model
// as columns, and those are passed as columns — not repeated here. Feature and
// post shape have no column, and adding two is not this pass's job: the brief
// is the documented input ("the brief is the whole input", /docs/social), and
// `content/social/pillars.json` has been carrying exactly this kind of
// direction inside its brief strings since the seed lane shipped.
//
// So the sentence below is deliberately shaped like a pillar brief — the
// subject first, then the qualifiers on their own labelled lines — because
// that is the shape the prompt has been reading for months.
//
// WHAT IT CANNOT DO. A brief assembled from settings alone names a topic and
// nothing else, and the pipeline's own warning applies: "a brief that names
// only a topic gets copy that says only a topic." The writer's own words are
// the first line for that reason, and the Hub says so where the button is.

import {
  POST_TYPE_META,
  type PostType,
} from "@/components/root/social/post-settings";

export interface BriefInput {
  /** What the contributor typed, if anything. The subject, in their words. */
  text: string;
  /** Feature label, already resolved to the reader's language. */
  feature: string | null;
  /** Post shape — how much copy, and what rides with it. */
  postType: PostType;
  /** Channel labels the post is going to. */
  channels: string[];
  /** How many assets are already attached. */
  mediaCount: number;
  /** Visual register, resolved to a label. Null when none is chosen. */
  style: string | null;
}

/**
 * How much copy the shape wants, said as an instruction rather than a label.
 *
 * "Text + image" names a card in a picker; it does not tell a writer that a
 * caption under one still is a different length from a swipe deck's opening
 * panel. `count` and `frame` already encode the difference — this reads them
 * out.
 */
function shapeLine(postType: PostType): string {
  const meta = POST_TYPE_META[postType];
  if (!meta.text) {
    // The one shape where copy is not the point: the asset carries the post.
    return meta.kind === "video"
      ? "Shape: a video with no caption — the asset carries the post. Write nothing longer than a line, and only if it adds something the video cannot say."
      : "Shape: an image with no caption — the asset carries the post. Write nothing longer than a line, and only if it adds something the image cannot say.";
  }
  if (meta.frame === "swipe") {
    return "Shape: a swipe deck. The first panel is the hook and has to stand alone; the caption underneath is short.";
  }
  if (meta.frame === "tall") {
    return "Shape: a tall frame — one thought, a handful of words, read in passing.";
  }
  if (meta.kind === "video") {
    return "Shape: a caption for a video. The hook is spoken in the first seconds, so the caption adds rather than repeats.";
  }
  if (meta.count === "many") {
    return "Shape: one caption over several images. It carries the whole set, not the first picture.";
  }
  if (meta.kind === "none") {
    return "Shape: words alone. Nothing rides with them, so the copy carries the image itself.";
  }
  return "Shape: a caption beside one image.";
}

/**
 * The settings as a brief.
 *
 * Returns null when there is nothing to write about — no words typed and no
 * feature chosen. That is a refusal rather than an empty ask: a brief with no
 * subject produces copy about the brand in general, which is the post nobody
 * reads.
 */
export function composeBrief(input: BriefInput): string | null {
  const typed = input.text.trim();
  if (!typed && !input.feature) return null;

  const lines: string[] = [];

  // The writer's own words lead, always. Everything after is a qualifier on
  // this sentence — put the qualifiers first and the subject reads as an
  // afterthought to its own brief.
  if (typed) lines.push(typed);
  if (input.feature) {
    lines.push(
      typed
        ? `Feature: ${input.feature} — the part of the product this post is about.`
        : `Feature highlight: ${input.feature}. Say what it does for the reader, in the concrete.`,
    );
  }

  lines.push(shapeLine(input.postType));

  if (input.channels.length > 0) {
    lines.push(`Going to: ${input.channels.join(", ")}.`);
  }

  if (input.mediaCount > 0) {
    // Attached media is a constraint on the copy, not decoration: the words
    // must not describe what the reader is already looking at.
    lines.push(
      input.mediaCount === 1
        ? "One asset is already attached — write copy that sits beside it without narrating it."
        : `${input.mediaCount} assets are already attached — write copy that sits beside them without narrating them.`,
    );
  } else if (input.style) {
    // Only when nothing is attached. With assets in hand the register is
    // already decided, and asking for one would describe a picture that is
    // not going to be made.
    lines.push(`Suggested visual: ${input.style.toLowerCase()}.`);
  }

  return lines.join("\n");
}
