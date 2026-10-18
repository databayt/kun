import { DraftAgent } from "@/components/root/social/draft-agent";

/**
 * The agent window. Its conversation — the brief, the queue poll, an answer
 * mid-reveal — lives in the provider, so leaving this page does not lose it.
 * `?slot=<brand>#NNN` arrives from the Calendar's "Write it" and opens the
 * concept card on that slot.
 */
export default async function SocialDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string | string[] }>;
}) {
  const { slot } = await searchParams;
  const initialSlot =
    typeof slot === "string" && /^[a-z]+#\d{3}$/.test(slot) ? slot : undefined;
  return <DraftAgent initialSlot={initialSlot} />;
}
