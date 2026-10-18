import type { Locale } from "@/components/local/config";
import type { TrackDef } from "@/lib/seek/tracks/types";

export function stageLabel(track: TrackDef, stage: string, lang: Locale): string {
  return track.stages?.find((s) => s.id === stage)?.label[lang] ?? stage;
}

// "TO_APPLY" → "To apply" for raw SELECT values with no label of their own.
export const humanize = (v: string | null): string =>
  v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ") : "—";

export function ago(iso: string | null, lang: Locale, never: string, now = Date.now()): string {
  if (!iso) return never;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const mins = Math.round((Date.parse(iso) - now) / 60_000);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export const day = (iso: string, lang: Locale): string =>
  new Date(iso).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });

export const time = (iso: string, lang: Locale): string =>
  new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
