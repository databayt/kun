import type { Locale } from "@/components/local/config";
import { getConsoleDict } from "@/components/root/seek/console/dictionary";
import { GroupStrip } from "@/components/root/seek/console/group-strip";
import { CONSOLE_TRACKS, loadConsole, pickTrack } from "@/components/root/seek/console/load";
import { StageBoard } from "@/components/root/seek/console/stage-board";
import { TrackSwitch } from "@/components/root/seek/console/track-switch";
import { countByGroup } from "@/lib/seek/metrics";

interface Props {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ track?: string }>;
}

export default async function SeekBoardPage({ params, searchParams }: Props) {
  const [{ lang }, { track: trackId }] = await Promise.all([params, searchParams]);
  const locale = lang as Locale;
  const data = await loadConsole();
  if (!data) return null;
  const t = getConsoleDict(locale);
  const track = pickTrack(trackId);
  const items = data.items.filter((i) => i.track === track.id);
  const counts = Object.fromEntries(CONSOLE_TRACKS.map((tr) => [tr.id, data.items.filter((i) => i.track === tr.id).length]));

  return (
    <div className="space-y-6">
      <TrackSwitch tracks={CONSOLE_TRACKS} active={track.id} base={`/${lang}/seek/board`} lang={locale} t={t} counts={counts} />
      <GroupStrip groups={countByGroup(items, track)} t={t} />
      <StageBoard items={items} track={track} lang={locale} t={t} pendingIds={data.pendingIds} />
    </div>
  );
}
