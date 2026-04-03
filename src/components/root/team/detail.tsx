import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { TeamMember } from "./config"
import type { Locale } from "@/components/local/config"

interface TeamDetailProps {
  member: TeamMember
  lang: Locale
}

export default function TeamDetail({ member, lang }: TeamDetailProps) {
  const isAr = lang === "ar"

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-0">
      <Link
        href={`/${lang}/team`}
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        {isAr ? "الفريق" : "Team"}
      </Link>

      <div className="mt-6 flex items-start gap-4">
        <div className="bg-muted flex size-14 items-center justify-center rounded-full text-2xl font-semibold">
          {member.name[0]}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isAr ? member.nameAr : member.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAr ? member.roleAr : member.role}
          </p>
        </div>
      </div>
    </div>
  )
}
