/**
 * Redirect policy for the auth flow.
 *
 * The reference auth block (hogwarts, codebase) keeps this at `src/routes.ts`
 * alongside `publicRoutes` / `authRoutes` arrays, because their middleware
 * gates by *exclusion* — everything is protected unless it appears in a list.
 * Kun's proxy gates by a positive matcher instead (see proxy.ts `config`), so
 * those arrays would have no consumer here and are deliberately omitted rather
 * than transplanted as dead config.
 */

/**
 * Where a contributor lands after signing in with no callback of their own.
 *
 * Locale-less on purpose: callers prefix the active locale, the same way the
 * reference block's DEFAULT_LOGIN_REDIRECT is a bare path.
 */
export const DEFAULT_LOGIN_REDIRECT = "/context";

/**
 * Narrow an untrusted `callbackUrl` to a same-origin path, or null.
 *
 * A callback travels in the query string, so it is attacker-controlled input:
 * anyone can hand out `/en/login?callbackUrl=<somewhere-else>`. Only relative
 * paths are allowed through, and three shapes are rejected outright:
 *
 *   - anything not starting with `/`   — absolute URLs, `javascript:`, …
 *   - `//evil.com`                     — protocol-relative; browsers navigate off-site
 *   - `/\evil.com`                     — backslash variant browsers normalise to the above
 *
 * The last two are why a bare `startsWith("/")` check is not enough.
 */
export function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\")) return null;
  return raw;
}
