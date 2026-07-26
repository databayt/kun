// Bearer authentication for the machine-to-machine social routes.
//
// Shared by /api/social/cron and /api/social/relay, which both had their own
// copy. Holding CRON_SECRET means "a human already approved this" — whoever has
// it can publish to a brand page, so treat it as a publishing credential.

import crypto from "node:crypto";

/**
 * Constant-time comparison of the Authorization header against CRON_SECRET.
 *
 * Returns false when the secret is unset: an unconfigured deployment must
 * refuse these routes, not accept everything.
 */
export function isAuthorizedBearer(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;

  const provided = (request.headers.get("authorization") ?? "").trim();
  const expected = `Bearer ${secret}`;

  // Length is checked first because timingSafeEqual throws on a mismatch. A
  // differing length is already disqualifying, and leaking that much via timing
  // is not useful to an attacker who can see the header format anyway.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
