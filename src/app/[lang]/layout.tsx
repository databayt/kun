import { fontSans, fontRubik } from "@/components/atom/fonts"
import { type Locale, localeConfig } from "@/components/local/config"
import { cn } from "@/lib/utils"

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params as { lang: Locale }
  const config = localeConfig[lang] || localeConfig['en']
  const fontClass = lang === 'ar' ? fontRubik.className : fontSans.className

  return (
    <div lang={lang} dir={config.dir} className={cn(fontClass, "layout-container")}>
      {children}
    </div>
  )
}

export function generateStaticParams() {
  return Object.keys(localeConfig).map((lang) => ({ lang }))
}
