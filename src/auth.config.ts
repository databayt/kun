import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { contributors } from "@/components/root/context/contributors.server";
import { dummyVerify, verifyPassword } from "@/lib/password";

// Per-contributor scrypt hash, keyed off the contributor id:
//   AUTH_PASSWORD_HASH_ABDOUT, AUTH_PASSWORD_HASH_ALI, …
// Generate with: node scripts/hash-password.mjs <contributor-id>
//
// No default, no fallback, no dev bypass. A contributor without a hash cannot
// sign in — this login guards a surface that publishes to real brand accounts,
// and kun is a public repo, so any literal in source is a published credential.
function storedHash(contributorId: string): string {
  return (
    process.env[`AUTH_PASSWORD_HASH_${contributorId.toUpperCase()}`] ?? ""
  ).trim();
}

export default {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        // Resolve the contributor first, then their hash. Both miss-paths burn
        // the same scrypt work as a real verify, so response time cannot
        // distinguish "unknown email" from "wrong password" — otherwise the
        // form is an oracle for enumerating who has access.
        const contributor = contributors.find((c) => c.email === email);
        if (!contributor) return dummyVerify(password) || null;

        const hash = storedHash(contributor.id);
        if (!hash) {
          console.warn(
            `[auth] no AUTH_PASSWORD_HASH_${contributor.id.toUpperCase()} set — refusing login`,
          );
          return dummyVerify(password) || null;
        }

        if (!verifyPassword(password, hash)) return null;

        return {
          id: contributor.id,
          name: contributor.name,
          email: contributor.email,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
