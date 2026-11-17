import { cn } from "@/lib/utils"

/** One card of the mega menu's grid. */
export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-3xl bg-muted/50 p-4", className)}>
      <h2 className="px-2 pb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export const rowClass =
  "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-[15px] transition-colors hover:bg-foreground/5"
