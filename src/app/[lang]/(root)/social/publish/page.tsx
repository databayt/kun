import { Composer } from "@/components/root/social/composer";

/**
 * Approve, Schedule and Publish are one composer with three buttons, so they
 * are one stage rather than three routes over the same form. The typed copy
 * lives in the provider — navigating away and back keeps it.
 */
export default function SocialPublishPage() {
  return <Composer />;
}
