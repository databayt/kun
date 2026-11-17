import { cn } from "@/lib/utils";

/** One column of the mega menu, apple.com's flyout: a small gray heading over big bold links. No card. */
export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <h2 className="pb-3 text-xs font-normal text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A big bold link; hover only greys the text, no fill. */
export const rowClass =
  "flex w-full items-center gap-2 py-1.5 text-start text-2xl font-semibold leading-tight tracking-tight text-foreground transition-colors hover:text-muted-foreground";

/** A smaller sub-heading inside a column (a department, a repo). */
export const subClass =
  "pb-1 pt-4 text-xs font-normal text-muted-foreground first:pt-0";
