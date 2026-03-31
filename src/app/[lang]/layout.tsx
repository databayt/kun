import { ThemeProvider } from "next-themes"
import { fontSans, fontRubik, fontVariables } from "@/components/atom/fonts"
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
    <html lang={lang} dir={config.dir} suppressHydrationWarning>
      <body className={cn(fontClass, fontVariables, "group/body overscroll-none antialiased [--footer-height:calc(var(--spacing)*14)] [--header-height:calc(var(--spacing)*14)]")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="layout-container">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return Object.keys(localeConfig).map((lang) => ({ lang }))
}
