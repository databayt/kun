import ChatContent from "@/components/machine/chat/content"
import type { Locale } from "@/components/local/config"

export const metadata = { title: "Kun" }

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ s?: string; session?: string }>
}

export default async function MachinePage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const { s, session } = await searchParams
  const resume = s ?? session
  // Keyed by the resumed session, so opening another one from the drawer starts that chat fresh.
  return <ChatContent key={resume ?? "new"} lang={lang as Locale} session={resume} />
}
