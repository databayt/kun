import SettingsContent from "@/components/machine/settings/content"
import type { Locale } from "@/components/local/config"

export const metadata = { title: "Settings" }

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function SettingsPage({ params }: PageProps) {
  const { lang } = await params
  return <SettingsContent lang={lang as Locale} />
}
