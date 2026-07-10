// Single source of truth for kun docs navigation.
// Consumed by both the desktop sidebar (docs-sidebar.tsx) and the mobile
// hamburger (template/mobile-nav.tsx) so the two never drift.
// Order must match content/docs/meta.json.

export type DocEntry = { href: string; label: string };
export type DocSection = { title: string; items: DocEntry[] };

export const docsNav: (DocEntry | DocSection)[] = [
  { href: "/docs", label: "Introduction" },
  {
    title: "Engine",
    items: [
      { href: "/docs/claude-md", label: "CLAUDE.md" },
      { href: "/docs/agents", label: "Agents" },
      { href: "/docs/skills", label: "Skills" },
      { href: "/docs/commands", label: "Commands" },
      { href: "/docs/mcp", label: "MCP" },
      { href: "/docs/hooks", label: "Hooks" },
      { href: "/docs/rules", label: "Rules" },
      { href: "/docs/memory", label: "Memory" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/docs/captain", label: "Captain" },
      { href: "/docs/team", label: "Team" },
      { href: "/docs/sprint", label: "Sprint Plan" },
      { href: "/docs/share-economy", label: "Share Economy" },
      { href: "/docs/onboarding", label: "Onboarding" },
      { href: "/docs/dispatch", label: "Dispatch" },
      { href: "/docs/context", label: "Context" },
      { href: "/docs/cowork", label: "Cowork" },
      { href: "/docs/voice", label: "Voice" },
      { href: "/docs/credentials", label: "Credentials" },
      { href: "/docs/connectors", label: "Connectors" },
      { href: "/docs/apps", label: "Apps" },
      { href: "/docs/issue", label: "Issue" },
    ],
  },
  {
    title: "Social",
    items: [
      { href: "/docs/social", label: "Overview" },
      { href: "/docs/social/databayt", label: "Databayt" },
      { href: "/docs/social/hogwarts", label: "Hogwarts" },
      { href: "/docs/social/mkan", label: "Mkan" },
      { href: "/docs/social/moallimee", label: "Moallimee" },
      { href: "/docs/social/sijillee", label: "Sijillee" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/keywords", label: "Keywords" },
      { href: "/docs/brand", label: "Brand & Voice" },
      { href: "/docs/tips", label: "Tips" },
      { href: "/docs/tweets", label: "Tweets" },
      { href: "/docs/configuration", label: "Configuration" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/workflows", label: "Workflows" },
      { href: "/docs/products", label: "Products" },
      { href: "/docs/prd", label: "PRD" },
      { href: "/docs/epics", label: "Epics" },
      { href: "/docs/claude-code", label: "Claude Code" },
      { href: "/docs/secrets", label: "Secrets" },
      { href: "/docs/slack", label: "Slack" },
      { href: "/docs/stack", label: "Stack" },
      { href: "/docs/repositories", label: "Repositories" },
      { href: "/docs/projects", label: "Projects" },
      { href: "/docs/self-hosting", label: "Self-Hosting" },
    ],
  },
];
