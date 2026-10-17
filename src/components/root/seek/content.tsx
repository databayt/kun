import Link from "next/link";
import { BellRing, PenLine, Radar, Repeat, Send } from "lucide-react";
import { PageHeader } from "@/components/atom/page-header";
import { Announcement } from "@/components/atom/announcement";
import { TwoButtons } from "@/components/atom/two-buttons";
import { Badge } from "@/components/ui/badge";
import { TRACKS } from "@/lib/seek/tracks/registry";
import { cn } from "@/lib/utils";
import { isRTL, type Locale } from "@/components/local/config";
import { getSeekDict } from "./dictionary";

const STEP_ICONS = [Radar, PenLine, Send, Repeat, BellRing];

interface SeekContentProps {
  lang: Locale;
}

// The public face of seek: what the loop does, which tracks it covers, and how
// to run it yourself. Static on purpose — no session, no database; the private
// instance lives at /seek/board.
export default function SeekContent({ lang }: SeekContentProps) {
  const t = getSeekDict(lang);

  return (
    <div className="px-responsive lg:px-0" dir={isRTL(lang) ? "rtl" : "ltr"}>
      <PageHeader
        announcement={
          <Announcement
            text={t.eyebrow}
            href={`/${lang}/docs/seek`}
            external={false}
            badgeClassName="px-0"
          />
        }
        heading={t.title}
        description={t.description}
        descriptionClassName="max-w-2xl"
        actions={
          <TwoButtons
            primaryLabel={t.primaryAction}
            primaryHref="#install"
            secondaryLabel={t.secondaryAction}
            secondaryHref={`/${lang}/docs/seek`}
          />
        }
      />

      <div className="container-wrapper mx-auto max-w-6xl space-y-16 py-10">
        <section>
          <SectionHeading title={t.loopTitle} subtitle={t.loopSubtitle} />
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {t.steps.map((step, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <li key={step.title} className="bg-muted/40 rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="text-muted-foreground size-4" aria-hidden />
                    <span className="text-muted-foreground text-xs tabular-nums">{i + 1}</span>
                  </div>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm text-pretty">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section>
          <SectionHeading title={t.tracksTitle} subtitle={t.tracksSubtitle} />
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRACKS.map((track) => {
              const live = track.status === "live";
              return (
                <li
                  key={track.id}
                  className={cn("rounded-xl border p-5", !live && "border-dashed")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{track.label[lang]}</h3>
                    <Badge variant={live ? "default" : "outline"}>{live ? t.live : t.soon}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm text-pretty">
                    {track.summary[lang]}
                  </p>
                  <p className="text-muted-foreground mt-4 text-xs font-medium">{t.documents}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {track.artifacts.map((a) => (
                      <Badge key={a} variant="secondary" className="font-normal">
                        {t.artifacts[a]}
                      </Badge>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="install" className="scroll-mt-24">
          <SectionHeading title={t.installTitle} subtitle={t.installSubtitle} />
          <ol className="mt-6 space-y-4">
            {t.install.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-xl border p-5">
                <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{step.body}</p>
                  {step.code && (
                    <pre
                      dir="ltr"
                      className="bg-muted mt-3 overflow-x-auto rounded-lg px-3 py-2 text-xs"
                    >
                      <code>{step.code}</code>
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-6 text-sm">
            {t.privateNote}{" "}
            <Link href={`/${lang}/seek/board`} className="text-foreground underline underline-offset-4">
              {t.boardLink}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
    </header>
  );
}
