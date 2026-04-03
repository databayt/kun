import TeamContent from "@/components/root/team/content"
import { type Locale } from "@/components/local/config"

export const metadata = {
  title: "Team",
}

interface TeamPageProps {
  params: Promise<{ lang: Locale }>
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { lang } = await params

  return <TeamContent lang={lang} />
}
