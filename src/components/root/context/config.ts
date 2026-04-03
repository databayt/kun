import { schools, type Spell } from "@/components/docs/spellbook-data"

// ─── Repos ──────────────────────────────────────────────────────────────────────

export interface RepoConfig {
  id: string
  label: string
  labelAr: string
  github: string
}

export const repos: RepoConfig[] = [
  { id: "hogwarts", label: "Hogwarts", labelAr: "هوقورتس", github: "databayt/hogwarts" },
  { id: "kun", label: "Kun", labelAr: "كن", github: "databayt/kun" },
  { id: "souq", label: "Souq", labelAr: "سوق", github: "databayt/souq" },
  { id: "mkan", label: "Mkan", labelAr: "مكان", github: "databayt/mkan" },
  { id: "shifa", label: "Shifa", labelAr: "شفاء", github: "databayt/shifa" },
]

export function getRepo(id: string): RepoConfig | undefined {
  return repos.find((r) => r.id === id)
}

// ─── Contributors ───────────────────────────────────────────────────────────────

export interface Contributor {
  id: string
  name: string
  nameAr: string
  email: string
  role: "engineer" | "qa" | "research" | "ops"
  keywords: string[]
}

export const contributors: Contributor[] = [
  {
    id: "abdout", name: "Abdout", nameAr: "عبدوت", email: "abdout@databayt.org", role: "engineer",
    keywords: ["feature", "spec", "schema", "ready", "code", "wire", "check", "ship", "deploy", "build", "dev", "fix", "performance", "analyze"],
  },
  {
    id: "ali", name: "Ali", nameAr: "علي", email: "ali@databayt.org", role: "qa",
    keywords: ["report", "check", "review", "test", "deploy", "monitor", "handover", "security"],
  },
  {
    id: "samia", name: "Samia", nameAr: "سامية", email: "samia@databayt.org", role: "research",
    keywords: ["translate", "docs", "clone", "review", "constitution"],
  },
  {
    id: "sedon", name: "Sedon", nameAr: "سدن", email: "sedon@databayt.org", role: "ops",
    keywords: ["monitor", "deploy", "incident"],
  },
]

export function getContributorByEmail(email: string): Contributor | undefined {
  return contributors.find((c) => c.email === email)
}

// ─── Stories (Kanban Board) ─────────────────────────────────────────────────────

export interface Story {
  id: string
  name: string
  nameAr: string
  repo: string
  issue?: number
  keywords: string[]
  status: "active" | "next" | "done"
}

export interface Board {
  name: string
  nameAr: string
  stories: Story[]
}

export const board: Board = {
  name: "Hogwarts Pilot",
  nameAr: "هوقورتس التجريبي",
  stories: [
    {
      id: "homepage",
      name: "Homepage",
      nameAr: "الرئيسية",
      repo: "hogwarts",
      keywords: ["wire", "check", "deploy", "performance"],
      status: "active",
    },
    {
      id: "admission",
      name: "Admission",
      nameAr: "القبول",
      repo: "hogwarts",
      issue: 115,
      keywords: ["report", "check", "deploy", "fix"],
      status: "active",
    },
    {
      id: "announcement",
      name: "Announcement",
      nameAr: "الإعلانات",
      repo: "hogwarts",
      keywords: ["feature", "schema", "code", "wire"],
      status: "next",
    },
    {
      id: "event",
      name: "Event",
      nameAr: "الفعاليات",
      repo: "hogwarts",
      keywords: ["feature", "schema", "code", "wire"],
      status: "next",
    },
    {
      id: "notification",
      name: "Notification",
      nameAr: "الإشعارات",
      repo: "hogwarts",
      keywords: ["feature", "schema", "code", "wire"],
      status: "next",
    },
    {
      id: "messaging",
      name: "Messaging",
      nameAr: "المراسلات",
      repo: "hogwarts",
      keywords: ["feature", "schema", "code", "wire"],
      status: "next",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      nameAr: "واتساب",
      repo: "hogwarts",
      keywords: ["feature", "schema", "code", "wire"],
      status: "next",
    },
  ],
}

// ─── Keyword Groups ─────────────────────────────────────────────────────────────

export interface KeywordGroup {
  id: string
  label: string
  labelAr: string
  keywords: string[]
}

export const keywordGroups: KeywordGroup[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    labelAr: "خط الإنتاج",
    keywords: ["feature", "idea", "spec", "schema", "ready", "code", "wire", "check", "ship", "watch"],
  },
  {
    id: "tools",
    label: "Tools",
    labelAr: "الأدوات",
    keywords: ["dev", "build", "deploy", "report", "test", "clone", "monitor", "atom", "block", "template", "translate", "incident"],
  },
  {
    id: "quality",
    label: "Quality",
    labelAr: "الجودة",
    keywords: ["security", "performance", "fix", "review", "analyze", "constitution"],
  },
  {
    id: "services",
    label: "Services",
    labelAr: "الخدمات",
    keywords: ["github", "vercel", "neon", "stripe", "figma", "sentry"],
  },
]

// ─── Weight Computation ─────────────────────────────────────────────────────────

export type Weight = 1 | 2 | 3 | 4 | 5

export function computeWeight(
  keyword: string,
  selectedStory: Story | null,
  contributor: Contributor | null,
): Weight {
  let w = 2

  // Selected story boost
  if (selectedStory?.keywords.includes(keyword)) w += 2

  // Contributor boost
  if (contributor?.keywords.includes(keyword)) w += 1

  // Any active story (not just selected)
  if (!selectedStory?.keywords.includes(keyword)) {
    const inAnyActive = board.stories
      .filter((s) => s.status === "active")
      .some((s) => s.keywords.includes(keyword))
    if (inAnyActive) w += 1
  }

  return Math.min(5, Math.max(1, w)) as Weight
}

// ─── Derived Data ───────────────────────────────────────────────────────────────

export function getActiveStories(): Story[] {
  return board.stories.filter((s) => s.status === "active")
}

export function getVisibleStories(): Story[] {
  return board.stories.filter((s) => s.status !== "done")
}

// ─── Spell Lookup ───────────────────────────────────────────────────────────────

const allSpells = schools.flatMap((s) => s.spells)
const spellMap = new Map<string, Spell>(allSpells.map((s) => [s.name, s]))

export function getSpell(name: string): Spell | undefined {
  return spellMap.get(name)
}

export function getSpellsForGroup(group: KeywordGroup): Spell[] {
  return group.keywords
    .map((k) => spellMap.get(k))
    .filter((s): s is Spell => s !== undefined)
}

export function getAllGroupKeywords(): string[] {
  return keywordGroups.flatMap((g) => g.keywords)
}
