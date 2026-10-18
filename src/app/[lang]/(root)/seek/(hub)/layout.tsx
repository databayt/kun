import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Announcement } from "@/components/atom/announcement";
import { PageHeader } from "@/components/atom/page-header";
import { TwoButtons } from "@/components/atom/two-buttons";
import { isRTL, type Locale } from "@/components/local/config";
import { getConsoleDict } from "@/components/root/seek/console/dictionary";
import { ago } from "@/components/root/seek/console/format";
import { CONSOLE_TRACKS, loadConsole } from "@/components/root/seek/console/load";
import { ConsoleShell } from "@/components/root/seek/console/shell";
import { requireContributor } from "@/lib/auth-guard";
import { needsMe } from "@/lib/seek/metrics";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Seek console | Databayt",
};

interface Props {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}

// The private console's frame: header, view tabs, the loop's pulse. Each view
// is a child route and re-guards through the store, since a layout doesn't
// re-render on client navigation.
export default async function SeekHubLayout({ params, children }: Props) {
  const { lang } = await params;
  const locale = lang as Locale;
  if (!(await requireContributor())) {
    redirect(`/${lang}/login?callbackUrl=${encodeURIComponent(`/${lang}/seek/board`)}`);
  }
  const t = getConsoleDict(locale);
  const data = await loadConsole();
  const needs = data ? CONSOLE_TRACKS.reduce((n, tr) => n + needsMe(data.items, tr).length, 0) : 0;

  return (
    <div className="px-responsive lg:px-0" dir={isRTL(locale) ? "rtl" : "ltr"}>
      <PageHeader
        announcement={
          <Announcement text={t.announcement} href={`/${lang}/seek`} external={false} badgeClassName="px-0" />
        }
        heading={t.title}
        description={t.description}
        descriptionClassName="max-w-2xl"
        actions={
          <TwoButtons
            primaryLabel={t.primaryAction}
            primaryHref={`/${lang}/seek/needs`}
            secondaryLabel={t.secondaryAction}
            secondaryHref={`/${lang}/docs/seek`}
          />
        }
      />
      <ConsoleShell
        lang={locale}
        t={t}
        lastTick={ago(data?.instance.lastTickAt ?? null, locale, t.never)}
        sendOff={Boolean(data?.instance.state.sendOff)}
        needs={needs}
      />
      <div className="py-6">
        {data ? children : <p className="text-muted-foreground py-10 text-sm">{t.noData}</p>}
      </div>
    </div>
  );
}
