import ChatContent from "@/components/machine/chat/content"
import type { Locale } from "@/components/local/config"

export const metadata = { title: "Kun" }

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ session?: string }>
}

export default async function MachinePage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const { session } = await searchParams
  return <ChatContent lang={lang as Locale} session={session} />
}
