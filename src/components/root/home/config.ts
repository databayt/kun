export interface HomeItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  /**
   * Filename under /public/icons/home for a raster icon. When set, it renders
   * instead of `icon`. Names are content-stable (one file = one glyph), so
   * remapping a card is just swapping this string — no cache collisions.
   */
  image?: string;
  href: string;
  /** Consolidated client-facing group — drives the homepage filter tabs. */
  group: string;
}

export const homeItems: HomeItem[] = [
  {
    id: "claude-md",
    title: "CLAUDE.md",
    description: "Project instructions that shape every response.",
    icon: "ClaudeMdIcon",
    image: "document.png",
    href: "/engine/claude-md",
    group: "configuration",
  },
  {
    id: "rules",
    title: "Rules",
    description: "Path-scoped wards that activate on file touch.",
    icon: "RulesIcon",
    image: "rules.png",
    href: "/engine/rules",
    group: "configuration",
  },
  {
    id: "commands",
    title: "Commands",
    description: "Slash commands for rapid workflows.",
    icon: "CommandsIcon",
    image: "command-line.png",
    href: "/engine/commands",
    group: "configuration",
  },
  {
    id: "agents",
    title: "Agents",
    description: "40 agents across 4 tiers — captain to specialists.",
    icon: "AgentsIcon",
    image: "robot.png",
    href: "/engine/agents",
    group: "agents",
  },
  {
    id: "hooks",
    title: "Hooks",
    description: "Silent enchantments that cast themselves.",
    icon: "HooksIcon",
    image: "hook.png",
    href: "/engine/hooks",
    group: "configuration",
  },
  {
    id: "skills",
    title: "Skills",
    description: "17 reusable incantations with keyword triggers.",
    icon: "SkillsIcon",
    image: "box.png",
    href: "/engine/skills",
    group: "configuration",
  },
  {
    id: "mcp",
    title: "MCP",
    description: "18 portals to external realms.",
    icon: "MCPIcon",
    image: "mcp.png",
    href: "/engine/mcp",
    group: "integrations",
  },
  {
    id: "connectors",
    title: "Connectors",
    description: "GitHub, Figma, Slack, Linear integrations.",
    icon: "ConnectorsIcon",
    image: "plug.png",
    href: "/engine/connectors",
    group: "integrations",
  },
  {
    id: "apps",
    title: "Apps",
    description: "Claude in Slack, Figma, and Asana.",
    icon: "AppsIcon",
    href: "/engine/apps",
    group: "integrations",
  },
  {
    id: "memory",
    title: "Memory",
    description: "Pensieve files that persist across sessions.",
    icon: "MemoryIcon",
    image: "sd-card.png",
    href: "/engine/memory",
    group: "configuration",
  },
  {
    id: "dispatch",
    title: "Dispatch",
    description: "Notes → Dispatch — async team communication.",
    icon: "DispatchIcon",
    image: "remote-control.png",
    href: "/engine/dispatch",
    group: "collaboration",
  },
  {
    id: "voice",
    title: "Voice",
    description: "Speak incantations instead of typing them.",
    icon: "VoiceIcon",
    image: "sound-recognition.png",
    href: "/engine/voice",
    group: "collaboration",
  },
  {
    id: "cowork",
    title: "Cowork",
    description: "Same brain, two modes — one thinks, one acts.",
    icon: "CoworkIcon",
    image: "arrows.png",
    href: "/engine/cowork",
    group: "collaboration",
  },
  {
    id: "captain",
    title: "Captain",
    description: "CEO brain — delegates across the agent fleet and 7 humans.",
    icon: "CaptainIcon",
    image: "ceo.png",
    href: "/engine/captain",
    group: "agents",
  },
  {
    id: "team",
    title: "Team",
    description: "4 roles with tailored MCP configs and agent indexes.",
    icon: "TeamIcon",
    image: "network.png",
    href: "/engine/team",
    group: "agents",
  },
  {
    id: "credentials",
    title: "Credentials",
    description: "Keychain-based API key management for 18 services.",
    icon: "CredentialsIcon",
    image: "padlock.png",
    href: "/engine/credentials",
    group: "integrations",
  },
  {
    id: "social-hub",
    title: "Social Hub",
    description: "Manage social posts and auto-publish via Hermes.",
    icon: "TwitterIcon",
    image: "twitter.png",
    href: "/social",
    group: "integrations",
  },
  {
    id: "quality",
    title: "Quality",
    description:
      "Routes 17 niche keywords; owns qa, /handover, /release orchestrators.",
    icon: "GuardianIcon",
    href: "/engine/quality",
    group: "agents",
  },
  {
    id: "tips",
    title: "Tips",
    description: "Master-level techniques and hidden spells.",
    icon: "TipsIcon",
    image: "sticky-note.png",
    href: "/engine/tips",
    group: "resources",
  },
  {
    id: "tweets",
    title: "Tweets",
    description: "Track Claude updates and tips on X.",
    icon: "TwitterIcon",
    image: "twitter.png",
    href: "/engine/tweets",
    group: "resources",
  },
];

/**
 * Consolidated, client-facing groups for the homepage grid — order = importance.
 * Single source of truth for the filter tabs, grouping, and ordering.
 */
export const ENGINE_GROUPS: { id: string; label: string }[] = [
  { id: "configuration", label: "Configuration" },
  { id: "agents", label: "Agents" },
  { id: "integrations", label: "Integrations" },
  { id: "collaboration", label: "Collaboration" },
  { id: "resources", label: "Resources" },
];

/** item id → group id, derived from homeItems. */
export const GROUP_OF: Record<string, string> = Object.fromEntries(
  homeItems.map((item) => [item.id, item.group]),
);
