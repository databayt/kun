import { Suspense } from "react"

import type { Locale } from "@/components/local/config"
import { MachineMenu } from "@/components/machine/menu/content"

// The machine app has no chrome: the page, and one floating two-line button that opens the mega menu.
export default async function MachineLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <main className="fixed inset-0 overflow-hidden bg-muted">
      {children}
      <Suspense fallback={null}>
        <MachineMenu lang={lang as Locale} />
      </Suspense>
    </main>
  )
}
