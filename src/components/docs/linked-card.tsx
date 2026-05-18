import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface LinkedCardsProps {
  children: React.ReactNode
  className?: string
  columns?: 2 | 3
}

export function LinkedCards({ children, className, columns = 3 }: LinkedCardsProps) {
  return (
    <div
      className={cn(
        "not-prose my-6 grid grid-cols-1 gap-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface LinkedCardProps {
  href: string
  title: string
  children?: React.ReactNode
  className?: string
}

export function LinkedCard({ href, title, children, className }: LinkedCardProps) {
  const isExternal = href.startsWith("http")
  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={cn(
        "group flex flex-col gap-1 rounded-xl border bg-card p-6 text-card-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium tracking-tight">
        <span>{title}</span>
        <ChevronRight
          className="ms-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          strokeWidth={1.5}
        />
      </div>
      {children && (
        <div className="text-sm text-muted-foreground [&_p]:my-0">{children}</div>
      )}
    </Link>
  )
}
