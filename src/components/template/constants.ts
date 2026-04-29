import type { MainNavItem, SidebarNavItem } from "./types";

export const siteConfig = {
  name: "Kun",
  url: "https://kun.databayt.org",
  github: "https://github.com/databayt/kun",
  mainNav: [
    { title: "Docs", href: "/docs" },
    { title: "Incantations", href: "/incantations" },
    { title: "Team", href: "/team" },
    { title: "Context", href: "/context" },
  ] satisfies MainNavItem[],
};

export const docsConfig = {
  sidebarNav: [
    {
      title: "Introduction",
      items: [{ title: "Introduction", href: "/docs", items: [] }],
    },
    {
      title: "Engine",
      items: [
        { title: "CLAUDE.md", href: "/docs/claude-md", items: [] },
        { title: "Agents", href: "/docs/agents", items: [] },
        { title: "Skills", href: "/docs/skills", items: [] },
        { title: "Commands", href: "/docs/commands", items: [] },
        { title: "MCP", href: "/docs/mcp", items: [] },
        { title: "Hooks", href: "/docs/hooks", items: [] },
        { title: "Rules", href: "/docs/rules", items: [] },
        { title: "Memory", href: "/docs/memory", items: [] },
      ],
    },
    {
      title: "Operations",
      items: [
        { title: "Captain", href: "/docs/captain", items: [] },
        { title: "Team", href: "/docs/team", items: [] },
        { title: "Dispatch", href: "/docs/dispatch", items: [] },
        { title: "Context", href: "/docs/context", items: [] },
        { title: "Cowork", href: "/docs/cowork", items: [] },
        { title: "Voice", href: "/docs/voice", items: [] },
        { title: "Credentials", href: "/docs/credentials", items: [] },
        { title: "Connectors", href: "/docs/connectors", items: [] },
        { title: "Apps", href: "/docs/apps", items: [] },
        { title: "Issue", href: "/docs/issue", items: [] },
      ],
    },
    {
      title: "Reference",
      items: [
        { title: "Keywords", href: "/docs/keywords", items: [] },
        { title: "Tips", href: "/docs/tips", items: [] },
        { title: "Tweets", href: "/docs/tweets", items: [] },
        { title: "Configuration", href: "/docs/configuration", items: [] },
        { title: "Architecture", href: "/docs/architecture", items: [] },
        { title: "Workflows", href: "/docs/workflows", items: [] },
        { title: "Products", href: "/docs/products", items: [] },
        { title: "PRD", href: "/docs/prd", items: [] },
        { title: "Epics", href: "/docs/epics", items: [] },
        { title: "Claude Code", href: "/docs/claude-code", items: [] },
        { title: "Secrets", href: "/docs/secrets", items: [] },
        { title: "Slack", href: "/docs/slack", items: [] },
        { title: "Stack", href: "/docs/stack", items: [] },
        { title: "Repositories", href: "/docs/repositories", items: [] },
        { title: "Projects", href: "/docs/projects", items: [] },
        { title: "Self-Hosting", href: "/docs/self-hosting", items: [] },
      ],
    },
  ] satisfies SidebarNavItem[],
};
