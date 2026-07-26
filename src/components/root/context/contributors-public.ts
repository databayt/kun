// Contributor data that is safe to ship to the browser.
//
// This module exists so email addresses never reach a client bundle. Deriving
// a "public" array inside config.ts would not have helped: a module is bundled
// whole, so any client component importing it pulls the emails in too,
// tree-shaking or not. The only reliable split is a separate module that does
// not contain them at all.
//
// config.ts is the server-side counterpart — it imports this array and joins
// the emails on, so the fields below stay a single source of truth.
//
// Defence in depth. The contributors list is not secret (the team page is
// public), but a login allowlist is a useful thing not to hand out for free.

export interface ContributorPublic {
  id: string;
  name: string;
  nameAr: string;
  role: "engineer" | "qa" | "research" | "ops";
  keywords: string[];
}

export const contributorsPublic: ContributorPublic[] = [
  {
    id: "abdout",
    name: "Abdout",
    nameAr: "عبدوت",
    role: "engineer",
    keywords: [
      "feature",
      "spec",
      "schema",
      "ready",
      "code",
      "wire",
      "check",
      "ship",
      "deploy",
      "build",
      "dev",
      "fix",
      "performance",
      "analyze",
    ],
  },
  {
    id: "ali",
    name: "Ali",
    nameAr: "علي",
    role: "qa",
    keywords: [
      "report",
      "check",
      "review",
      "test",
      "deploy",
      "monitor",
      "handover",
      "security",
    ],
  },
  {
    id: "samia",
    name: "Samia",
    nameAr: "سامية",
    role: "research",
    keywords: ["translate", "docs", "clone", "review", "constitution"],
  },
  {
    id: "sedon",
    name: "Sedon",
    nameAr: "سدن",
    role: "ops",
    keywords: ["monitor", "deploy", "incident"],
  },
];

export function getContributorPublic(
  id: string,
): ContributorPublic | undefined {
  return contributorsPublic.find((c) => c.id === id);
}
