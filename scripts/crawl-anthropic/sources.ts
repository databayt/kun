import type { PageSource } from "./types.js";

const ANTHROPIC = "https://www.anthropic.com";
const CLAUDE_AI = "https://claude.ai";
const CLAUDE_COM = "https://www.claude.com";
const DOCS = "https://docs.claude.com";
const SUPPORT = "https://support.anthropic.com";
const STATUS = "https://status.claude.com";
const GITHUB = "https://github.com";

export const URL_INDEX_EXTENDED: PageSource[] = [
  { url: `${ANTHROPIC}/`, group: "main" },
  { url: `${ANTHROPIC}/company`, group: "main" },
  { url: `${ANTHROPIC}/careers`, group: "main" },
  { url: `${ANTHROPIC}/events`, group: "main" },
  { url: `${ANTHROPIC}/learn`, group: "main" },
  { url: `${ANTHROPIC}/news`, group: "main",
    followLinks: { selector: 'a[href^="/news/"]', depth: 1 } },
  { url: `${ANTHROPIC}/research`, group: "main",
    followLinks: { selector: 'a[href^="/research/"]', depth: 1 } },
  { url: `${ANTHROPIC}/science`, group: "main" },
  { url: `${ANTHROPIC}/transparency`, group: "main" },
  { url: `${ANTHROPIC}/constitution`, group: "main" },
  { url: `${ANTHROPIC}/economic-futures`, group: "main" },
  { url: `${ANTHROPIC}/responsible-scaling-policy`, group: "main" },

  { url: `${ANTHROPIC}/pricing`, group: "pricing", dynamic: true },
  { url: `${ANTHROPIC}/api/pricing`, group: "pricing", dynamic: true },

  { url: `${ANTHROPIC}/customers`, group: "customers",
    followLinks: { selector: 'a[href^="/customers/"]', depth: 1 } },

  { url: `${ANTHROPIC}/enterprise`, group: "enterprise", dynamic: true },
  { url: `${ANTHROPIC}/solutions/enterprise`, group: "enterprise", dynamic: true },
  { url: `${ANTHROPIC}/solutions/financial-services`, group: "enterprise", dynamic: true },
  { url: `${ANTHROPIC}/solutions/healthcare`, group: "enterprise", dynamic: true },
  { url: `${ANTHROPIC}/solutions/legal`, group: "enterprise", dynamic: true },

  { url: `${ANTHROPIC}/trust-center`, group: "trust" },
  { url: `${ANTHROPIC}/security`, group: "trust" },
  { url: `${ANTHROPIC}/legal/subprocessors`, group: "trust" },

  { url: `${ANTHROPIC}/support`, group: "support" },
  { url: `${ANTHROPIC}/contact-sales`, group: "support" },

  { url: `${ANTHROPIC}/claude/opus`, group: "products", dynamic: true },
  { url: `${ANTHROPIC}/claude/sonnet`, group: "products", dynamic: true },
  { url: `${ANTHROPIC}/claude/haiku`, group: "products", dynamic: true },
  { url: `${ANTHROPIC}/product/claude-code`, group: "products", dynamic: true },
  { url: `${ANTHROPIC}/product/claude-cowork`, group: "products", dynamic: true },

  { url: `${ANTHROPIC}/engineering`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/building-effective-agents`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/claude-code-best-practices`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/claude-code-auto-mode`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/effective-context-engineering-for-ai-agents`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/writing-tools-for-agents`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/building-c-compiler`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/advanced-tool-use`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/code-execution-with-mcp`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/claude-code-sandboxing`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/effective-harnesses-for-long-running-agents`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/desktop-extensions`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/claude-think-tool`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/swe-bench-sonnet`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/contextual-retrieval`, group: "engineering" },
  { url: `${ANTHROPIC}/engineering/infrastructure-noise`, group: "engineering" },

  { url: `${ANTHROPIC}/features/81k-interviews`, group: "features", dynamic: true },
  { url: `${ANTHROPIC}/features/claude-on-mars`, group: "features", dynamic: true },

  { url: `${ANTHROPIC}/learn/build-with-claude`, group: "learn" },
  { url: `${ANTHROPIC}/learn/claude-for-work`, group: "learn" },
  { url: `${ANTHROPIC}/learn/claude-for-you`, group: "learn" },

  { url: `${ANTHROPIC}/legal/aup`, group: "legal" },
  { url: `${ANTHROPIC}/legal/commercial-terms`, group: "legal" },
  { url: `${ANTHROPIC}/legal/consumer-terms`, group: "legal" },
  { url: `${ANTHROPIC}/legal/privacy`, group: "legal" },
  { url: `${ANTHROPIC}/legal/cookies`, group: "legal" },
  { url: `${ANTHROPIC}/legal/trademark-guidelines`, group: "legal" },

  { url: CLAUDE_AI, group: "claude_public", dynamic: true },
  { url: `${CLAUDE_AI}/login`, group: "claude_public", dynamic: true },
  { url: `${CLAUDE_AI}/pricing`, group: "claude_public", dynamic: true },
  { url: CLAUDE_COM, group: "claude_public", dynamic: true },
  { url: `${CLAUDE_AI}/chats`, group: "claude_public", authWalled: true },
  { url: `${CLAUDE_AI}/projects`, group: "claude_public", authWalled: true },
  { url: `${CLAUDE_AI}/settings`, group: "claude_public", authWalled: true },

  { url: `${DOCS}/en/docs/claude-code/overview`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/docs/agent-sdk/overview`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/api/getting-started`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/docs/build-with-claude/mcp`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/docs/about-claude/models`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/docs/build-with-claude/prompt-engineering`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/docs/build-with-claude/tool-use`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/docs/build-with-claude/prompt-caching`, group: "docs", dynamic: true },
  { url: `${DOCS}/en/release-notes`, group: "docs", dynamic: true },

  { url: SUPPORT, group: "support_help",
    followLinks: { selector: 'a[href*="/articles/"]', depth: 1 } },

  { url: STATUS, group: "external" },

  { url: `${GITHUB}/anthropics`, group: "github_org",
    followLinks: { selector: 'a[itemprop="name codeRepository"]', depth: 1 } },
];
