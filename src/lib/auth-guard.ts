// Re-export shim. The contributor authorization guard now lives with the rest
// of the server-side auth helpers in the auth block. Kept here so the many
// Server Actions that already import `@/lib/auth-guard` don't have to churn.
//
// See @/components/auth/auth for the guard itself and its rationale (JWT
// sessions outlive removal from the allowlist, so the check re-resolves the
// email at call time).

export { requireContributor } from "@/components/auth/auth";
