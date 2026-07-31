import { DraftAgent } from "@/components/root/social/draft-agent";

/**
 * The agent window. Its conversation — the brief, the queue poll, an answer
 * mid-reveal — lives in the provider, so leaving this page does not lose it.
 */
export default function SocialDraftPage() {
  return <DraftAgent />;
}
