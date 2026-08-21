// Top-level site navigation, shared by the desktop header nav and the mobile
// hamburger so the two never drift.

export type SiteNavItem = { href: string; label: string };

export const siteNav: SiteNavItem[] = [
  { href: "/jobs", label: "Jobs" },
  { href: "/docs", label: "Docs" },
  { href: "/incantations", label: "Incantations" },
  { href: "/team", label: "Team" },
  { href: "/hardware", label: "Hardware" },
  { href: "/context", label: "Context" },
];
