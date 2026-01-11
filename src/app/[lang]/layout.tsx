import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"

export const metadata: Metadata = {
  title: {
    default: "Kun - Remote AI Development Infrastructure",
    template: "%s | Kun"
  },
  description: "Remote AI Development Infrastructure - كن (Be!)",
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const dir = lang === "ar" ? "rtl" : "ltr"

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ar" }]
}
