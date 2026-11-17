import EngineContent from "@/components/machine/engine/content"
import type { Locale } from "@/components/local/config"

export const metadata = { title: "Engine" }

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function EnginePage({ params }: PageProps) {
  const { lang } = await params
  return <EngineContent lang={lang as Locale} />
}
