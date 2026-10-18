import type { Locale } from "@/components/local/config";
import { getConsoleDict } from "@/components/root/seek/console/dictionary";
import { ago, humanize } from "@/components/root/seek/console/format";
import { loadConsole } from "@/components/root/seek/console/load";
import { LoopPanel } from "@/components/root/seek/console/loop-panel";
import { listRecentCommands } from "@/lib/seek/store";

// Week lines are strings, or adopt.ts actions ({ type, target, value, why }).
function weekLine(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const a = x as { type?: string; target?: string; value?: unknown; why?: string };
    const head = [a.type, a.target].filter(Boolean).join(" ");
    return `${head}${a.value !== undefined ? ` → ${String(a.value)}` : ""}${a.why ? ` — ${a.why}` : ""}`;
  }
  return String(x);
}

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function SeekLoopPage({ params }: Props) {
  const { lang } = await params;
  const locale = lang as Locale;
  const data = await loadConsole();
  if (!data) return null;
  const t = getConsoleDict(locale);
  const s = data.instance.state;
  const recent = await listRecentCommands(data.instance.id);
  const lanes = s.lanes?.length ? s.lanes : [...new Set(data.items.map((i) => i.lane).filter((l): l is string => Boolean(l)))];

  return (
    <div className="space-y-8">
      <LoopPanel
        t={t}
        sendOff={Boolean(s.sendOff)}
        dailyCap={s.dailyCap}
        lanes={lanes}
        pausedLanes={s.pausedLanes ?? []}
        pendingKinds={data.pending.map((p) => p.kind)}
      />

      {s.focus && (
        <p className="text-sm">
          <span className="font-medium">{t.focus}: </span>
          {s.focus.lanes.map(humanize).join(", ")}
          {s.focus.countries.length > 0 && ` · ${s.focus.countries.map(humanize).join(", ")}`} · {t.focusUntil}{" "}
          {s.focus.until}
        </p>
      )}

      {s.week && (
        <section className="space-y-4 rounded-xl border p-4">
          <h3 className="text-sm font-medium">
            {t.week} <span className="text-muted-foreground text-xs">· {s.week.date}</span>
          </h3>
          {s.week.headline && <p className="text-sm" dir="auto">{s.week.headline}</p>}
          {(
            [
              [t.needFromYou, s.week.needFromYou],
              [t.learned, s.week.learned],
              [t.actions, s.week.actions],
            ] as const
          ).map(([label, list]) =>
            list?.length ? (
              <div key={label} className="space-y-1">
                <h4 className="text-muted-foreground text-xs font-medium">{label}</h4>
                <ul className="list-disc space-y-1 ps-5 text-sm" dir="auto">
                  {list.map((x, n) => (
                    <li key={n}>{weekLine(x)}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t.recent}</h3>
          <ul className="divide-y rounded-xl border text-sm">
            {recent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
                <span className="font-medium">{c.kind}</span>
                <span className="text-muted-foreground text-xs">{t.status[c.status] ?? c.status}</span>
                {c.result && <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{c.result}</span>}
                <span className="text-muted-foreground ms-auto text-xs">{ago(c.createdAt, locale, t.never)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
