import { SiteHeader } from "@/components/template/site-header"
import { SiteFooter } from "@/components/template/site-footer"
import { type Locale } from "@/components/local/config"

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = lang as Locale

  return (
    <>
      <SiteHeader lang={locale} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
