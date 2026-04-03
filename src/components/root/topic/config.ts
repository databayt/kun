export interface Reference {
  title: string
  url: string
  type: 'docs' | 'repo' | 'video' | 'article' | 'tool' | 'social'
}

export interface TopicDetail {
  id: string
  title: string
  description: string
  icon: string
  overview: string
  officialDocs: string
  status: 'current' | 'review' | 'behind'
  lastReviewed: string
  progress: string[]
  improvements: string[]
  references: Reference[]
  setup: string[]
  usage: string[]
  configPaths: string[]
  kunDocs: string
}

export const topicDetails: Record<string, TopicDetail> = {
  "claude-md": {
    id: "claude-md",
    title: "CLAUDE.md",
    description: "Project instructions that shape every response.",
    icon: "ClaudeMdIcon",
    overview:
      "CLAUDE.md is the most powerful configuration primitive in Claude Code. It defines project-level instructions that Claude reads at the start of every conversation. We use a 3-tier hierarchy: user-level (~/.claude/CLAUDE.md), project-level (CLAUDE.md at repo root), and repo-level (.claude/CLAUDE.md). This is how we encode architecture decisions, coding conventions, and workflow preferences so the team never repeats instructions.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/memory",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "3-tier hierarchy active: user, project, and repo CLAUDE.md",
      "100+ keyword mappings defined across all products",
      "Component hierarchy (ui > atom > template > block) documented",
      "Stack preferences and coding conventions locked in",
    ],
    improvements: [
      "Arabic translations missing for keyword descriptions",
      "Per-repo CLAUDE.md files need audit across 14 repos",
      "Keyword-to-agent mappings could be auto-validated",
    ],
    references: [
      { title: "Claude Code Memory", url: "https://docs.anthropic.com/en/docs/claude-code/memory", type: "docs" },
      { title: "Claude Code Overview", url: "https://docs.anthropic.com/en/docs/claude-code/overview", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
      { title: "Anthropic Cookbook", url: "https://github.com/anthropics/anthropic-cookbook", type: "repo" },
      { title: "Claude Code Best Practices", url: "https://docs.anthropic.com/en/docs/claude-code/tips-and-tricks", type: "article" },
    ],
    setup: [
      "Create CLAUDE.md at your repo root with project conventions",
      "Create .claude/CLAUDE.md for shared team instructions",
      "Create ~/.claude/CLAUDE.md for personal preferences",
      "Add component hierarchy, stack preferences, and keyword triggers",
    ],
    usage: [
      "Define your tech stack and package manager preference",
      "Map keywords to workflows (e.g., 'dev' triggers server start)",
      "Set coding conventions — naming, file structure, import patterns",
      "Reference external repos and codebase lookup order",
      "Define component hierarchy levels (ui > atom > template > block)",
    ],
    configPaths: [
      "CLAUDE.md",
      ".claude/CLAUDE.md",
      "~/.claude/CLAUDE.md",
    ],
    kunDocs: "/docs/claude-md",
  },

  "rules": {
    id: "rules",
    title: "Rules",
    description: "Path-scoped wards that activate on file touch.",
    icon: "RulesIcon",
    overview:
      "Rules are path-scoped markdown files in .claude/rules/ that automatically activate when Claude touches matching files. Unlike CLAUDE.md which loads globally, rules are contextual — the tailwind rule fires only when editing CSS, the prisma rule fires only when touching schema files. This keeps context lean and instructions relevant.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/memory",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "8 rules active: tailwind, prisma, auth, i18n, testing, deployment, cowork-bridge, org-refs",
      "Path-scoped activation working for all file types",
      "User-level rules in ~/.claude/rules/ for cross-project",
    ],
    improvements: [
      "Missing rules for: Stripe webhooks, email templates, API routes",
      "Rules don't have versioning — no way to track rule drift across repos",
      "Could add rule for Playwright test patterns",
    ],
    references: [
      { title: "Claude Code Memory — Rules", url: "https://docs.anthropic.com/en/docs/claude-code/memory", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
    ],
    setup: [
      "Create .claude/rules/ directory in your repo",
      "Add markdown files with frontmatter specifying file globs",
      "Rules auto-activate when matching files are touched",
      "Use user rules at ~/.claude/rules/ for personal cross-project rules",
    ],
    usage: [
      "tailwind.md — CSS-first config, OKLCH colors, RTL logical properties",
      "prisma.md — Schema conventions, migration workflow, query patterns",
      "auth.md — Auth.js v5 patterns, session handling, JWT config",
      "i18n.md — Arabic/English dictionaries, RTL/LTR layout rules",
      "testing.md — Vitest config, Playwright patterns, coverage thresholds",
    ],
    configPaths: [
      ".claude/rules/*.md",
      "~/.claude/rules/*.md",
    ],
    kunDocs: "/docs/rules",
  },

  "commands": {
    id: "commands",
    title: "Commands",
    description: "Slash commands for rapid workflows.",
    icon: "CommandsIcon",
    overview:
      "Custom slash commands are markdown files in .claude/commands/ that define reusable prompts triggered by /command-name. We use them for repetitive workflows — /dev starts the dev server, /build runs smart builds, /deploy ships to Vercel. Commands can accept arguments via $ARGUMENTS and compose multiple tools into a single action.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/slash-commands",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "17+ slash commands configured and working",
      "Core workflow commands: /dev, /build, /deploy, /quick all tested",
      "Creation commands: /atom, /template, /block, /saas operational",
      "$ARGUMENTS placeholder used for parameterized commands",
    ],
    improvements: [
      "Some commands overlap with skills — need to clarify which is canonical",
      "No command for database seeding or migration rollback",
      "Missing /changelog and /release commands for version management",
    ],
    references: [
      { title: "Custom Slash Commands", url: "https://docs.anthropic.com/en/docs/claude-code/slash-commands", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
    ],
    setup: [
      "Create .claude/commands/ directory",
      "Add markdown files — filename becomes the command name",
      "Use $ARGUMENTS placeholder for command arguments",
      "User commands go in ~/.claude/commands/ for cross-project access",
    ],
    usage: [
      "/dev — Kill port 3000, start pnpm dev, open Chrome",
      "/build — Run pnpm build with TypeScript check and auto-fix",
      "/deploy — Deploy to Vercel with environment selection",
      "/atom <name> — Create an atom component from 2+ primitives",
      "/test <file> — Generate and run tests for a file",
    ],
    configPaths: [
      ".claude/commands/*.md",
      "~/.claude/commands/*.md",
    ],
    kunDocs: "/docs/commands",
  },

  "agents": {
    id: "agents",
    title: "Agents",
    description: "40 agents across 4 tiers — captain to specialists.",
    icon: "AgentsIcon",
    overview:
      "Sub-agents are markdown files in .claude/agents/ that define specialized AI personas with specific tools, knowledge, and behaviors. We run a 4-tier hierarchy: Tier 0 (Captain — CEO brain), Tier 1 (Business — revenue, growth, support), Tier 2 (Product — product, analyst), Tier 3 (Tech — 31 specialists across stack, design, UI, DevOps, VCS). Agents run in isolated contexts and can be launched in parallel via worktrees.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/sub-agents",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "40 agents defined across 4 tiers with clear hierarchy",
      "9 leadership agents (captain, revenue, growth, support, product, analyst, tech-lead, ops, guardian)",
      "31 specialist agents covering stack, design, UI, DevOps, VCS, domain",
      "Worktree isolation tested for parallel execution",
    ],
    improvements: [
      "Agent quality varies — some need better tool restrictions",
      "No automated testing for agent behavior (prompt regression tests)",
      "Agent SDK integration not yet started for CI/CD pipelines",
      "Some agents have overlapping scope — need clearer boundaries",
    ],
    references: [
      { title: "Sub-agents", url: "https://docs.anthropic.com/en/docs/claude-code/sub-agents", type: "docs" },
      { title: "Agent SDK Overview", url: "https://docs.anthropic.com/en/docs/agent-sdk/overview", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
      { title: "anthropics/agent-sdk", url: "https://github.com/anthropics/agent-sdk", type: "repo" },
      { title: "Agent Patterns Cookbook", url: "https://github.com/anthropics/anthropic-cookbook", type: "repo" },
    ],
    setup: [
      "Create .claude/agents/ directory",
      "Add markdown files with agent definitions (name, tools, instructions)",
      "Specify subagent_type in agent definitions for the Agent tool",
      "Set model override per agent (opus, sonnet, haiku)",
      "Use isolation: worktree for parallel agent execution",
    ],
    usage: [
      "Agent tool with subagent_type selects the right specialist",
      "Orchestration agent delegates to multiple specialists in parallel",
      "Captain agent manages weekly allocation and strategic decisions",
      "Tech-lead agent handles architecture across all 14 repos",
      "Product agents (analyst, guardian) run quality and market checks",
    ],
    configPaths: [
      ".claude/agents/*.md",
      "~/.claude/agents/*.md",
    ],
    kunDocs: "/docs/agents",
  },

  "hooks": {
    id: "hooks",
    title: "Hooks",
    description: "Silent enchantments that cast themselves.",
    icon: "HooksIcon",
    overview:
      "Hooks are shell commands configured in settings.json that automatically execute in response to Claude Code events — before/after tool calls, on session start, on prompt submission. We use them for auto-formatting code after edits, killing stale port processes, and logging session activity. Hooks run silently and can block or modify Claude's behavior.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/hooks",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "5 hooks active: auto-format, port guard, session log, lint gate, pre-submit",
      "Post-write prettier formatting working reliably",
      "Port 3000 kill on dev server start prevents conflicts",
    ],
    improvements: [
      "No hook for auto-running tests after file changes",
      "Session logging could capture more structured data for analytics",
      "Missing hook to validate .env changes don't leak secrets",
      "Could add notification hook for long-running operations",
    ],
    references: [
      { title: "Hooks", url: "https://docs.anthropic.com/en/docs/claude-code/hooks", type: "docs" },
      { title: "Settings Configuration", url: "https://docs.anthropic.com/en/docs/claude-code/settings", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
    ],
    setup: [
      "Configure hooks in .claude/settings.json or ~/.claude/settings.json",
      "Define event type: PreToolUse, PostToolUse, Notification, etc.",
      "Specify matcher for tool-specific hooks (e.g., only on Write tool)",
      "Set the shell command to execute",
    ],
    usage: [
      "Auto-format: Run prettier after every file write",
      "Port guard: Kill port 3000 before dev server starts",
      "Session log: Record session activity on start",
      "Lint gate: Run eslint before commits",
      "Pre-submit: Validate prompt before sending",
    ],
    configPaths: [
      ".claude/settings.json",
      "~/.claude/settings.json",
    ],
    kunDocs: "/docs/hooks",
  },

  "skills": {
    id: "skills",
    title: "Skills",
    description: "17 reusable incantations with keyword triggers.",
    icon: "SkillsIcon",
    overview:
      "Skills are enhanced slash commands that combine multiple tools, agents, and MCP servers into single-word workflows. Unlike basic commands, skills are keyword-triggered — say 'dev' and the dev skill activates, say 'deploy' and the deployment pipeline runs. Our 17 skills cover the full development lifecycle from creation (/atom, /template, /block) through quality (/test, /security) to delivery (/build, /deploy).",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/slash-commands",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "17 skills covering full dev lifecycle",
      "Keyword triggers mapped in CLAUDE.md for all skills",
      "Creation skills (/atom, /template, /block) generate consistent output",
      "Quality skills (/test, /security, /performance) integrated with CI",
    ],
    improvements: [
      "Skills don't compose well — can't chain /test after /build automatically",
      "No skill for database operations (seed, rollback, snapshot)",
      "/saas skill needs update for latest Stripe API changes",
      "Missing /migrate skill for Prisma schema changes",
    ],
    references: [
      { title: "Custom Slash Commands", url: "https://docs.anthropic.com/en/docs/claude-code/slash-commands", type: "docs" },
      { title: "Claude Code Overview", url: "https://docs.anthropic.com/en/docs/claude-code/overview", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
    ],
    setup: [
      "Skills are pre-configured in .claude/commands/",
      "Each skill maps to a keyword in CLAUDE.md",
      "Some skills compose multiple agents and MCP calls",
      "User-invocable skills appear in the Skill tool list",
    ],
    usage: [
      "/dev — Full dev environment setup",
      "/build — Smart build with TypeScript validation and auto-fix",
      "/deploy — Vercel deployment with environment selection",
      "/atom — Create atom component from 2+ shadcn primitives",
      "/saas — Generate complete SaaS feature (schema + API + UI)",
      "/test — Generate and run tests with coverage",
      "/security — OWASP Top 10 audit",
    ],
    configPaths: [
      ".claude/commands/*.md",
      "~/.claude/commands/*.md",
    ],
    kunDocs: "/docs/skills",
  },

  "mcp": {
    id: "mcp",
    title: "MCP",
    description: "18 portals to external realms.",
    icon: "MCPIcon",
    overview:
      "Model Context Protocol servers connect Claude Code to external services — design tools, databases, deployment platforms, monitoring, and more. Each MCP server exposes tools and resources that Claude can call directly. We run 18 servers covering UI (shadcn, figma, tailwind), testing (browser, browser-headed), DevOps (vercel, github, neon), and monitoring (sentry, posthog).",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/mcp-servers",
    status: "review",
    lastReviewed: "2026-03-25",
    progress: [
      "18 MCP servers configured across 5 categories",
      "Core servers stable: github, vercel, neon, browser, shadcn",
      "Figma MCP working for design-to-code workflows",
      "Credentials injected via Keychain — no .env secrets",
    ],
    improvements: [
      "MCP protocol evolving fast — check for breaking changes monthly",
      "Some servers (sentry, posthog) underused — need team training",
      "Stripe MCP needs testing with Saudi payment methods",
      "No MCP for email (Resend) or SMS (Twilio) yet",
      "Server health monitoring not automated",
    ],
    references: [
      { title: "MCP in Claude Code", url: "https://docs.anthropic.com/en/docs/claude-code/mcp-servers", type: "docs" },
      { title: "MCP Protocol Spec", url: "https://modelcontextprotocol.io/introduction", type: "docs" },
      { title: "MCP Servers Registry", url: "https://github.com/modelcontextprotocol/servers", type: "repo" },
      { title: "modelcontextprotocol/spec", url: "https://github.com/modelcontextprotocol/specification", type: "repo" },
      { title: "MCP Inspector", url: "https://github.com/modelcontextprotocol/inspector", type: "tool" },
      { title: "Building MCP Servers", url: "https://modelcontextprotocol.io/quickstart/server", type: "article" },
    ],
    setup: [
      "Configure MCP servers in .claude/settings.json under mcpServers",
      "Each server needs: command, args, and optional env vars",
      "Use npx for Node-based servers, uvx for Python-based",
      "Test with MCP Inspector before adding to settings",
      "Per-project servers in .claude/settings.json, global in ~/.claude/settings.json",
    ],
    usage: [
      "shadcn — Install UI components, search registry",
      "browser — Headless Chromium for testing and screenshots",
      "github — PR creation, issue management, code review",
      "vercel — Deploy, check logs, manage domains",
      "neon — Database branching, migrations, SQL execution",
      "figma — Design-to-code, screenshot comparison",
      "stripe — Payment setup, webhook management",
    ],
    configPaths: [
      ".claude/settings.json (mcpServers)",
      "~/.claude/settings.json (mcpServers)",
    ],
    kunDocs: "/docs/mcp",
  },

  "connectors": {
    id: "connectors",
    title: "Connectors",
    description: "GitHub, Figma, Slack, Linear integrations.",
    icon: "ConnectorsIcon",
    overview:
      "Connectors are the MCP servers that link Claude Code to collaboration platforms. GitHub for code and issues, Figma for design-to-code, Slack for team communication, Linear for project management. These connectors turn Claude into a team member that can read designs, create PRs, post updates, and manage tasks across all our tools.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/integrations",
    status: "review",
    lastReviewed: "2026-03-20",
    progress: [
      "GitHub connector fully operational — PRs, issues, reviews",
      "Figma connector working for design extraction and screenshots",
      "Slack workspace created for Hogwarts pilot",
    ],
    improvements: [
      "Slack MCP not yet connected — need to configure workspace token",
      "Linear not set up — currently using GitHub Issues only",
      "No Notion connector for documentation sync",
      "Figma connector needs Code Connect mappings for components",
    ],
    references: [
      { title: "Claude Code Integrations", url: "https://docs.anthropic.com/en/docs/claude-code/integrations", type: "docs" },
      { title: "GitHub MCP Server", url: "https://github.com/modelcontextprotocol/servers", type: "repo" },
      { title: "MCP Protocol", url: "https://modelcontextprotocol.io", type: "docs" },
    ],
    setup: [
      "GitHub: Authenticate with gh auth login, add github MCP server",
      "Figma: Get personal access token, configure figma MCP",
      "Slack: Set up Slack MCP with workspace token",
      "Linear: Add Linear API key, configure linear MCP",
    ],
    usage: [
      "GitHub — Create PRs, review code, manage issues, check CI status",
      "Figma — Extract designs, compare implementations, get screenshots",
      "Slack — Post updates, read channels, send notifications",
      "Linear — Create issues, update status, sync with sprints",
    ],
    configPaths: [
      ".claude/settings.json (mcpServers)",
    ],
    kunDocs: "/docs/connectors",
  },

  "apps": {
    id: "apps",
    title: "Apps",
    description: "Claude in Slack, Figma, and Asana.",
    icon: "AppsIcon",
    overview:
      "Claude Apps bring AI capabilities directly into the tools your team already uses. Claude for Slack answers questions and summarizes threads. Claude for Figma helps designers with layout suggestions. Claude for Asana automates task management. These aren't MCP servers — they're standalone Anthropic integrations that work without Claude Code.",
    officialDocs: "https://docs.anthropic.com/en/docs/build-with-claude",
    status: "behind",
    lastReviewed: "2026-03-15",
    progress: [
      "Claude for Slack evaluated but not yet deployed",
      "Figma MCP used instead of Claude for Figma app",
    ],
    improvements: [
      "Claude for Slack not installed — team still uses manual messages",
      "Claude for Asana not explored — could automate task management",
      "Need to evaluate which apps add value vs. MCP overlap",
      "Anthropic keeps adding new app integrations — check monthly",
    ],
    references: [
      { title: "Build with Claude", url: "https://docs.anthropic.com/en/docs/build-with-claude", type: "docs" },
      { title: "Anthropic API Reference", url: "https://docs.anthropic.com/en/api", type: "docs" },
      { title: "Claude for Slack", url: "https://www.anthropic.com/claude-for-slack", type: "tool" },
    ],
    setup: [
      "Install Claude app from the marketplace of each platform",
      "Authorize with your Anthropic organization account",
      "Configure channel/project access permissions",
      "Set up team-specific workflows and triggers",
    ],
    usage: [
      "Slack — @claude to answer questions, summarize threads",
      "Figma — Generate layouts, suggest design improvements",
      "Asana — Automate task creation, status updates",
      "Each app works independently of Claude Code",
    ],
    configPaths: [
      "Platform-specific settings (Slack admin, Figma plugins, Asana integrations)",
    ],
    kunDocs: "/docs/apps",
  },

  "memory": {
    id: "memory",
    title: "Memory",
    description: "Pensieve files that persist across sessions.",
    icon: "MemoryIcon",
    overview:
      "Memory is Claude Code's persistent file-based knowledge system. It stores information across conversations in ~/.claude/projects/<path>/memory/. We use 4 memory types: user (who you are), feedback (how to work), project (what's happening), reference (where to look). Memory builds up over time so Claude gets better at helping the specific team and project.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/memory",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "Memory system active with MEMORY.md index for kun project",
      "4 memory types implemented: user, feedback, project, reference",
      "Team profiles stored — Abdout, Ali, Samia, Sedon",
      "Company profile and active project context persisted",
    ],
    improvements: [
      "Memory files not set up for other repos (hogwarts, souq, etc.)",
      "No automated memory cleanup — stale entries accumulate",
      "Could add memory for common error patterns and their fixes",
      "Team members need their own memory contexts per machine",
    ],
    references: [
      { title: "Claude Code Memory", url: "https://docs.anthropic.com/en/docs/claude-code/memory", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
    ],
    setup: [
      "Memory directory is auto-created at ~/.claude/projects/<path>/memory/",
      "MEMORY.md is the index — loaded every conversation",
      "Each memory is a markdown file with frontmatter (name, description, type)",
      "Claude saves memories automatically based on conversation context",
    ],
    usage: [
      "user type — Store role, preferences, expertise level",
      "feedback type — Record corrections and confirmed approaches",
      "project type — Track ongoing initiatives, deadlines, decisions",
      "reference type — Pointers to external systems (Linear, Slack, Grafana)",
      "Say 'remember X' to explicitly save a memory",
    ],
    configPaths: [
      "~/.claude/projects/*/memory/MEMORY.md",
      "~/.claude/projects/*/memory/*.md",
    ],
    kunDocs: "/docs/memory",
  },

  "dispatch": {
    id: "dispatch",
    title: "Dispatch",
    description: "Notes -> Dispatch — async team communication.",
    icon: "DispatchIcon",
    overview:
      "Dispatch is our async handoff system using Apple Notes. Team members write notes in Dispatch folders, and Claude reads them at session start. This bridges the gap between human planning (in Notes) and AI execution (in Claude Code). The Captain reads dispatches to understand priorities, and each team member has their own Dispatch folder for targeted instructions.",
    officialDocs: "https://support.apple.com/notes",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "Dispatch folder structure created in Apple Notes",
      "dispatch.sh script operational for read/write",
      "Captain reads dispatches at session start",
      "Cowork ↔ Code handoff working via dispatch notes",
    ],
    improvements: [
      "dispatch.sh needs error handling for missing notes",
      "No notification when a new dispatch arrives",
      "Apple Notes API limited — consider Shortcuts automation",
      "Dispatch history not archived — old notes get lost",
    ],
    references: [
      { title: "Apple Notes Automation", url: "https://support.apple.com/notes", type: "docs" },
      { title: "Shortcuts for Notes", url: "https://support.apple.com/guide/shortcuts/", type: "docs" },
    ],
    setup: [
      "Create Dispatch folder in Apple Notes",
      "Create sub-folders per team member and for Cowork",
      "Configure dispatch.sh script for reading/writing notes",
      "Add session start protocol to read dispatches",
    ],
    usage: [
      "dispatch.sh read inbox — Check for new instructions",
      "dispatch.sh read cowork — Check Cowork handoffs",
      "dispatch.sh write <folder> <message> — Send a dispatch",
      "Captain reads all dispatches at session start for prioritization",
    ],
    configPaths: [
      "~/.claude/scripts/dispatch.sh",
      "Apple Notes / Dispatch folder",
    ],
    kunDocs: "/docs/dispatch",
  },

  "voice": {
    id: "voice",
    title: "Voice",
    description: "Speak incantations instead of typing them.",
    icon: "VoiceIcon",
    overview:
      "Voice mode lets you speak instructions to Claude instead of typing. Available in Claude Desktop and the iOS app. Great for quick decisions ('yes, ship it'), brain dumps (speak a plan, Claude structures it), and reviewing dispatches. Voice input goes through the same processing as text — keywords, agents, and skills all work.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/overview",
    status: "review",
    lastReviewed: "2026-03-15",
    progress: [
      "Voice input working in Claude Desktop for planning sessions",
      "iOS app installed for mobile voice interactions",
    ],
    improvements: [
      "Voice not tested with Arabic input — RTL transcription quality unknown",
      "No voice-specific commands or shortcuts defined",
      "Team hasn't adopted voice workflows yet — needs demo session",
      "Claude Desktop voice quality varies with background noise",
    ],
    references: [
      { title: "Claude Desktop", url: "https://claude.ai/download", type: "tool" },
      { title: "Claude iOS App", url: "https://apps.apple.com/app/claude/id6473753684", type: "tool" },
      { title: "Claude Code Overview", url: "https://docs.anthropic.com/en/docs/claude-code/overview", type: "docs" },
    ],
    setup: [
      "Install Claude Desktop app for macOS/Windows",
      "Or use Claude iOS app for mobile voice",
      "Enable microphone permissions",
      "Voice input works with all keywords and commands",
    ],
    usage: [
      "Quick decisions — 'Yes, ship it' / 'No, hold off'",
      "Brain dumps — Speak a plan, Claude transcribes and structures",
      "Review dispatches — 'Read me the latest captain dispatch'",
      "Create issues by voice — 'Create an issue for hogwarts about X'",
      "Works in both Cowork (planning) and Code (execution) modes",
    ],
    configPaths: [
      "Claude Desktop app settings",
      "iOS app settings",
    ],
    kunDocs: "/docs/voice",
  },

  "cowork": {
    id: "cowork",
    title: "Cowork",
    description: "Same brain, two modes — one thinks, one acts.",
    icon: "CoworkIcon",
    overview:
      "Cowork is Anthropic's product for non-technical work — planning, research, writing, strategy. It shares the same brain as Claude Code through ~/.claude/ (agents, memory, settings). The distinction: Cowork thinks, Claude Code acts. Abdout switches between them like switching between planning and doing. Both read the same dispatches, memory, and GitHub issues.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/overview",
    status: "review",
    lastReviewed: "2026-03-20",
    progress: [
      "Cowork ↔ Code bridge documented in rules/cowork-bridge.md",
      "Shared state via ~/.claude/ working",
      "Dispatch handoff protocol defined and tested",
    ],
    improvements: [
      "Cowork not yet used by other team members — only Abdout",
      "Handoff from Cowork to Code still requires manual issue creation",
      "Could automate Cowork → GitHub Issue → Code pipeline",
      "Need to evaluate Cowork's latest features — Anthropic updates frequently",
    ],
    references: [
      { title: "Claude Code Overview", url: "https://docs.anthropic.com/en/docs/claude-code/overview", type: "docs" },
      { title: "Anthropic Products", url: "https://www.anthropic.com/products", type: "docs" },
    ],
    setup: [
      "Cowork and Claude Code share ~/.claude/ configuration",
      "Agents, memory, and settings work in both modes",
      "Use Dispatch for handoff between Cowork and Code",
      "Create GitHub issues in Cowork for Code to execute",
    ],
    usage: [
      "Cowork: Plan architecture, research patterns, write strategies",
      "Code: Execute plans, build features, deploy",
      "Handoff: Cowork creates issues -> Code picks them up",
      "Voice: Use voice in Cowork for quick planning sessions",
      "Both modes see the same memory and dispatch state",
    ],
    configPaths: [
      "~/.claude/ (shared with Claude Code)",
      "Apple Notes / Dispatch / Cowork",
    ],
    kunDocs: "/docs/cowork",
  },

  "captain": {
    id: "captain",
    title: "Captain",
    description: "CEO brain — delegates across 40 agents and 4 humans.",
    icon: "CaptainIcon",
    overview:
      "Captain is the Tier 0 agent — the CEO brain. It never writes code. It manages weekly allocation, revenue strategy, and team coordination across 5 products (Hogwarts, Souq, Mkan, Shifa, Marketing) and 4 humans (Abdout, Ali, Samia, Sedon). Captain reads all dispatches, checks GitHub across repos, and delegates to the right specialist agents and team members.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/sub-agents",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "Captain agent defined with clear scope — never writes code",
      "/weekly command runs structured weekly reviews",
      "Reads dispatches and GitHub issues across all repos",
      "Team profiles and capacity tracked in memory",
    ],
    improvements: [
      "Weekly review output could be more structured (Markdown report)",
      "No automated priority scoring — Captain relies on judgment alone",
      "Revenue tracking is manual — need Stripe dashboard integration",
      "Delegation patterns not documented — new team members can't follow",
    ],
    references: [
      { title: "Sub-agents", url: "https://docs.anthropic.com/en/docs/claude-code/sub-agents", type: "docs" },
      { title: "Agent SDK", url: "https://docs.anthropic.com/en/docs/agent-sdk/overview", type: "docs" },
      { title: "databayt/kun", url: "https://github.com/databayt/kun", type: "repo" },
    ],
    setup: [
      "Captain agent defined in .claude/agents/captain.md",
      "Reads all dispatch folders at session start",
      "Checks GitHub issues across all 14 repos",
      "Uses /weekly command for structured weekly reviews",
    ],
    usage: [
      "Weekly review — Allocation, priorities, blockers across all products",
      "Delegation — Routes work to the right agent and human",
      "Revenue tracking — MRR, pipeline, customer health",
      "Team coordination — Knows each member's strengths and capacity",
      "Never writes code — always delegates to specialist agents",
    ],
    configPaths: [
      ".claude/agents/captain.md",
      "~/.claude/commands/weekly.md",
    ],
    kunDocs: "/docs/captain",
  },

  "team": {
    id: "team",
    title: "Team",
    description: "4 members — profiles, roles, social links, and capacity.",
    icon: "TeamIcon",
    overview:
      "Team of 4 building databayt. Each member has Claude Code configured for their role with tailored agents, MCPs, and permissions. The QA scope rule governs what Claude Code can do for non-architect roles.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/team",
    status: "behind",
    lastReviewed: "2026-04-01",
    progress: [
      "4 roles defined: founder, developer/QA, creative, ops",
      "Abdout's full config tested and operational",
      "Ali onboarded for QA on hogwarts (#115)",
      "QA scope rule deployed (.claude/rules/qa-scope.md)",
    ],
    improvements: [
      "Samia and Sedon not yet onboarded to Claude Code",
      "Role-specific settings.json templates not generated",
      "Team profile pages need social links and todo integration",
      "Missing onboarding guide for non-technical members",
    ],
    references: [
      { title: "Abdout — GitHub", url: "https://github.com/abdout", type: "social" },
      { title: "Abdout — LinkedIn", url: "https://linkedin.com/in/abdout", type: "social" },
      { title: "Ali — GitHub", url: "https://github.com/alitaworkem", type: "social" },
      { title: "Team Setup Docs", url: "https://docs.anthropic.com/en/docs/claude-code/team", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
    ],
    setup: [
      "Run the team setup script: .claude/setup/team-setup.sh",
      "Select role: founder, developer, designer, or ops",
      "Script configures settings.json with role-appropriate MCPs",
    ],
    usage: [
      "Abdout — Builder: full agent fleet, all MCPs, all keywords",
      "Ali — QA Engineer + Sales: testing, issue reports, outreach (sales@databayt.org)",
      "Samia — R&D & Kun Caretaker: Claude/Anthropic research, sharing economy, Kun care",
      "Sedon — Executor: clear task maps, Saudi operations, batch weekly",
    ],
    configPaths: [
      ".claude/setup/team-setup.sh",
      ".claude/settings.json",
      ".claude/rules/qa-scope.md",
    ],
    kunDocs: "/docs/team",
  },

  "quality-engineer": {
    id: "quality-engineer",
    title: "Quality Engineer",
    description: "Tracks 19 keywords, orchestrates QA, monitors coverage.",
    icon: "GuardianIcon",
    overview:
      "The Quality Engineer agent owns the 19 QA keywords. Each keyword has a niche scope (no overlap), runs against URLs (browser) or code (file analysis), and produces a clear verdict: PASS, WARN, or FAIL. The qa keyword orchestrates all 12 niche keywords per URL. The QE tracks keyword health, coverage across products, and ensures the system stays optimum.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/agents",
    status: "current",
    lastReviewed: "2026-04-01",
    progress: [
      "19 keywords defined with niche scopes — zero overlap",
      "qa orchestrator invokes all 12 per-URL keywords",
      "Browser-side: see, flow, debug, check, lang, fast",
      "Code-side: guard, architecture, structure, pattern, design, stack",
      "Deep: trace, performance, efficient",
      "Compare: mirror, diff",
      "Orchestrators: qa, handover",
      "QA scope rule deployed for Ali's governed sessions",
      "Hourly remote trigger for hogwarts #115",
    ],
    improvements: [
      "Run first full qa sweep on hogwarts admission (20 URLs)",
      "Add keyword health dashboard to kun app",
      "Track pass rates per product over time",
      "Automate keyword self-test (each keyword tests itself)",
      "Add keyword versioning for breaking changes",
    ],
    references: [
      { title: "Keywords in CLAUDE.md", url: "https://github.com/databayt/kun/blob/main/.claude/CLAUDE.md", type: "docs" },
      { title: "QE Agent Definition", url: "https://github.com/databayt/kun/blob/main/.claude/agents/quality-engineer.md", type: "docs" },
      { title: "Hogwarts QA Issue", url: "https://github.com/databayt/hogwarts/issues/115", type: "tool" },
      { title: "QA Scope Rule", url: "https://github.com/databayt/hogwarts/blob/main/.claude/rules/qa-scope.md", type: "docs" },
    ],
    setup: [
      "Keywords defined in ~/.claude/CLAUDE.md under ## Keywords",
      "QE agent at .claude/agents/quality-engineer.md",
      "qa keyword reads checklist from GitHub Issue, runs all keywords per URL",
      "Hourly remote trigger for autonomous QA on hogwarts",
    ],
    usage: [
      "qa — run all 12 keywords on every URL in the checklist",
      "qa [url] — run all 12 keywords on one specific URL",
      "see/flow/debug/check/lang/fast — browser-side niche checks",
      "guard/architecture/structure/pattern/design/stack — code-side niche checks",
      "trace/performance/efficient — deep optimization keywords",
      "mirror/diff — visual comparison keywords",
      "handover — qa + human judgment for final release",
    ],
    configPaths: [
      "~/.claude/CLAUDE.md (keyword definitions)",
      ".claude/agents/quality-engineer.md",
      ".claude/rules/qa-scope.md (hogwarts)",
    ],
    kunDocs: "/docs/quality",
  },

  "credentials": {
    id: "credentials",
    title: "Credentials",
    description: "Keychain-based API key management for 18 services.",
    icon: "CredentialsIcon",
    overview:
      "Credentials management uses macOS Keychain to securely store API keys for all 18 MCP services. No .env files with secrets — everything goes through Keychain. The secrets setup script handles storing and retrieving keys for GitHub, Vercel, Neon, Stripe, Figma, and more. Claude Code reads them at runtime through environment variables injected by the MCP config.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/settings",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "Keychain-based secrets management operational",
      "secrets.sh script handles all 18 service keys",
      "Per-project DATABASE_URLs supported for multi-repo work",
      "No .env files with secrets in any repo",
    ],
    improvements: [
      "No key rotation reminders — some keys may be stale",
      "Keychain approach is macOS-only — need Linux alternative for CI",
      "Missing audit log of which keys are accessed when",
      "Could add key expiration tracking",
    ],
    references: [
      { title: "Settings & Environment", url: "https://docs.anthropic.com/en/docs/claude-code/settings", type: "docs" },
      { title: "macOS Keychain", url: "https://support.apple.com/guide/keychain-access/", type: "docs" },
    ],
    setup: [
      "Run .claude/setup/secrets.sh to configure API keys",
      "Keys are stored in macOS Keychain, not .env files",
      "MCP servers reference keys via env vars in settings.json",
      "Per-project DATABASE_URLs supported for multi-repo work",
    ],
    usage: [
      "security add-generic-password for storing keys",
      "security find-generic-password for retrieving keys",
      "Never commit API keys — always use Keychain",
      "Settings.json env block injects keys into MCP servers",
      "/credentials command manages the full lifecycle",
    ],
    configPaths: [
      ".claude/setup/secrets.sh",
      "macOS Keychain (claude-code service)",
    ],
    kunDocs: "/docs/credentials",
  },

  "tips": {
    id: "tips",
    title: "Tips",
    description: "Master-level techniques and hidden spells.",
    icon: "TipsIcon",
    overview:
      "Advanced techniques that make Claude Code dramatically more effective. These are patterns learned through heavy usage — prompt engineering tricks, context window management, parallel agent execution, worktree isolation for safe experiments, and keyboard shortcuts that save hours. The team should review these regularly to keep skills sharp.",
    officialDocs: "https://docs.anthropic.com/en/docs/claude-code/tips-and-tricks",
    status: "current",
    lastReviewed: "2026-03-31",
    progress: [
      "Core tips documented: effort levels, compact, worktrees, parallel agents",
      "Keyboard shortcuts mapped and practiced",
      "Visual keywords (see, debug, check, trace) fully operational",
      "Context management strategies tested across long sessions",
    ],
    improvements: [
      "Tips not shared with team yet — only Abdout knows them",
      "No structured onboarding for learning tips progressively",
      "Missing tips for: batch API usage, cost optimization, caching",
      "Could create a quick-reference cheat sheet",
    ],
    references: [
      { title: "Tips and Tricks", url: "https://docs.anthropic.com/en/docs/claude-code/tips-and-tricks", type: "docs" },
      { title: "Best Practices", url: "https://docs.anthropic.com/en/docs/claude-code/best-practices", type: "docs" },
      { title: "Claude Code Overview", url: "https://docs.anthropic.com/en/docs/claude-code/overview", type: "docs" },
      { title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", type: "repo" },
    ],
    setup: [
      "Read the tips docs page for the full collection",
      "Practice keyboard shortcuts: Esc (interrupt), Tab (accept), Shift+Tab (reject)",
      "Learn context management — /compact, /clear, conversation splitting",
      "Master the effort levels — /effort min, /effort max",
    ],
    usage: [
      "/effort max — Deep reasoning for complex architecture decisions",
      "/compact — Compress context when hitting limits",
      "Worktree isolation — Safe experiments without affecting main branch",
      "Parallel agents — Launch multiple specialists simultaneously",
      "! prefix — Run shell commands inline from the prompt",
      "Image paste — Drop screenshots directly into the conversation",
    ],
    configPaths: [
      "No config — these are usage patterns",
    ],
    kunDocs: "/docs/tips",
  },

  "tweets": {
    id: "tweets",
    title: "Tweets",
    description: "Track Claude updates and tips on X.",
    icon: "TwitterIcon",
    overview:
      "Tracking Anthropic announcements, Claude Code tips, and community discoveries on X (Twitter). This is how we stay ahead of changes — new features, deprecations, and community-discovered patterns often appear on X before they hit the docs. Key accounts to follow: @AnthropicAI, @alexalbert__, @birgermoell, and the Claude Code community.",
    officialDocs: "https://x.com/AnthropicAI",
    status: "review",
    lastReviewed: "2026-03-20",
    progress: [
      "@AnthropicAI followed for official announcements",
      "Anthropic blog checked periodically",
      "Changelog reviewed when issues arise",
    ],
    improvements: [
      "No systematic tracking — updates get missed",
      "No team RSS feed or aggregator for Anthropic news",
      "Community tips not collected or archived",
      "Could create a weekly digest automation",
      "Missing Twitter list for Claude Code community accounts",
    ],
    references: [
      { title: "@AnthropicAI on X", url: "https://x.com/AnthropicAI", type: "tool" },
      { title: "Anthropic Blog", url: "https://www.anthropic.com/blog", type: "article" },
      { title: "Anthropic Research", url: "https://www.anthropic.com/research", type: "article" },
      { title: "Claude Changelog", url: "https://docs.anthropic.com/en/docs/changelog", type: "docs" },
    ],
    setup: [
      "Follow @AnthropicAI on X for official announcements",
      "Follow Claude Code community accounts for tips",
      "Check Anthropic blog weekly for product updates",
      "Review changelog for breaking changes and new features",
    ],
    usage: [
      "Weekly: Check @AnthropicAI for new announcements",
      "Weekly: Read Anthropic blog for detailed updates",
      "Monthly: Review changelog for missed features",
      "Share discoveries in team Dispatch notes",
      "Update topic statuses when new features are announced",
    ],
    configPaths: [
      "No config — external tracking",
    ],
    kunDocs: "/docs/tweets",
  },
}

export function getTopicDetail(slug: string): TopicDetail | undefined {
  return topicDetails[slug]
}

export function getAllTopicSlugs(): string[] {
  return Object.keys(topicDetails)
}
