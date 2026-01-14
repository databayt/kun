import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface AnnouncementProps {
  text?: string
  href?: string
}

export function Announcement({
  text = "Remote AI Development",
  href = "/docs/phase1"
}: AnnouncementProps) {
  return (
    <Badge asChild variant="secondary" className="bg-transparent">
      <Link href={href}>
        <span className="flex size-2 rounded-full bg-blue-500" title="New" />
        {text} <ArrowRightIcon />
      </Link>
    </Badge>
  )
}
