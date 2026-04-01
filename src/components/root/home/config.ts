export interface HomeItem {
  id: string
  title: string
  description: string
  icon: string
  href: string
}

export const homeItems: HomeItem[] = [
  {
    id: "claude-md",
    title: "CLAUDE.md",
    description: "Project instructions that shape every response.",
    icon: "ClaudeMdIcon",
    href: "/engine/claude-md",
  },
  {
    id: "rules",
    title: "Rules",
    description: "Path-scoped wards that activate on file touch.",
    icon: "RulesIcon",
    href: "/engine/rules",
  },
  {
    id: "commands",
    title: "Commands",
    description: "Slash commands for rapid workflows.",
    icon: "CommandsIcon",
    href: "/engine/commands",
  },
  {
    id: "agents",
    title: "Agents",
    description: "40 agents across 4 tiers — captain to specialists.",
    icon: "AgentsIcon",
    href: "/engine/agents",
  },
  {
    id: "hooks",
    title: "Hooks",
    description: "Silent enchantments that cast themselves.",
    icon: "HooksIcon",
    href: "/engine/hooks",
  },
  {
    id: "skills",
    title: "Skills",
    description: "17 reusable incantations with keyword triggers.",
    icon: "SkillsIcon",
    href: "/engine/skills",
  },
  {
    id: "mcp",
    title: "MCP",
    description: "18 portals to external realms.",
    icon: "MCPIcon",
    href: "/engine/mcp",
  },
  {
    id: "connectors",
    title: "Connectors",
    description: "GitHub, Figma, Slack, Linear integrations.",
    icon: "ConnectorsIcon",
    href: "/engine/connectors",
  },
  {
    id: "apps",
    title: "Apps",
    description: "Claude in Slack, Figma, and Asana.",
    icon: "AppsIcon",
    href: "/engine/apps",
  },
  {
    id: "memory",
    title: "Memory",
    description: "Pensieve files that persist across sessions.",
    icon: "MemoryIcon",
    href: "/engine/memory",
  },
  {
    id: "dispatch",
    title: "Dispatch",
    description: "Notes → Dispatch — async team communication.",
    icon: "DispatchIcon",
    href: "/engine/dispatch",
  },
  {
    id: "voice",
    title: "Voice",
    description: "Speak incantations instead of typing them.",
    icon: "VoiceIcon",
    href: "/engine/voice",
  },
  {
    id: "cowork",
    title: "Cowork",
    description: "Same brain, two modes — one thinks, one acts.",
    icon: "CoworkIcon",
    href: "/engine/cowork",
  },
  {
    id: "captain",
    title: "Captain",
    description: "CEO brain — delegates across 40 agents and 4 humans.",
    icon: "CaptainIcon",
    href: "/engine/captain",
  },
  {
    id: "team",
    title: "Team",
    description: "4 roles with tailored MCP configs and agent indexes.",
    icon: "TeamIcon",
    href: "/engine/team",
  },
  {
    id: "credentials",
    title: "Credentials",
    description: "Keychain-based API key management for 18 services.",
    icon: "CredentialsIcon",
    href: "/engine/credentials",
  },
  {
    id: "quality-engineer",
    title: "Quality Engineer",
    description: "Tracks 19 keywords, orchestrates QA, monitors coverage.",
    icon: "GuardianIcon",
    href: "/engine/quality-engineer",
  },
  {
    id: "tips",
    title: "Tips",
    description: "Master-level techniques and hidden spells.",
    icon: "TipsIcon",
    href: "/engine/tips",
  },
  {
    id: "tweets",
    title: "Tweets",
    description: "Track Claude updates and tips on X.",
    icon: "TwitterIcon",
    href: "/engine/tweets",
  },
]
