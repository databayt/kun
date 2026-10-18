import { ReviewPanel } from "@/components/root/social/review";

/**
 * Publish is a review queue: the next answered draft awaiting approval, every
 * upcoming one browsable, and an editor that fine-tunes but never creates.
 * Approve either delivers now or schedules for the cron drain — the settings
 * popover on the panel decides which. Selection and copy live in the provider,
 * so navigating away (say, to attach media in the showroom) and back keeps
 * the draft under review.
 */
export default async function SocialPublishPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  // `?draft=<id>` arrives from the Calendar's "Publish" on a drafted slot.
  const { draft } = await searchParams;
  return (
    <ReviewPanel
      initialDraft={typeof draft === "string" && draft ? draft : undefined}
    />
  );
}
