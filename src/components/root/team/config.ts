export interface TeamMember {
  slug: string
  name: string
  nameAr: string
  role: string
  roleAr: string
}

export const team: TeamMember[] = [
  {
    slug: "abdout",
    name: "Abdout",
    nameAr: "عبدالعوض",
    role: "Tech",
    roleAr: "تقنية",
  },
  {
    slug: "ali",
    name: "Ali",
    nameAr: "علي",
    role: "Business",
    roleAr: "أعمال",
  },
  {
    slug: "samia",
    name: "Samia",
    nameAr: "سامية",
    role: "Research & Development",
    roleAr: "بحث وتطوير",
  },
  {
    slug: "sedon",
    name: "Sedon",
    nameAr: "سدن",
    role: "Facilitator",
    roleAr: "تنسيق",
  },
]

export function getTeamMember(slug: string): TeamMember | undefined {
  return team.find((m) => m.slug === slug)
}
