import ContextContent from "@/components/root/context/content"
import { type Locale } from "@/components/local/config"

export const metadata = {
  title: "Context",
}

interface ContextPageProps {
  params: Promise<{ lang: string }>
}

export default async function ContextPage({ params }: ContextPageProps) {
  const { lang } = await params
  const locale = lang as Locale

  return <ContextContent lang={locale} />
}
