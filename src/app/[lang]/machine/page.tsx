import ChatContent from "@/components/machine/chat/content"
import type { Locale } from "@/components/local/config"

export const metadata = { title: "Kun" }

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ s?: string; session?: string; prompt?: string; task?: string }>
}

export default async function MachinePage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const { s, session, prompt, task } = await searchParams
  const resume = s ?? session
  // Keyed by the resumed session and the starter, so opening another from the menu starts that chat fresh.
  return <ChatContent key={`${resume ?? "new"}|${prompt ?? ""}`} lang={lang as Locale} session={resume} prompt={prompt} task={task} />
}
