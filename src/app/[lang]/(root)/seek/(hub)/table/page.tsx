import type { Locale } from "@/components/local/config";
import { getConsoleDict } from "@/components/root/seek/console/dictionary";
import { ItemTable } from "@/components/root/seek/console/item-table";
import { CONSOLE_TRACKS, loadConsole, pickTrack } from "@/components/root/seek/console/load";
import { TrackSwitch } from "@/components/root/seek/console/track-switch";

interface Props {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ track?: string; lane?: string; stage?: string; q?: string }>;
}

export default async function SeekTablePage({ params, searchParams }: Props) {
  const [{ lang }, sp] = await Promise.all([params, searchParams]);
  const locale = lang as Locale;
  const data = await loadConsole();
  if (!data) return null;
  const t = getConsoleDict(locale);
  const track = pickTrack(sp.track);
  const items = data.items.filter((i) => i.track === track.id);
  const lanes = [...new Set(items.map((i) => i.lane).filter((l): l is string => Boolean(l)))].sort();
  const counts = Object.fromEntries(CONSOLE_TRACKS.map((tr) => [tr.id, data.items.filter((i) => i.track === tr.id).length]));

  return (
    <div className="space-y-6">
      <TrackSwitch tracks={CONSOLE_TRACKS} active={track.id} base={`/${lang}/seek/table`} lang={locale} t={t} counts={counts} />
      <ItemTable
        items={items}
        track={track}
        lang={locale}
        t={t}
        pendingIds={data.pendingIds}
        filters={{ lane: sp.lane || undefined, stage: sp.stage || undefined, q: sp.q || undefined }}
        lanes={lanes}
        now={Date.now()}
      />
    </div>
  );
}
