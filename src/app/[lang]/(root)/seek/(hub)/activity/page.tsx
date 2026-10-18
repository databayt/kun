import type { Locale } from "@/components/local/config";
import { getConsoleDict } from "@/components/root/seek/console/dictionary";
import { EventTimeline } from "@/components/root/seek/console/event-timeline";
import { loadConsole } from "@/components/root/seek/console/load";
import { weekly } from "@/lib/seek/metrics";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function SeekActivityPage({ params }: Props) {
  const { lang } = await params;
  const locale = lang as Locale;
  const data = await loadConsole();
  if (!data) return null;
  const t = getConsoleDict(locale);
  const w = weekly(data.events);
  const tiles: [string, number][] = [
    [t.kinds.sent, w.sent],
    [t.kinds.reply, w.replies],
    [t.kinds.followup, w.followups],
    [t.kinds.hold, w.holds],
    [t.kinds.error, w.errors],
  ];

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-5 gap-2">
        {tiles.map(([k, v]) => (
          <div key={k} className="bg-muted/30 rounded-lg border p-3 text-center">
            <dt className="text-muted-foreground text-[11px]">{k} · 7d</dt>
            <dd className="text-xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <EventTimeline events={data.events} lang={locale} t={t} />
    </div>
  );
}
