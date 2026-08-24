import "server-only";

import { auth } from "@/auth";
import {
  getContributorByEmail,
  type Contributor,
} from "@/components/root/context/contributors.server";

// Server-side session helpers, the shape the mature auth block exposes from its
// `auth.ts`. Kun's session is contributor-backed rather than DB-backed, so
// `currentContributor` re-resolves the allowlist here too.

export const currentUser = async () => {
  const session = await auth();
  return session?.user;
};

export const currentRole = async () => {
  const session = await auth();
  return session?.user?.role;
};

export const currentContributor = async (): Promise<Contributor | undefined> => {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return undefined;
  return getContributorByEmail(email);
};

// The authorization gate shared by every mutating Server Action.
//
// Session presence is not enough: JWT sessions outlive removal from the
// contributors allowlist, so every call re-resolves the email against the
// config at call time rather than trusting a claim minted earlier.
//
// Lives here so the check cannot drift between callers — a guard that exists in
// one action and not its neighbour is the shape most authorization bugs take.
export async function requireContributor(): Promise<boolean> {
  return Boolean(await currentContributor());
}
