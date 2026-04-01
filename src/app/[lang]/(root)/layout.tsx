import { SiteHeader } from "@/components/template/site-header"
import { SiteFooter } from "@/components/template/site-footer"
import { ReportIssue } from "@/components/report-issue"
import { type Locale } from "@/components/local/config"

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="flex-1">{children}</main>
      <div className="pt-8 pb-4 text-start text-sm text-muted-foreground">
        <ReportIssue />
      </div>
      <SiteFooter />
    </>
  )
}
