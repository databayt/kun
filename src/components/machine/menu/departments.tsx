import { cn } from "@/lib/utils";
import type { MachineProfile } from "../profile/types";

/** Column 1: the departments. Big bold; the selected one is foreground, the rest muted. A scroll row on phones. */
export function Departments({
  isAr,
  profile,
  selected,
  onSelect,
  title,
  first,
}: {
  isAr: boolean;
  profile: MachineProfile;
  selected: string;
  onSelect: (name: string) => void;
  title: string;
  first: React.Ref<HTMLButtonElement>;
}) {
  return (
    <section className="min-w-0">
      <h2 className="hidden pb-3 text-xs font-normal text-muted-foreground lg:block">{title}</h2>
      <ul
        role="listbox"
        aria-label={title}
        className="-mx-6 flex gap-5 overflow-x-auto px-6 pb-1 lg:mx-0 lg:block lg:overflow-visible lg:px-0"
      >
        {profile.departments.map((d) => {
          const on = d.name === selected;
          return (
            <li key={d.name} role="presentation" className="shrink-0">
              <button
                ref={on ? first : undefined}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onSelect(d.name)}
                className={cn(
                  "block whitespace-nowrap rounded-md py-1 text-start text-xl font-semibold leading-tight tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring lg:py-1.5 lg:text-3xl xl:text-4xl",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {(isAr && d.title_ar) || d.title}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
