import ContextContent from "@/components/root/context/content"
import { type Locale } from "@/components/local/config"

export const metadata = {
  title: "Context",
}

interface ContextPageProps {
  params: Promise<{ lang: Locale }>
}

export default async function ContextPage({ params }: ContextPageProps) {
  const { lang } = await params

  return <ContextContent lang={lang} />
}
