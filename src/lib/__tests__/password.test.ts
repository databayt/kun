import { describe, expect, it } from "vitest";
import { dummyVerify, hashPassword, verifyPassword } from "@/lib/password";

const PASSWORD = "correct horse battery staple";

describe("hashPassword", () => {
  it("emits scrypt$N$r$p$salt$hash", () => {
    expect(hashPassword(PASSWORD)).toMatch(
      /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/,
    );
  });

  it("salts, so the same password hashes differently each time", () => {
    expect(hashPassword(PASSWORD)).not.toBe(hashPassword(PASSWORD));
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", () => {
    expect(verifyPassword(PASSWORD, hashPassword(PASSWORD))).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyPassword("wrong", hashPassword(PASSWORD))).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(verifyPassword("", hashPassword(PASSWORD))).toBe(false);
  });

  it("rejects malformed stored values instead of throwing", () => {
    // A corrupted env var must deny access, not 500 the login route.
    for (const stored of [
      "",
      "not-a-hash",
      "scrypt$deadbeef$cafe", // the old 3-part format
      "bcrypt$16384$8$1$aa$bb", // wrong scheme
      "scrypt$abc$8$1$aa$bb", // non-numeric N
      "scrypt$1$8$1$aa$bb", // N below the floor
      "scrypt$16384$8$1$aabb$", // empty hash
      "scrypt$16384$8$1", // too few parts
    ]) {
      expect(() => verifyPassword(PASSWORD, stored)).not.toThrow();
      expect(verifyPassword(PASSWORD, stored)).toBe(false);
    }
  });

  it("rejects a hash whose parameters were tampered with", () => {
    const hash = hashPassword(PASSWORD);
    const tampered = hash.replace("$16384$", "$32768$");
    expect(verifyPassword(PASSWORD, tampered)).toBe(false);
  });
});

describe("the missing-env-var path", () => {
  it("treats an unset hash as a refusal", () => {
    // auth.config.ts reads process.env[...] ?? "" and never calls verify with a
    // real hash when it is absent — an empty stored value must be false.
    const stored = process.env.AUTH_PASSWORD_HASH_NOBODY ?? "";
    expect(stored).toBe("");
    expect(verifyPassword(PASSWORD, stored)).toBe(false);
  });

  it("dummyVerify always fails but burns comparable work", () => {
    expect(dummyVerify(PASSWORD)).toBe(false);

    const time = (fn: () => unknown) => {
      const start = process.hrtime.bigint();
      fn();
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    const hash = hashPassword(PASSWORD);
    const real = time(() => verifyPassword("wrong", hash));
    const dummy = time(() => dummyVerify("wrong"));

    // Loose bound — this guards against the dummy path becoming a no-op, which
    // would turn the login form into an oracle for enumerating contributors.
    expect(dummy).toBeGreaterThan(real * 0.25);
  });
});
