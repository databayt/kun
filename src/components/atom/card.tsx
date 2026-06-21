import Link from "next/link";
import { ReactNode } from "react";

interface CardProps {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  className?: string;
  iconSize?: string;
}

export default function Card({
  id,
  title,
  description,
  icon,
  href,
  className = "",
  iconSize = "w-8 h-8",
}: CardProps) {
  return (
    <Link
      key={id}
      href={href}
      className={`relative overflow-hidden rounded-lg border bg-background p-2 transition-[border-color] hover:border-primary hover:text-current ${className}`}
    >
      <div className="flex h-[180px] flex-col rounded-md p-6">
        <div className={iconSize}>{icon}</div>
        {/* mt-auto pins this block to the bottom; the fixed title line + the
            two-line description reserve a constant height, so the title sits
            at the same vertical position on every card regardless of how long
            the description is. */}
        <div className="mt-auto space-y-2">
          <h4 className="line-clamp-1 hover:text-current">{title}</h4>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground hover:text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
