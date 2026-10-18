import type { Locale } from "@/components/local/config";
import { getPulse } from "@/lib/seek/store";

import { getConsoleDict } from "./dictionary";
import { ago } from "./format";
import { GroupStrip } from "./group-strip";

// The public page's live strip: counts from the real loop, nothing else.
// Renders nothing when no loop has pushed (or the database is away).
export async function Pulse({ lang }: { lang: Locale }) {
  const pulse = await getPulse();
  if (!pulse) return null;
  const t = getConsoleDict(lang);
  const week =
    lang === "ar"
      ? `هذا الأسبوع: ${pulse.week.sent} طلبًا أُرسل · ${pulse.week.replies} ردًا · ${pulse.week.followups} متابعة`
      : `This week: ${pulse.week.sent} applications sent · ${pulse.week.replies} replies · ${pulse.week.followups} follow-ups`;
  return (
    <section aria-label={lang === "ar" ? "الحلقة الآن" : "The loop right now"} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">
          {lang === "ar" ? "الحلقة الآن — مثيل حي" : "The loop right now — a live instance"}
        </h2>
        <span className="text-muted-foreground text-xs">
          {t.lastTick}: {ago(pulse.lastTickAt, lang, t.never)}
        </span>
      </div>
      <GroupStrip groups={pulse.groups} t={t} />
      <p className="text-muted-foreground text-xs">{week}</p>
    </section>
  );
}
