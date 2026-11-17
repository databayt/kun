import { LockIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** A column: a small gray heading over its content. No card. */
export function Column({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0", className)}>
      <h2 className="pb-3 text-xs font-normal text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** A small gray sub-heading inside a column. */
export const subClass = "pb-1 pt-6 text-xs font-normal text-muted-foreground";

/** A big bold link; hover only greys the text. */
export const bigClass =
  "block min-w-0 truncate py-1.5 text-start text-2xl font-semibold leading-tight tracking-tight text-foreground transition-colors hover:text-muted-foreground";

export const smallRow = "flex min-w-0 items-center gap-2 py-1 text-sm";

export const quiet = "text-sm text-muted-foreground";

/** A status dot in tokens only: solid = good/ready, ring = unknown/missing, destructive = bad. */
export function Dot({ kind, className }: { kind: "solid" | "ring" | "bad" | "lock"; className?: string }) {
  if (kind === "lock") return <LockIcon aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        kind === "solid" && "bg-foreground",
        kind === "bad" && "bg-destructive",
        kind === "ring" && "border border-muted-foreground",
        className,
      )}
    />
  );
}
