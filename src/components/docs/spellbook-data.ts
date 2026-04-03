// Types
export type OrderType = "familiar" | "portal" | "skill" | "hook" | "ward" | "memory"

export interface OrderItem {
  type: OrderType
  name: string
}

export interface Spell {
  name: string
  effect: string
  order: OrderItem[]
  steps: string[]
  connects: string[]
  depends: string[]
}

export interface School {
  id: string
  number: string
  name: string
  subtitle: string
  description: string
  quote?: string
  spells: Spell[]
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: { keyword: string; action: string }[]
}

// Helper to reduce verbosity
const f = (name: string): OrderItem => ({ type: "familiar", name })
const p = (name: string): OrderItem => ({ type: "portal", name })
const s = (name: string): OrderItem => ({ type: "skill", name })
const h = (name: string): OrderItem => ({ type: "hook", name })
const w = (name: string): OrderItem => ({ type: "ward", name })
const m = (name: string): OrderItem => ({ type: "memory", name })

// ─── Schools ────────────────────────────────────────────────────────────────────

export const schools: School[] = [
  {
    id: "pipeline",
    number: "0",
    name: "The Pipeline",
    subtitle: "Idea to production in one word",
    description:
      "The most powerful magic in Kun. Each keyword is a complete pipeline stage. Chain them with `feature` to go from idea to customer's hands in minutes.",
    quote: "feature billing hogwarts — one line, eight stages, live in production.",
    spells: [
      {
        name: "feature",
        effect: "Chain all pipeline stages — idea to production",
        order: [f("orchestration"), f("architecture"), f("prisma"), f("nextjs"), f("react"), p("GitHub"), p("Vercel"), p("Neon"), p("Browser"), s("/feature")],
        steps: [
          "IDEA: Create structured GitHub issue with acceptance criteria",
          "SPEC: Data model sketch + file plan + refined criteria",
          "PAUSE: Human approves the spec",
          "SCHEMA: Prisma model + migration + Zod validation",
          "CODE: Server actions with auth + validation + tenant isolation",
          "WIRE: Pages + forms + tables + i18n wired to actions",
          "CHECK: Type-check + build + visual verification",
          "SHIP: Commit + push + Vercel deploy",
          "WATCH: Post-deploy health check + issue closed",
        ],
        connects: ["idea", "spec", "schema", "code", "wire", "check", "ship", "watch"],
        depends: [],
      },
      {
        name: "idea",
        effect: "Capture a feature as a structured GitHub issue",
        order: [p("GitHub"), s("/idea")],
        steps: [
          "Parse feature name + optional product scope",
          "Deduplicate: check for existing issues",
          "Read product context: existing pages, models, components",
          "Generate structured body: user story, acceptance criteria, scope",
          "Create issue with type:feature label",
        ],
        connects: ["spec"],
        depends: [],
      },
      {
        name: "spec",
        effect: "Technical specification — data model, file plan, human approval",
        order: [f("architecture"), f("prisma"), p("GitHub"), s("/spec")],
        steps: [
          "Read the feature issue",
          "Survey codebase: schema, routes, components, product CLAUDE.md",
          "Design: Prisma model sketch, file plan, refined acceptance criteria",
          "Publish spec as comment on the issue",
          "PAUSE: Human approves before implementation begins",
        ],
        connects: ["idea", "schema"],
        depends: ["idea"],
      },
      {
        name: "schema",
        effect: "Prisma model + migration + Zod validation schemas",
        order: [f("prisma"), f("typescript"), p("Neon"), s("/schema")],
        steps: [
          "Read spec from issue comments",
          "Create Prisma model with relations and tenant isolation",
          "Run prisma migrate dev",
          "Run prisma generate",
          "Create Zod validation schemas + TypeScript types",
          "Verify: pnpm tsc --noEmit",
        ],
        connects: ["spec", "code"],
        depends: ["spec"],
      },
      {
        name: "ready",
        effect: "Pre-code readiness gate — validates spec, schema, and dependencies",
        order: [f("product"), f("architecture"), f("typescript")],
        steps: [
          "Check spec exists on issue with acceptance criteria",
          "Check schema is migrated and types compile",
          "Check dependencies are resolved (no blocking issues)",
          "Check Definition of Ready checklist is met",
          "Verdict: PASS / CONCERNS / FAIL with reasons",
        ],
        connects: ["schema", "code"],
        depends: ["schema"],
      },
      {
        name: "code",
        effect: "Server actions with auth + Zod validation + tenant scoping",
        order: [f("nextjs"), f("typescript"), f("prisma"), s("/code"), w("auth")],
        steps: [
          "Read schema and types from previous stage",
          "Create server actions: create, list, get, update, delete",
          "Each action: auth check → Zod validate → Prisma query → revalidate",
          "Create authorization rules (RBAC if product uses it)",
          "Verify: pnpm tsc --noEmit",
        ],
        connects: ["ready", "wire"],
        depends: ["ready"],
      },
      {
        name: "wire",
        effect: "Pages + forms + tables + i18n — the layer users see",
        order: [f("nextjs"), f("react"), f("shadcn"), f("tailwind"), p("shadcn"), s("/wire"), h("Auto-Format")],
        steps: [
          "Create page.tsx (mirror pattern: thin wrapper)",
          "Create content.tsx (server component, data fetching)",
          "Create form.tsx (client, React Hook Form + Zod + server actions)",
          "Create columns.tsx (table column definitions if list view)",
          "Add i18n dictionary keys (en + ar)",
          "Add navigation entry if needed",
          "Verify: pnpm build",
        ],
        connects: ["code", "check"],
        depends: ["code"],
      },
      {
        name: "check",
        effect: "Quality gate — type-check + build + visual verification",
        order: [f("build"), f("typescript"), p("Browser"), s("/check")],
        steps: [
          "pnpm tsc --noEmit (fix loop, max 5)",
          "pnpm build (fix loop, max 5)",
          "Navigate to page with browser → screenshot → verify renders",
          "Run existing tests if present",
          "Report: all gates green or list failures",
        ],
        connects: ["wire", "ship"],
        depends: ["wire"],
      },
      {
        name: "ship",
        effect: "Commit + push + deploy to Vercel production + verify",
        order: [f("git"), f("deploy"), p("GitHub"), p("Vercel"), s("/deploy")],
        steps: [
          "Stage and commit with conventional message + Closes #N",
          "Push to main",
          "Deploy: npx vercel --prod --yes",
          "Poll deployment status until Ready (max 10 min)",
          "If Error: fetch logs, diagnose, fix, redeploy (max 3)",
        ],
        connects: ["check", "watch"],
        depends: ["check"],
      },
      {
        name: "watch",
        effect: "Post-deploy health check — confirm customer can use it",
        order: [f("deploy"), p("Vercel"), p("Browser"), s("/watch")],
        steps: [
          "Verify Vercel deployment status: Ready",
          "Navigate to production URL → screenshot",
          "Check console for JS errors",
          "Check network for failed requests",
          "Quick smoke test: click primary action, verify",
          "If clean: close feature issue with summary",
        ],
        connects: ["ship"],
        depends: ["ship"],
      },
    ],
  },
  {
    id: "charm-work",
    number: "I",
    name: "Charm Work",
    subtitle: "Everyday practical magic",
    description:
      "The spells you cast most often. Reliable, essential, and dangerously easy to take for granted. Professor Flitwick would be proud.",
    quote: "dev is your Lumos — the first spell each morning. validate is your Nox — the last before rest.",
    spells: [
      {
        name: "dev",
        effect: "Kill port 3000, start server, open Chrome",
        order: [s("/dev"), h("Port Guardian"), h("Chrome Opener")],
        steps: [
          "Hook kills port 3000 (lsof -ti:3000 | xargs kill -9)",
          "Chrome opens to localhost:3000",
          "pnpm dev starts Turbopack",
          "Hook confirms Chrome is watching",
        ],
        connects: ["build", "deploy"],
        depends: [],
      },
      {
        name: "build",
        effect: "Compile project, scan TypeScript errors, auto-repair",
        order: [f("build"), f("typescript"), s("/build"), h("Auto-Format"), w("deployment")],
        steps: [
          "pnpm tsc --noEmit (type check)",
          "If errors: analyze, auto-fix, re-check (up to 5 attempts)",
          "pnpm prisma generate",
          "pnpm lint (ESLint pass)",
          "pnpm build (production build)",
          "Post-build analysis: bundle size, warnings",
        ],
        connects: ["deploy", "fix", "validate"],
        depends: [],
      },
      {
        name: "push",
        effect: "Stage changes, conventional commit, push to remote",
        order: [f("git"), f("github"), p("GitHub")],
        steps: [
          "git status — survey changes",
          "git add — stage worthy files",
          'git commit -m "type(scope): message"',
          "git push — dispatch to remote",
        ],
        connects: ["deploy", "quick"],
        depends: [],
      },
      {
        name: "quick",
        effect: "Fast commit and push — skip build validation",
        order: [f("git"), f("github"), p("GitHub"), s("/quick")],
        steps: [
          "Quick lint check",
          "Auto-fix trivial issues",
          "git add + commit (skip build)",
          "git push",
        ],
        connects: ["push", "deploy"],
        depends: [],
      },
      {
        name: "deploy",
        effect: "Deploy to Vercel staging, retry up to 5 times",
        order: [f("deploy"), f("build"), p("Vercel"), p("Neon"), s("/deploy"), w("deployment")],
        steps: [
          "Check for uncommitted changes",
          "pnpm tsc --noEmit",
          "pnpm build (verify locally)",
          "Fix errors if any (loop up to 5x)",
          "npx vercel --yes (preview deploy)",
          "Poll status every 30 seconds",
          "If Error: fetch logs, diagnose, fix, redeploy",
          "If Ready: report URL and aliases",
        ],
        connects: ["build", "ship", "push"],
        depends: ["build"],
      },
      {
        name: "ship",
        effect: "Deploy straight to production — no staging",
        order: [f("deploy"), f("build"), p("Vercel"), s("/deploy"), w("deployment")],
        steps: ["Same as deploy but: npx vercel --prod --yes"],
        connects: ["deploy", "build"],
        depends: ["build", "test"],
      },
      {
        name: "validate",
        effect: "Run every quality check — lint, types, tests, security",
        order: [f("build"), f("test"), f("typescript"), w("testing")],
        steps: [
          "pnpm tsc --noEmit (type check)",
          "pnpm lint (ESLint)",
          "pnpm test (run tests)",
          "Report pass/fail for all gates",
        ],
        connects: ["build", "test", "security"],
        depends: [],
      },
    ],
  },
  {
    id: "transfiguration",
    number: "II",
    name: "Transfiguration",
    subtitle: "Creating something from nothing",
    description:
      "These spells conjure new files, components, and entire features into existence. From a single component to a full feature with database, API, and UI.",
    quote:
      "A poorly conceived block is like a half-transfigured hedgehog — functional but unsettling. Plan before you cast.",
    spells: [
      {
        name: "component",
        effect: "Conjure a new React component with proper structure",
        order: [f("react"), f("shadcn"), p("shadcn"), h("Auto-Format"), w("tailwind")],
        steps: ["Create component file", "Server Component by default", "Add 'use client' only if hooks needed"],
        connects: ["atom", "page"],
        depends: [],
      },
      {
        name: "page",
        effect: "Create a new Next.js App Router page",
        order: [f("nextjs"), f("architecture"), f("structure"), h("Auto-Format")],
        steps: [
          "Create app/[lang]/.../<name>/page.tsx",
          "Create loading.tsx (loading state)",
          "Create components/platform/<name>/content.tsx (mirror pattern)",
          "Create components/platform/<name>/actions.ts (server actions)",
        ],
        connects: ["component", "api", "template"],
        depends: [],
      },
      {
        name: "api",
        effect: "Materialize a Server Action with validation",
        order: [f("nextjs"), f("typescript"), h("Auto-Format"), w("auth"), w("prisma")],
        steps: [
          '"use server" directive',
          "Auth check (getServerSession)",
          "Zod validation",
          "Prisma query with schoolId",
          "revalidatePath",
        ],
        connects: ["page", "prisma", "auth"],
        depends: ["prisma"],
      },
      {
        name: "atom",
        effect: "Fuse 2+ shadcn/ui primitives into a reusable component",
        order: [f("atom"), f("shadcn"), p("shadcn"), s("/atom"), h("Auto-Format"), w("tailwind"), m("atom.json")],
        steps: [
          "Check if atom exists in src/components/atom/",
          "Identify required shadcn/ui primitives (min 2)",
          "Create src/components/atom/{name}.tsx",
          "Apply design rules: single purpose, typed, className prop, RTL",
          "Register in src/registry/atoms-index.ts",
          "Generate MDX docs",
        ],
        connects: ["template", "component", "shadcn"],
        depends: ["shadcn"],
      },
      {
        name: "template",
        effect: "Assemble a complete page layout from established patterns",
        order: [f("template"), f("atom"), p("shadcn"), s("/template"), h("Auto-Format"), w("tailwind"), m("template.json")],
        steps: [
          "Check src/registry/default/templates/{name}/",
          "Identify category (hero, header, sidebar, footer, login, dashboard)",
          "Create page.tsx with naming {type}-{number}",
          "Register in src/registry/registry-templates.ts",
          "pnpm build:templates (rebuild registry)",
        ],
        connects: ["atom", "block", "page"],
        depends: ["atom"],
      },
      {
        name: "block",
        effect: "Full UI component with business logic, data fetching, state",
        order: [f("block"), f("atom"), f("prisma"), p("shadcn"), p("GitHub"), p("Neon"), s("/block"), h("Auto-Format"), w("prisma"), w("auth"), m("block.json")],
        steps: [
          "Identify source type (github:, shadcn:, internal:)",
          "Fetch and analyze source",
          "Transform imports to project paths",
          "Adapt: Auth.js, Prisma, OKLCH, RTL",
          "Create mirror-pattern structure",
          "Add i18n (Arabic + English)",
          "Register in block.json",
          "pnpm tsc --noEmit (validate)",
          "Quality audit (100-point score)",
        ],
        connects: ["template", "atom", "saas"],
        depends: ["atom", "prisma"],
      },
      {
        name: "feature",
        effect: "Plan and create entire feature end-to-end",
        order: [f("orchestration"), f("architecture"), f("nextjs"), f("prisma"), f("react"), f("test"), f("build")],
        steps: [
          "Architecture (schema design)",
          "Database (migration)",
          "Backend (server actions)",
          "Frontend (components)",
          "Styling (tailwind)",
          "Testing (vitest + playwright)",
          "Build validation",
        ],
        connects: ["saas", "block", "migration", "test"],
        depends: ["plan"],
      },
      {
        name: "migration",
        effect: "Create Prisma migration — reshape database safely",
        order: [f("prisma"), f("architecture"), p("Neon"), h("Auto-Format"), w("prisma")],
        steps: [
          "Modify prisma/models/*.prisma",
          "pnpm prisma migrate dev --name <desc>",
          "pnpm prisma generate",
          "Verify with Neon MCP if remote",
        ],
        connects: ["prisma", "feature", "saas"],
        depends: ["prisma"],
      },
    ],
  },
  {
    id: "ancient-runes",
    number: "III",
    name: "Ancient Runes",
    subtitle: "The foundational frameworks",
    description:
      "The ancient languages upon which everything else is built. Each carries the weight of an entire framework.",
    quote: "When you say prisma, you invoke not just a tool but a philosophy of data.",
    spells: [
      {
        name: "nextjs",
        effect: "Apply Next.js 16 patterns — App Router, Server Components",
        order: [f("nextjs"), f("react"), f("middleware"), s("/nextjs")],
        steps: ["Async params/searchParams", "Server Components by default", "Server Actions with 'use server'", "Streaming with Suspense"],
        connects: ["react", "typescript", "page"],
        depends: [],
      },
      {
        name: "react",
        effect: "Channel React 19 — hooks, concurrent features",
        order: [f("react"), f("nextjs"), f("typescript")],
        steps: ["useActionState", "useOptimistic", "use() hook", "React Hook Form + Zod"],
        connects: ["nextjs", "component", "typescript"],
        depends: [],
      },
      {
        name: "typescript",
        effect: "Enforce strict mode — no any, Zod schemas, type guards",
        order: [f("typescript"), f("react"), f("nextjs")],
        steps: ["No any allowed", "Zod at boundaries", "Discriminated unions", "Prisma type integration"],
        connects: ["react", "nextjs", "build"],
        depends: [],
      },
      {
        name: "prisma",
        effect: "Database oracle — queries, relations, Prisma 6",
        order: [f("prisma"), f("architecture"), p("Neon"), w("prisma")],
        steps: ["Multi-tenant schoolId", "Relations + indexes", "CRUD operations", "$extends patterns"],
        connects: ["migration", "neon", "api"],
        depends: [],
      },
      {
        name: "tailwind",
        effect: "Tailwind CSS 4 — semantic tokens, responsive, RTL",
        order: [f("tailwind"), f("shadcn"), f("semantic"), w("tailwind")],
        steps: ["OKLCH colors", "CSS-first config (no JS)", "RTL logical properties (ms/me/ps/pe)", "Container queries"],
        connects: ["shadcn", "component", "template"],
        depends: [],
      },
      {
        name: "shadcn",
        effect: "Summon components from the shadcn/ui registry",
        order: [f("shadcn"), f("atom"), f("tailwind"), p("shadcn")],
        steps: ["Search registry via MCP", "View component details", "Get install command", "Install to src/components/ui/"],
        connects: ["atom", "component", "tailwind"],
        depends: [],
      },
    ],
  },
  {
    id: "conjuration",
    number: "IV",
    name: "Conjuration",
    subtitle: "Summoning UI elements",
    description:
      "Each incantation calls forth a specific UI pattern — complete, styled, ready. Combine with a noun and the spell adapts.",
    quote: "table users, form settings, modal confirm — the spell adapts to your intent.",
    spells: [
      { name: "table", effect: "DataTable with sorting, filtering, pagination", order: [f("block"), f("prisma"), p("shadcn")], steps: ["@tanstack/react-table", "Column definitions", "Server-side filtering", "Row actions"], connects: ["block", "prisma"], depends: ["shadcn"] },
      { name: "header", effect: "Page header with navigation", order: [f("template"), p("shadcn")], steps: ["Sticky top", "Responsive", "Mobile hamburger"], connects: ["navbar", "template"], depends: ["shadcn"] },
      { name: "menu", effect: "Navigation menu or sidebar", order: [f("template"), p("shadcn")], steps: ["Collapsible", "Icon + label", "Active state"], connects: ["sidebar", "navbar"], depends: ["shadcn"] },
      { name: "form", effect: "Form with validation", order: [f("react"), f("block"), p("shadcn")], steps: ["React Hook Form + Zod", "shadcn Form component", "Server Action on submit"], connects: ["api", "block"], depends: ["shadcn", "react"] },
      { name: "modal", effect: "Dialog — appears exactly when needed", order: [f("shadcn"), f("atom"), p("shadcn")], steps: ["Radix Dialog", "ConfirmDialog pattern", "Keyboard dismiss"], connects: ["form", "atom"], depends: ["shadcn"] },
      { name: "card", effect: "Card variations with flexible content", order: [f("atom"), p("shadcn")], steps: ["Card + Badge + Avatar", "Semantic tokens", "Responsive grid"], connects: ["atom", "template"], depends: ["shadcn"] },
      { name: "sidebar", effect: "Sidebar navigation — collapsible", order: [f("template"), p("shadcn")], steps: ["SidebarProvider", "Collapsible groups", "Keyboard toggle"], connects: ["menu", "dashboard"], depends: ["shadcn"] },
      { name: "footer", effect: "Footer component — multi-column layout", order: [f("template"), p("shadcn")], steps: ["Multi-column responsive", "Social links", "Copyright"], connects: ["template", "landing"], depends: ["shadcn"] },
      { name: "hero", effect: "Hero section — the grand entrance", order: [f("template"), p("shadcn")], steps: ["Centered/split/gradient", "CTA buttons", "Responsive typography"], connects: ["landing", "template"], depends: ["shadcn"] },
      { name: "navbar", effect: "Top navigation bar", order: [f("template"), p("shadcn")], steps: ["NavigationMenu from Radix", "Dropdown menus", "Mobile sheet", "Auth state"], connects: ["header", "auth"], depends: ["shadcn"] },
    ],
  },
  {
    id: "dark-arts",
    number: "V",
    name: "The Dark Arts of Features",
    subtitle: "N.E.W.T.-level system enchantments",
    description:
      "Not dark in nature, but dark in complexity. Each creates an entire system — multiple agents, MCP servers, and spell chains working in concert.",
    quote:
      "saas billing orchestrates 6 familiars, opens 3 portals, and generates an entire billing system. From two words.",
    spells: [
      {
        name: "auth",
        effect: "Complete authentication — NextAuth v5, JWT, OAuth, middleware",
        order: [f("authjs"), f("middleware"), f("prisma"), f("nextjs"), w("auth")],
        steps: [
          "Configure auth.ts with PrismaAdapter",
          "Set up OAuth + Credentials providers",
          "JWT/session callbacks (id, role, schoolId)",
          "Route handler at api/auth/[...nextauth]",
          "Middleware for route protection",
          "SessionProvider in layout",
          "Type extensions in next-auth.d.ts",
        ],
        connects: ["middleware", "prisma", "admin"],
        depends: ["prisma"],
      },
      {
        name: "saas",
        effect: "Database schema + server actions + UI + billing integration",
        order: [f("orchestration"), f("architecture"), f("prisma"), f("nextjs"), f("shadcn"), f("react"), p("Stripe"), p("Neon"), p("shadcn"), s("/saas"), w("prisma"), w("auth")],
        steps: [
          "Database schema (Prisma model)",
          "Relations + migration",
          "Server actions with CRUD + Zod",
          "UI: DataTable, Forms, Detail views",
          "Pages: App Router routes",
          "Integrations: Stripe, auth, analytics",
        ],
        connects: ["block", "migration", "deploy"],
        depends: ["prisma", "auth"],
      },
      {
        name: "dashboard",
        effect: "Dashboard layout with charts, metrics, data viz",
        order: [f("template"), f("block"), f("react"), f("prisma"), p("shadcn")],
        steps: ["Sidebar layout", "Stat cards (atom)", "Charts (lazy loaded)", "Data tables (block)", "Promise.all for parallel fetch"],
        connects: ["sidebar", "table", "card"],
        depends: ["auth", "prisma"],
      },
      {
        name: "landing",
        effect: "Landing page — hero, features, pricing, testimonials, footer",
        order: [f("template"), f("atom"), f("tailwind"), p("shadcn")],
        steps: ["Compose multiple template sections", "Each section is a Server Component", "Responsive design"],
        connects: ["hero", "footer", "template"],
        depends: [],
      },
      {
        name: "checkout",
        effect: "Payment checkout flow — cart, Stripe, confirmation",
        order: [f("block"), f("architecture"), f("prisma"), p("Stripe"), w("auth"), w("prisma")],
        steps: ["Stripe integration", "Order model", "Checkout form", "Payment processing", "Webhook handler"],
        connects: ["stripe", "auth", "saas"],
        depends: ["auth", "prisma", "stripe"],
      },
      { name: "settings", effect: "Settings page — forms, tabs, preferences", order: [f("nextjs"), f("template"), f("react"), w("auth")], steps: ["Mirror-pattern page", "Tab sections", "Server actions", "Auth checks"], connects: ["profile", "auth"], depends: ["auth"] },
      { name: "profile", effect: "User profile — avatar, details, activity", order: [f("nextjs"), f("template"), f("react"), w("auth")], steps: ["Mirror-pattern page", "Avatar upload", "Form editing", "Activity history"], connects: ["settings", "auth"], depends: ["auth"] },
      { name: "admin", effect: "Admin panel — user management, analytics", order: [f("nextjs"), f("template"), f("react"), w("auth")], steps: ["Role guard (ADMIN)", "User management", "Analytics dashboard", "Configuration"], connects: ["dashboard", "auth"], depends: ["auth"] },
      { name: "onboarding", effect: "User onboarding — steps, progress, completion", order: [f("nextjs"), f("template"), f("react")], steps: ["Multi-step wizard", "Progress indicator", "Completion callback", "First-use detection"], connects: ["auth", "dashboard"], depends: ["auth"] },
    ],
  },
  {
    id: "animation",
    number: "VI",
    name: "Animation Charms",
    subtitle: "Giving life to stillness",
    description:
      "The ancient art of making the inanimate move with purpose. Framer Motion is the wand, intent is the magic.",
    quote: "Like the Weasley twins' fireworks — magnificent in moderation, catastrophic in excess.",
    spells: [
      { name: "motion", effect: "Breathe Framer Motion into components", order: [f("react"), f("tailwind"), s("/motion"), h("Auto-Format")], steps: ["motion.div with initial/animate/exit", "Variants for orchestrated sequences", "Layout animations"], connects: ["animation", "transition"], depends: [] },
      { name: "animation", effect: "CSS or Framer animations", order: [f("react"), f("tailwind"), s("/motion")], steps: ["@keyframes for simple effects", "Framer Motion for complex choreography"], connects: ["motion", "scroll"], depends: [] },
      { name: "transition", effect: "Page transitions — smooth apparition between views", order: [f("react"), f("nextjs"), s("/motion")], steps: ["AnimatePresence wrapping routes", "Exit animations before new page mounts"], connects: ["motion", "page"], depends: [] },
      { name: "gesture", effect: "Touch and drag interactions", order: [f("react"), s("/motion")], steps: ["whileHover, whileTap", "drag with dragConstraints", "Spring physics"], connects: ["motion", "animation"], depends: [] },
      { name: "scroll", effect: "Scroll-triggered animations", order: [f("react"), s("/motion")], steps: ["whileInView with viewport({ once: true })", "Intersection Observer"], connects: ["motion", "hero"], depends: [] },
    ],
  },
  {
    id: "defense",
    number: "VII",
    name: "Defense Against the Dark Arts",
    subtitle: "Protection from bugs and entropy",
    description:
      "The spells that protect your code from dark forces: bugs, vulnerabilities, regressions, and the slow entropy of neglect.",
    quote: "Constant vigilance! A codebase without tests is a castle without wards.",
    spells: [
      {
        name: "test",
        effect: "Generate tests — Vitest for units, Playwright for journeys",
        order: [f("test"), f("react"), f("nextjs"), p("Browser"), s("/test"), w("testing")],
        steps: ["Vitest unit/component tests", "Playwright E2E (chromium/firefox/webkit/mobile)", "95%+ coverage target", "Test accounts with configured credentials"],
        connects: ["e2e", "coverage", "build"],
        depends: [],
      },
      { name: "e2e", effect: "End-to-end tests across all browsers", order: [f("test"), p("Browser"), w("testing")], steps: ["Playwright all browsers", "browser-headed MCP for auth flows", "Visual regression"], connects: ["test", "handover"], depends: [] },
      { name: "coverage", effect: "Reveal test coverage — the Marauder's Map", order: [f("test"), w("testing")], steps: ["pnpm test --coverage", "V8 provider", "Lines, branches, functions, statements"], connects: ["test"], depends: ["test"] },
      { name: "review", effect: "Code review — examining decisions", order: [f("pattern"), f("architecture"), f("typescript"), f("react")], steps: ["Server/client boundaries", "Sequential data fetching", "Form validation", "Multi-tenant schoolId", "Semantic tokens"], connects: ["audit", "security"], depends: [] },
      {
        name: "security",
        effect: "OWASP Top 10 security audit",
        order: [f("guardian"), f("authjs"), f("pattern"), p("Sentry"), s("/security"), w("auth")],
        steps: ["OWASP Top 10 scan", "Input validation + output encoding", "Auth flow analysis", "pnpm audit (dependencies)", "Environment check"],
        connects: ["audit", "auth", "review"],
        depends: [],
      },
      { name: "audit", effect: "Full quality audit — security + performance + quality", order: [f("guardian"), f("pattern"), f("performance"), f("test")], steps: ["Security sweep", "Performance check", "Code quality", "Accessibility", "Testing coverage"], connects: ["security", "performance", "test"], depends: [] },
      { name: "analyze", effect: "Cross-artifact consistency — spec vs schema vs code vs tests", order: [f("product"), f("architecture"), f("typescript"), f("prisma")], steps: ["Read spec acceptance criteria", "Compare schema to spec data model", "Verify code implements all spec actions", "Check tests cover acceptance criteria", "Report: consistent / drift / missing"], connects: ["review", "ready", "audit"], depends: [] },
      { name: "constitution", effect: "Read or update project constitution — immutable governance principles", order: [f("architecture"), f("pattern"), m("preferences")], steps: ["Read current CLAUDE.md governance sections", "Compare against constitution principles", "Flag violations or drift", "Propose updates if principles evolved", "Write updated constitution to CLAUDE.md"], connects: ["review", "analyze"], depends: [] },
      { name: "accessibility", effect: "WCAG 2.1 AA compliance check", order: [f("semantic"), f("tailwind"), f("shadcn")], steps: ["Semantic HTML", "ARIA labels", "Keyboard navigation", "Color contrast", "Focus management"], connects: ["audit", "review"], depends: [] },
      { name: "optimize", effect: "Performance optimization", order: [f("performance"), f("nextjs"), f("react"), p("Vercel")], steps: ["Identify bottlenecks", "Apply optimizations", "Verify improvement"], connects: ["performance", "build"], depends: [] },
      {
        name: "performance",
        effect: "Core Web Vitals diagnostic",
        order: [f("performance"), f("nextjs"), f("react"), f("prisma"), p("Vercel"), p("Neon"), s("/performance")],
        steps: ["Core Web Vitals (LCP <2.5s, INP <200ms, CLS <0.1)", "Bundle analysis (ANALYZE=true)", "DB query optimization (N+1, indexes)", "React rendering profiling", "Memory leak detection", "7 quality gates report"],
        connects: ["optimize", "build", "deploy"],
        depends: [],
      },
    ],
  },
  {
    id: "reparo",
    number: "VIII",
    name: "Reparo",
    subtitle: "The mending spells",
    description:
      "When things break — and they will — these incantations diagnose and repair with surgical precision.",
    quote: "A true master does not fear errors. They cast fix and move on.",
    spells: [
      { name: "fix", effect: "Auto-repair all lint, type, and build errors", order: [f("build"), f("typescript"), s("/fix"), h("Auto-Format")], steps: ["TypeScript check", "Auto-fix type errors", "Lint fix", "Build verify"], connects: ["build", "error"], depends: [] },
      { name: "error", effect: "Scan for errors and fix them", order: [f("build"), f("sse"), f("typescript"), p("Sentry")], steps: ["204+ error patterns", "Dictionary access, Prisma types", "Missing schoolId, hooks in server components", "95% auto-fix rate"], connects: ["fix", "scan"], depends: [] },
      { name: "scan", effect: "Sweep entire codebase for issues", order: [f("build"), f("sse"), f("typescript")], steps: ["Anti-patterns", "Type errors", "Unused imports", "Dead code"], connects: ["fix", "error", "lint"], depends: [] },
      { name: "lint", effect: "Run ESLint", order: [f("build")], steps: ["pnpm lint", "Report issues with file paths and lines"], connects: ["fix", "format"], depends: [] },
      { name: "format", effect: "Run Prettier", order: [h("Auto-Format")], steps: ["npx prettier --write", "Auto-Format hook already runs on every edit"], connects: ["lint", "fix"], depends: [] },
      { name: "type-check", effect: "TypeScript strict checking — Veritaserum for types", order: [f("typescript")], steps: ["pnpm tsc --noEmit", "Report errors with locations", "No JS emitted, pure validation"], connects: ["build", "fix"], depends: [] },
      {
        name: "report",
        effect: "Auto-fix user-reported issues — read, verify, fix, close",
        order: [f("report"), f("quality-engineer"), f("sse"), f("build"), p("GitHub"), p("Browser")],
        steps: [
          "Session start: check open report issues across all repos",
          "READ: gh issue view → extract page URL + description",
          "LOCATE: URL → route directory (src/app/) + component directory (src/components/)",
          "CONTEXT: read CLAUDE.md, README.md, ISSUE.md for the feature",
          "VALIDATE: real bug? aligned with plans? safe to fix?",
          "SEE + DEBUG: screenshot page, check console errors, network failures",
          "IDENTIFY: correlate report + visual + errors → root cause",
          "FIX: edit minimum code in component directory",
          "BUILD: pnpm build — verify no regressions",
          "PUSH: conventional commit (fix: ...) + push to main",
          "VERIFY: see the page again after deploy",
          "CLOSE: close issue with fix summary",
        ],
        connects: ["fix", "error", "build", "deploy"],
        depends: [],
      },
    ],
  },
  {
    id: "quill",
    number: "IX",
    name: "Quill Charms",
    subtitle: "The spells of documentation",
    description:
      "Often neglected, always essential. Like Madam Pince guarding the library, these preserve knowledge.",
    quote: "The Memory Charms done right — instead of erasing knowledge, they preserve it.",
    spells: [
      { name: "docs", effect: "Generate MDX documentation", order: [f("comment"), f("pattern"), s("/docs"), h("Auto-Format")], steps: ["Installation", "Usage", "Props table", "Examples", "API reference"], connects: ["readme", "storybook"], depends: [] },
      { name: "readme", effect: "Create or update the README", order: [f("comment"), s("/docs")], steps: ["Project description", "Installation", "Quick start", "Contributing"], connects: ["docs", "changelog"], depends: [] },
      { name: "api-docs", effect: "API documentation — every endpoint", order: [f("comment"), f("typescript"), s("/docs")], steps: ["Endpoint descriptions", "Request/response schemas", "Auth requirements", "Error codes"], connects: ["docs", "api"], depends: [] },
      { name: "storybook", effect: "Component stories", order: [f("comment"), s("/docs")], steps: ["*.stories.tsx files", "Default + variant stories", "Interactive args table"], connects: ["docs", "component"], depends: [] },
      { name: "changelog", effect: "Update changelog from commit history", order: [f("comment"), s("/docs")], steps: ["Parse conventional commits", "Group by type (feat, fix, refactor)"], connects: ["docs", "push"], depends: [] },
    ],
  },
  {
    id: "geminio",
    number: "X",
    name: "Geminio",
    subtitle: "Duplication and summoning",
    description:
      "Why build from scratch? These clone, copy, and adapt existing work — the Geminio charm applied to code.",
    quote: "clone table from codebase summons the DataTable. clone vercel/ai reaches across GitHub.",
    spells: [
      { name: "clone", effect: "Clone from codebase or any GitHub repo", order: [f("github"), f("shadcn"), p("GitHub"), p("shadcn"), s("/clone"), h("Auto-Format"), w("org-refs")], steps: ["Fetch source (GitHub, shadcn, or local)", "Analyze dependencies", "Adapt imports to local structure", "Apply conventions (OKLCH, RTL, Auth.js, Prisma)", "Update registry"], connects: ["copy", "fork", "extend"], depends: [] },
      { name: "copy", effect: "Copy a component — identical but independent", order: [f("github"), h("Auto-Format"), w("org-refs")], steps: ["Same as clone, source always local"], connects: ["clone"], depends: [] },
      { name: "fork", effect: "Create a variant — free to diverge", order: [f("github"), h("Auto-Format"), w("org-refs")], steps: ["Same as clone + rename", "Original untouched"], connects: ["clone", "extend"], depends: [] },
      { name: "extend", effect: "Inherit and modify — building on giants", order: [f("github"), h("Auto-Format"), w("org-refs")], steps: ["Wrap/extend rather than duplicate", "Preserve base interface"], connects: ["clone", "fork"], depends: [] },
      { name: "sync", effect: "Synchronize with upstream source", order: [f("git"), f("github"), p("GitHub"), w("multi-repo")], steps: ["git fetch origin", "git rebase origin/main", "Resolve conflicts", "Push"], connects: ["upstream", "clone"], depends: [] },
      { name: "upstream", effect: "Pull changes from upstream", order: [f("git"), f("github"), p("GitHub"), w("multi-repo")], steps: ["Fetch upstream changes", "Merge or rebase", "Resolve conflicts"], connects: ["sync", "clone"], depends: [] },
    ],
  },
  {
    id: "summoning",
    number: "XI",
    name: "Summoning Charms",
    subtitle: "Portals to external realms",
    description:
      "Each word opens a portal to a powerful service beyond your machine. The Floo Network, but for code.",
    quote: "Each portal stays open for the duration of your session. Use them freely.",
    spells: [
      { name: "github", effect: "Repos, PRs, issues, Actions, code search", order: [f("github"), p("GitHub")], steps: ["Repository management", "Pull request workflows", "Issue tracking", "Code search across repos"], connects: ["push", "clone", "deploy"], depends: [] },
      { name: "figma", effect: "Design files, components, visual truth", order: [p("Figma")], steps: ["get_design_context", "get_screenshot", "get_metadata", "create_design_system_rules"], connects: ["component", "template"], depends: [] },
      { name: "linear", effect: "Issues, projects, sprint tracking", order: [p("Linear")], steps: ["Issue management", "Project tracking", "Sprint planning"], connects: ["plan", "story"], depends: [] },
      { name: "slack", effect: "Messages, channels, team communication", order: [p("Slack")], steps: ["Send messages", "Read channels", "Team notifications"], connects: [], depends: [] },
      { name: "notion", effect: "Documents, databases, wikis", order: [p("Notion")], steps: ["Page creation", "Database queries", "Wiki management"], connects: ["docs"], depends: [] },
      { name: "sentry", effect: "Error monitoring, exception traces", order: [p("Sentry"), f("sse")], steps: ["Error monitoring", "Exception traces", "Release tracking"], connects: ["error", "debug"], depends: [] },
      { name: "stripe", effect: "Payments, subscriptions, invoices", order: [p("Stripe")], steps: ["Payment processing", "Subscription management", "Webhook events", "Customer management"], connects: ["checkout", "saas"], depends: [] },
      { name: "vercel", effect: "Deployments, domains, the edge", order: [f("deploy"), p("Vercel")], steps: ["Deploy management", "Build logs", "Runtime logs", "Domain configuration"], connects: ["deploy", "ship"], depends: [] },
      { name: "analytics", effect: "User behavior, funnels, feature flags", order: [p("PostHog")], steps: ["User behavior tracking", "Funnel analysis", "Session recordings", "Feature flags"], connects: ["performance"], depends: [] },
      { name: "neon", effect: "PostgreSQL branches, database management", order: [f("prisma"), p("Neon")], steps: ["run_sql", "create_branch", "prepare_database_migration", "explain_sql_statement", "list_slow_queries"], connects: ["prisma", "migration"], depends: [] },
    ],
  },
  {
    id: "divination",
    number: "XII",
    name: "Divination",
    subtitle: "Seeing ahead",
    description:
      "Planning, architecting, predicting what must be built. Not all wizards believe, but the best ones practice daily.",
    quote: "Trelawney was wrong about most things, but right about one: prepare for the future.",
    spells: [
      { name: "bmad", effect: "Show BMAD menu — choose planning track", order: [f("orchestration")], steps: ["Display all workflow options", "Quick Flow (~5 min)", "BMad Method (~15 min)", "Enterprise (~30 min)"], connects: ["flow", "plan"], depends: [] },
      { name: "flow", effect: "Quick Flow — five minutes to a working plan", order: [f("orchestration")], steps: ["*bmad-quick-flow", "Rapid assessment", "Action items"], connects: ["plan", "implement"], depends: [] },
      { name: "plan", effect: "Enter planning phase — architecture first", order: [f("orchestration"), f("architecture")], steps: ["*2-plan-workflows", "Requirements gathering", "Architecture design", "Story mapping"], connects: ["architect", "story"], depends: [] },
      { name: "architect", effect: "Design system architecture", order: [f("orchestration"), f("architecture")], steps: ["*3-solutioning", "System design", "Data modeling", "API design"], connects: ["plan", "implement"], depends: ["plan"] },
      { name: "implement", effect: "Execute the plan", order: [f("orchestration"), f("architecture")], steps: ["*4-implementation", "Code generation", "Testing", "Deployment"], connects: ["architect", "cycle"], depends: ["architect"] },
      { name: "story", effect: "Create user stories", order: [f("orchestration")], steps: ["User personas", "Acceptance criteria", "Story points"], connects: ["plan", "feature"], depends: [] },
      { name: "cycle", effect: "Full development cycle", order: [f("orchestration")], steps: ["Plan", "Architect", "Implement", "Test", "Deploy"], connects: ["plan", "deploy"], depends: [] },
      { name: "loop", effect: "Continuous iteration — never ends", order: [f("orchestration")], steps: ["Recurring cycle", "Feedback integration", "Improvement"], connects: ["cycle"], depends: [] },
    ],
  },
  {
    id: "performance-magic",
    number: "XIII",
    name: "Advanced Spellwork",
    subtitle: "Performance magic",
    description:
      "N.E.W.T.-level incantations. They don't create — they refine. Faster, smaller, sharper.",
    quote: "parallelize alone can improve performance 2-10x. This is not theory — it is power.",
    spells: [
      { name: "parallelize", effect: "Sequential to Promise.all() — the Time-Turner", order: [f("react"), f("performance")], steps: ["Find sequential await chains", "Convert to Promise.all()", "Verify no dependencies between calls"], connects: ["waterfall", "performance"], depends: [] },
      { name: "waterfall", effect: "Detect and eliminate request waterfalls", order: [f("performance"), f("react")], steps: ["Profile with React DevTools", "Identify sequential fetches", "Restructure to parallel"], connects: ["parallelize", "performance"], depends: [] },
      { name: "bundle", effect: "Analyze bundle, recommend splits — Reducio", order: [f("build"), f("performance")], steps: ["ANALYZE=true pnpm build", "Identify large dependencies", "Suggest code splits", "Tree-shaking opportunities"], connects: ["lazy", "barrel"], depends: [] },
      { name: "lazy", effect: "Dynamic imports — appear only when summoned", order: [f("react"), f("nextjs")], steps: ["next/dynamic with { ssr: false }", "For heavy components (Monaco, charts, maps)"], connects: ["bundle", "suspense"], depends: [] },
      { name: "suspense", effect: "Suspense boundaries — progressive loading", order: [f("react"), f("nextjs")], steps: ["<Suspense fallback={...}>", "Wrap async Server Components", "Show skeleton while loading"], connects: ["streaming", "lazy"], depends: [] },
      { name: "memo", effect: "useMemo/useCallback — preserve computations", order: [f("react")], steps: ["Profile first to prove need", "React Compiler handles most cases", "Manual memo for remaining hotspots"], connects: ["react", "optimize"], depends: [] },
      { name: "server-component", effect: "Convert to Server Component", order: [f("nextjs"), f("react")], steps: ['Remove "use client"', "Extract hooks into child Client Components", "Reduce client bundle"], connects: ["nextjs", "bundle"], depends: [] },
      { name: "streaming", effect: "Streaming with Suspense — progressive results", order: [f("nextjs"), f("react")], steps: ["Parallel async Server Components", "Each wrapped in Suspense", "Results arrive as ready"], connects: ["suspense", "parallelize"], depends: [] },
      { name: "barrel", effect: "Fix barrel imports — eliminate 200-800ms curse", order: [f("build"), f("structure")], steps: ["Replace import { X } from '@/components'", "Use import { X } from '@/components/ui/x'", "Direct imports only"], connects: ["bundle", "build"], depends: [] },
      { name: "dedup", effect: "React.cache() — the spell that remembers", order: [f("react")], steps: ["Wrap shared fetching in React.cache()", "Request-level memoization", "No duplicate server calls"], connects: ["server-component", "performance"], depends: [] },
    ],
  },
  {
    id: "portkeys",
    number: "XIV",
    name: "Portkeys",
    subtitle: "Teleportation to other repos",
    description:
      "Speak a reference incantation and your context shifts to another repository — its patterns, its hard-won wisdom.",
    quote: "auth like hogwarts transports the auth pattern. table from codebase summons the DataTable.",
    spells: [
      { name: "from codebase", effect: "The pattern library — 54 primitives, 62 atoms, 31 templates", order: [s("/codebase"), p("GitHub"), w("org-refs")], steps: ["Search local /Users/abdout/codebase first", "Check src/components/ then __registry__/ then src/registry/", "Fallback to GitHub MCP: databayt/codebase"], connects: ["from shadcn", "clone"], depends: [] },
      { name: "from shadcn", effect: "shadcn/ui fork — refined for Databayt", order: [f("shadcn"), p("shadcn"), w("org-refs")], steps: ["Search shadcn registry via MCP", "View component details", "Install to src/components/ui/"], connects: ["from codebase", "from radix"], depends: [] },
      { name: "from radix", effect: "Radix primitives — the raw building blocks", order: [f("shadcn"), p("shadcn"), w("org-refs")], steps: ["Reference Radix primitives", "Dialog.Root, DropdownMenu.Root, etc."], connects: ["from shadcn", "shadcn"], depends: [] },
      { name: "like hogwarts", effect: "Education SaaS — multi-tenant, LMS, billing", order: [f("hogwarts"), f("architecture"), f("prisma"), p("GitHub"), w("org-refs")], steps: ["Multi-tenant (schoolId)", "Subdomain routing", "RBAC per school", "Stripe billing", "LMS/SIS schemas"], connects: ["like souq", "auth", "prisma"], depends: [] },
      { name: "like souq", effect: "Marketplace — vendors, carts, products", order: [f("souq"), f("architecture"), p("GitHub"), w("org-refs")], steps: ["Multi-vendor", "Redux cart", "Product catalog", "Order management", "Category trees"], connects: ["like hogwarts", "like mkan"], depends: [] },
      { name: "like mkan", effect: "Rental platform — listings, bookings, search", order: [f("mkan"), f("architecture"), p("GitHub"), w("org-refs")], steps: ["Property listings", "Booking system", "Date conflict checks", "Availability calendar", "Search/filters"], connects: ["like souq", "like shifa"], depends: [] },
      { name: "like shifa", effect: "Medical system — appointments, patient records", order: [f("shifa"), f("architecture"), p("GitHub"), w("org-refs")], steps: ["Patient model", "Appointment system", "Doctor scheduling", "Medical records", "Prescriptions"], connects: ["like mkan", "like hogwarts"], depends: [] },
    ],
  },
  {
    id: "unforgivable",
    number: "XV",
    name: "The Unforgivable Commands",
    subtitle: "Forbidden by the engine",
    description:
      "Denied by settings.json. No agent, skill, or charm can override them. Some magic cannot be undone.",
    quote: "The Ministry had its reasons. So does Kun.",
    spells: [
      { name: "rm -rf *", effect: "Catastrophic deletion — the Avada Kedavra of filesystems", order: [w("deny: settings.json")], steps: ["Blocked by deny rule in settings.json", "No override possible"], connects: [], depends: [] },
      { name: "prisma migrate reset", effect: "Wipes entire database — every table, every record", order: [w("deny: settings.json")], steps: ["Blocked by deny rule", "Use prisma migrate dev instead"], connects: [], depends: [] },
      { name: "prisma db push --accept-data-loss", effect: "Accepts data loss", order: [w("deny: settings.json")], steps: ["Blocked by deny rule", "Never accept data loss"], connects: [], depends: [] },
      { name: "DROP TABLE", effect: "Destroy table via Neon MCP", order: [w("deny: settings.json")], steps: ["Blocked even through MCP portals"], connects: [], depends: [] },
      { name: "git push --force main", effect: "Overwrite shared history", order: [w("convention")], steps: ["Convention enforced, not deny rule", "Overwrites upstream work"], connects: [], depends: [] },
    ],
  },
]

