import { db } from "@/lib/db";
import { healthOk } from "@/lib/machine/tasks";
import type { Locale } from "@/components/local/config";

export const dynamic = "force-dynamic";

interface Row {
  login: string;
  name: string;
  lastSeenAt: Date | null;
  health: unknown;
  currentTask: string | null;
}

// Fails soft: before the migration lands (or when the db is unreachable) the strip just hides.
async function load(): Promise<Row[]> {
  try {
    return await db.machine.findMany({
      select: { login: true, name: true, lastSeenAt: true, health: true, currentTask: true },
      orderBy: { login: "asc" },
    });
  } catch {
    return [];
  }
}

function ago(d: Date | null, isAr: boolean): string {
  if (!d) return isAr ? "لم يتصل بعد" : "never";
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (m < 1) return isAr ? "الآن" : "just now";
  if (m < 60) return isAr ? `قبل ${m} د` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return isAr ? `قبل ${h} س` : `${h}h ago`;
  const days = Math.round(h / 24);
  return isAr ? `قبل ${days} يوم` : `${days}d ago`;
}

export default async function Machines({ lang }: { lang: Locale }) {
  const rows = await load();
  if (rows.length === 0) return null;
  const isAr = lang === "ar";
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">{isAr ? "الأجهزة" : "Machines"}</h2>
      <ul className="border-border mt-3 divide-y rounded-lg border">
        {rows.map((r) => {
          const ok = healthOk(r.health);
          const fresh = r.lastSeenAt && Date.now() - r.lastSeenAt.getTime() < 30 * 60000;
          const dot = !fresh || ok === null ? "bg-muted-foreground" : ok ? "bg-green-500" : "bg-red-500";
          return (
            <li key={r.login} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
              <span className="font-medium">{r.name}</span>
              <span className="text-muted-foreground">{ago(r.lastSeenAt, isAr)}</span>
              <span className="text-muted-foreground ms-auto truncate" dir="ltr">
                {r.currentTask ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
