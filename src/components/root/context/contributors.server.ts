import "server-only"

// The login allowlist. SERVER ONLY — `server-only` turns an accidental client
// import into a build error rather than a quiet bundle leak.
//
// Lives apart from ./config because that module is imported by client
// components (cloud-tag, story-bar, keyword-card, mobile-nav, tabs). Anything
// in it can reach the browser, so the emails cannot live there. The display
// fields stay in ./contributors-public as the single source of truth; this
// module joins the emails on.

import {
  contributorsPublic,
  type ContributorPublic,
} from "./contributors-public"

export interface Contributor extends ContributorPublic {
  email: string
}

const CONTRIBUTOR_EMAILS: Record<string, string> = {
  abdout: "abdout@databayt.org",
  ali: "ali@databayt.org",
  samia: "samia@databayt.org",
  sedon: "sedon@databayt.org",
}

export const contributors: Contributor[] = contributorsPublic.map((c) => ({
  ...c,
  email: CONTRIBUTOR_EMAILS[c.id] ?? "",
}))

export function getContributorByEmail(email: string): Contributor | undefined {
  // Never match the empty-string fallback above: an id missing from the email
  // map must not become a wildcard that authenticates a blank email.
  if (!email) return undefined
  return contributors.find((c) => c.email === email)
}
