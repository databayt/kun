import type { Locale } from "@/components/local/config";
import { getConsoleDict } from "@/components/root/seek/console/dictionary";
import { CONSOLE_TRACKS, loadConsole, pickTrack } from "@/components/root/seek/console/load";
import { NeedsQueue } from "@/components/root/seek/console/needs-queue";
import { TrackSwitch } from "@/components/root/seek/console/track-switch";
import { needsMe } from "@/lib/seek/metrics";

interface Props {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ track?: string }>;
}

export default async function SeekNeedsPage({ params, searchParams }: Props) {
  const [{ lang }, { track: trackId }] = await Promise.all([params, searchParams]);
  const locale = lang as Locale;
  const data = await loadConsole();
  if (!data) return null;
  const t = getConsoleDict(locale);
  const track = pickTrack(trackId);
  const counts = Object.fromEntries(CONSOLE_TRACKS.map((tr) => [tr.id, needsMe(data.items, tr).length]));

  return (
    <div className="space-y-6">
      <TrackSwitch tracks={CONSOLE_TRACKS} active={track.id} base={`/${lang}/seek/needs`} lang={locale} t={t} counts={counts} />
      <NeedsQueue
        items={data.items}
        events={data.events}
        track={track}
        vetoHours={data.instance.state.vetoHours ?? 2}
        lang={locale}
        t={t}
        pendingIds={data.pendingIds}
      />
    </div>
  );
}
