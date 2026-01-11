"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function DocsNav({ lang }: { lang?: string }) {
  const pathname = usePathname()
  const prefix = lang ? `/${lang}` : ""

  // Generate breadcrumbs from pathname
  const pathSegments = pathname.split("/").filter(Boolean)
  // Filter out language segment if present
  const filteredSegments = lang ? pathSegments.filter(seg => seg !== lang) : pathSegments
  const breadcrumbs = filteredSegments.map((segment, index) => {
    const href = prefix + "/" + filteredSegments.slice(0, index + 1).join("/")
    const isLast = index === filteredSegments.length - 1

    // Format segment name
    const name = segment
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")

    return {
      name,
      href,
      isLast,
    }
  })

  if (breadcrumbs.length <= 1) return null

  return (
    <div className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        href={`${prefix}/docs`}
        className="overflow-hidden text-ellipsis whitespace-nowrap hover:text-foreground"
      >
        Docs
      </Link>
      {breadcrumbs.slice(1).map((breadcrumb) => (
        <div key={breadcrumb.href} className="flex items-center gap-1">
          <span>/</span>
          <Link
            href={breadcrumb.href}
            className={cn(
              "overflow-hidden text-ellipsis whitespace-nowrap",
              breadcrumb.isLast
                ? "text-foreground"
                : "hover:text-foreground"
            )}
          >
            {breadcrumb.name}
          </Link>
        </div>
      ))}
    </div>
  )
}
