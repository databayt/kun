// Password hashing for the contributor login.
//
// scrypt from node:crypto rather than bcrypt/argon2 — it is a memory-hard KDF
// built for exactly this, it ships with Node, and adding a native dependency to
// hash four passwords would be the wrong trade. Auth runs in the Node runtime
// here (nothing in the edge middleware imports auth.config), so this is safe.
//
// Stored format: `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>`. The cost parameters
// travel with the hash, so they can be raised later without invalidating hashes
// already issued — a verify reads the params it was created with.

import crypto from "node:crypto";

const SCHEME = "scrypt";
const N = 16384; // CPU/memory cost — 16 MiB at r=8
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

// Fixed salt for the timing-equalisation path only — never used to store a hash.
const DUMMY_SALT = Buffer.alloc(SALT_BYTES, 0);

// Node's default maxmem is 32 MiB; give scrypt explicit headroom so a future
// bump to N doesn't fail with an opaque "memory limit exceeded".
function maxmem(n: number, r: number): number {
  return 256 * n * r;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: maxmem(N, R),
  });
  return [SCHEME, N, R, P, salt.toString("hex"), derived.toString("hex")].join(
    "$",
  );
}

/**
 * Constant-time comparison against a stored `scrypt$N$r$p$salt$hash` value.
 *
 * Returns false for anything malformed rather than throwing — a corrupted env
 * var must deny access, not 500 the login route.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== SCHEME) return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    n < 2 ||
    r < 1 ||
    p < 1
  ) {
    return false;
  }

  let derived: Buffer;
  let expected: Buffer;
  try {
    const [, , , , saltHex, hashHex] = parts;
    expected = Buffer.from(hashHex, "hex");
    if (expected.length === 0) return false;
    derived = crypto.scryptSync(
      password,
      Buffer.from(saltHex, "hex"),
      expected.length,
      { N: n, r, p, maxmem: maxmem(n, r) },
    );
  } catch {
    return false;
  }

  // Length equality guarded before the compare — timingSafeEqual throws on a
  // mismatch. Same pattern as the CRON_SECRET check in api/social/relay.
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/**
 * Burn the same work as a real verify, then fail.
 *
 * Called on the "no such contributor" and "no hash configured" paths so that
 * response time does not distinguish an unknown email from a wrong password —
 * otherwise the login form becomes an oracle for enumerating who has access.
 */
export function dummyVerify(password: string): false {
  try {
    crypto.scryptSync(password, DUMMY_SALT, KEY_LENGTH, {
      N,
      r: R,
      p: P,
      maxmem: maxmem(N, R),
    });
  } catch {
    // Ignore — this exists only to consume time.
  }
  return false;
}
