import { MachineNav } from "@/components/machine/shell/content"
import type { Locale } from "@/components/local/config"

export default async function MachineLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <div className="flex h-dvh flex-col">
      <MachineNav lang={lang as Locale} />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
