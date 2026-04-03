import Link from "next/link"
import { team } from "./config"
import type { Locale } from "@/components/local/config"

interface TeamContentProps {
  lang: Locale
}

export default function TeamContent({ lang }: TeamContentProps) {
  const isAr = lang === "ar"

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-0">
      <h1 className="text-3xl font-semibold tracking-tight">
        {isAr ? "الفريق" : "Team"}
      </h1>
      <p className="text-muted-foreground mt-2 text-base">
        {isAr
          ? "أربعة أشخاص يديرون خمسة منتجات بمحرك واحد."
          : "Four people running five products with one engine."}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {team.map((member) => (
          <Link
            key={member.slug}
            href={`/${lang}/team/${member.slug}`}
            className="border-border hover:border-primary rounded-lg border p-6 transition-colors"
          >
            <div className="bg-muted flex size-10 items-center justify-center rounded-full text-lg font-semibold">
              {member.name[0]}
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {isAr ? member.nameAr : member.name}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {isAr ? member.roleAr : member.role}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
