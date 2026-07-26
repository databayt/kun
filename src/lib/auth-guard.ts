// The authorization gate shared by every mutating Server Action.
//
// Session presence is not enough: JWT sessions outlive removal from the
// contributors allowlist, so every call re-resolves the email against the
// config at call time rather than trusting a claim minted earlier.
//
// Lives here rather than in one action file so the check cannot drift between
// callers — a guard that exists in one action and not its neighbour is the
// shape most authorization bugs take.

import { auth } from "@/auth";
import { getContributorByEmail } from "@/components/root/context/contributors.server";

export async function requireContributor(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return false;
  return Boolean(getContributorByEmail(email));
}
