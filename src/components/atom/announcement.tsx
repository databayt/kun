import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TwitterIcon } from "@/components/atom/icons";

interface AnnouncementProps {
  text?: string;
  href?: string;
  /** External links (e.g. X / Anthropic) open in a new tab. */
  external?: boolean;
  badgeClassName?: string;
}

export function Announcement({
  text = "Latest from Anthropic",
  href = "https://x.com/AnthropicAI",
  external = true,
  badgeClassName,
}: AnnouncementProps) {
  return (
    <Badge
      asChild
      variant="secondary"
      className={cn("bg-transparent", badgeClassName)}
    >
      <Link
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <TwitterIcon className="size-3 fill-current" />
        {text} <ArrowRightIcon />
      </Link>
    </Badge>
  );
}
