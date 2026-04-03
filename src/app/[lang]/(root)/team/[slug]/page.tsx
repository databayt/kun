import { notFound } from "next/navigation"
import TeamDetail from "@/components/root/team/detail"
import { getTeamMember, team } from "@/components/root/team/config"
import { type Locale } from "@/components/local/config"

interface TeamMemberPageProps {
  params: Promise<{ lang: Locale; slug: string }>
}

export function generateStaticParams() {
  return team.map((member) => ({ slug: member.slug }))
}

export async function generateMetadata({ params }: TeamMemberPageProps) {
  const { slug } = await params
  const member = getTeamMember(slug)
  return { title: member?.name ?? "Team Member" }
}

export default async function TeamMemberPage({ params }: TeamMemberPageProps) {
  const { lang, slug } = await params
  const member = getTeamMember(slug)

  if (!member) notFound()

  return <TeamDetail member={member} lang={lang} />
}
