export interface TeamMember {
  slug: string;
  name: string;
  nameAr: string;
  role: string;
  roleAr: string;
}

// slugs = CRM/workspace logins (<slug>@databayt.org) — keep in sync with
// .claude/memory/team.json
export const team: TeamMember[] = [
  {
    slug: "abdout",
    name: "Abdout",
    nameAr: "عبدالعوض",
    role: "Tech",
    roleAr: "تقنية",
  },
  {
    slug: "ibrahim",
    name: "Ibrahim",
    nameAr: "إبراهيم",
    role: "Fullstack & Mobile",
    roleAr: "ويب وموبايل",
  },
  {
    slug: "moutaz",
    name: "Moutaz",
    nameAr: "معتز",
    role: "Product Engineering",
    roleAr: "هندسة المنتج",
  },
  {
    slug: "aseel",
    name: "Ali Aseel",
    nameAr: "علي أصيل",
    role: "Business",
    roleAr: "أعمال",
  },
  {
    slug: "moed",
    name: "Moed",
    nameAr: "معاذ",
    role: "Business Development",
    roleAr: "تطوير أعمال",
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
];

export function getTeamMember(slug: string): TeamMember | undefined {
  return team.find((m) => m.slug === slug);
}
