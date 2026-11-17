import SessionsContent from "@/components/machine/sessions/content"
import type { Locale } from "@/components/local/config"

export const metadata = { title: "Sessions" }

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function SessionsPage({ params }: PageProps) {
  const { lang } = await params
  return <SessionsContent lang={lang as Locale} />
}
