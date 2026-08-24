"use server";

import { signOut } from "@/auth";

// Clear the session without a server redirect so middleware can't intercept the
// still-authenticated request mid-sign-out; the caller navigates afterwards.
export async function logout(): Promise<void> {
  await signOut({ redirect: false });
}
