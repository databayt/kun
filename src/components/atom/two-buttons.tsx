import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  className?: string;
}

/** Off-site destinations (GitHub, X) open in a new tab — same rule as Announcement. */
const externalProps = (href: string) =>
  /^https?:\/\//.test(href)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

export function TwoButtons({
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-wrap gap-4", className)}>
      <Button asChild>
        <Link href={primaryHref} {...externalProps(primaryHref)}>
          {primaryLabel}
        </Link>
      </Button>
      <Button variant="ghost" asChild>
        <Link href={secondaryHref} {...externalProps(secondaryHref)}>
          {secondaryLabel}
        </Link>
      </Button>
    </div>
  );
}