// ─── Workflows ──────────────────────────────────────────────────────────────────

export const workflows: Workflow[] = [
  {
    id: "feature-pipeline",
    name: "Feature Pipeline",
    description: "The full pipeline — idea to customer's hands",
    steps: [
      { keyword: "idea", action: "Structured GitHub issue with acceptance criteria" },
      { keyword: "spec", action: "Data model + file plan + human approval" },
      { keyword: "schema", action: "Prisma model + migration + Zod validation" },
      { keyword: "code", action: "Server actions with auth + tenant isolation" },
      { keyword: "wire", action: "Pages + forms + tables + i18n" },
      { keyword: "check", action: "Type-check + build + visual verify" },
      { keyword: "ship", action: "Commit + deploy to production" },
      { keyword: "watch", action: "Health check + close issue" },
    ],
  },
  {
    id: "morning-start",
    name: "Morning Start",
    description: "Begin your day",
    steps: [
      { keyword: "dev", action: "Server rises, Chrome opens" },
      { keyword: "code", action: "Write your changes" },
      { keyword: "build", action: "Verify everything compiles" },
    ],
  },
  {
    id: "quick-fix",
    name: "Quick Fix",
    description: "Patch and ship fast",
    steps: [
      { keyword: "fix", action: "Auto-repair errors" },
      { keyword: "build", action: "Verify clean" },
      { keyword: "quick", action: "Fast commit + push" },
    ],
  },
  {
    id: "report-fix",
    name: "Report to Fix",
    description: "User reports issue → auto-fix → close",
    steps: [
      { keyword: "report", action: "Find open report issues" },
      { keyword: "see", action: "Screenshot the reported page" },
      { keyword: "debug", action: "Console errors, network failures" },
      { keyword: "fix", action: "Edit minimum code needed" },
      { keyword: "build", action: "Verify no regressions" },
      { keyword: "push", action: "Commit + push to main" },
    ],
  },
  {
    id: "design-to-code",
    name: "Design to Code",
    description: "Figma to production",
    steps: [
      { keyword: "figma", action: "Get design context" },
      { keyword: "component", action: "Create React component" },
      { keyword: "atom", action: "Compose primitives" },
      { keyword: "template", action: "Assemble layout" },
      { keyword: "block", action: "Add business logic" },
    ],
  },
  {
    id: "quality-gate",
    name: "Quality Gate",
    description: "Full audit before release",
    steps: [
      { keyword: "test", action: "Run all tests" },
      { keyword: "security", action: "OWASP Top 10" },
      { keyword: "performance", action: "Core Web Vitals" },
      { keyword: "check", action: "Build + visual verify" },
    ],
  },
  {
    id: "clone-adapt",
    name: "Clone and Adapt",
    description: "Reuse existing work",
    steps: [
      { keyword: "clone", action: "Fetch from source" },
      { keyword: "extend", action: "Adapt to project" },
      { keyword: "build", action: "Verify integration" },
      { keyword: "test", action: "Confirm behavior" },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

export const orderTypeLabels: Record<OrderType, string> = {
  familiar: "Agent",
  portal: "MCP",
  skill: "Skill",
  hook: "Hook",
  ward: "Ward",
  memory: "Memory",
}
