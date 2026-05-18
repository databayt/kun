import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

// Old flat slug → new nested slug. Flat docs were restructured into shadcn-style sections.
// Keep these as 307 (permanent: false) for ~7 days, then flip to 301 once external referrers settle.
const DOCS_REDIRECTS: Array<[string, string]> = [
  ["onboarding", "installation"],
  ["claude-code", "installation/claude-code"],
  ["self-hosting", "installation/self-hosting"],
  ["claude-md", "engine/claude-md"],
  ["agents", "engine/agents"],
  ["skills", "engine/skills"],
  ["commands", "engine/commands"],
  ["mcp", "engine/mcp"],
  ["hooks", "engine/hooks"],
  ["rules", "engine/rules"],
  ["memory", "engine/memory"],
  ["keywords", "engine/keywords"],
  ["captain", "operations/captain"],
  ["team", "operations/team"],
  ["dispatch", "operations/dispatch"],
  ["context", "operations/context"],
  ["cowork", "operations/cowork"],
  ["voice", "operations/voice"],
  ["credentials", "operations/credentials"],
  ["connectors", "operations/connectors"],
  ["apps", "operations/apps"],
  ["issue", "operations/issue"],
  ["configuration", "reference/configuration"],
  ["architecture", "reference/architecture"],
  ["workflows", "reference/workflows"],
  ["products", "reference/products"],
  ["prd", "reference/prd"],
  ["epics", "reference/epics"],
  ["repositories", "reference/repositories"],
  ["projects", "reference/projects"],
  ["stack", "reference/stack"],
  ["slack", "reference/slack"],
  ["secrets", "reference/secrets"],
  ["tips", "resources/tips"],
  ["tweets", "resources/tweets"],
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async redirects() {
    return DOCS_REDIRECTS.flatMap(([from, to]) => [
      { source: `/docs/${from}`, destination: `/docs/${to}`, permanent: false },
      { source: `/:lang/docs/${from}`, destination: `/:lang/docs/${to}`, permanent: false },
    ]);
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
