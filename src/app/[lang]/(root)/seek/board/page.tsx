import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContributor } from "@/lib/auth-guard";
import { type Locale, isRTL } from "@/components/local/config";
import { PageHeader } from "@/components/atom/page-header";
import { Announcement } from "@/components/atom/announcement";
import { TwoButtons } from "@/components/atom/two-buttons";
import { getJobsDict } from "@/components/root/jobs/dictionary";
import { JobsHub } from "@/components/root/jobs/jobs-hub";
import { getJobsList, getEvidenceProfile } from "@/actions/jobs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Seek board | Databayt",
  description:
    "Evidence-based career matching engine powered by real repository engineering proof from Databayt.",
};

interface SeekBoardPageProps {
  params: Promise<{ lang: string }>;
}

export default async function SeekBoardPage({ params }: SeekBoardPageProps) {
  const { lang } = await params;
  const locale = lang as Locale;

  // The board carries one person's CV facts, letters and pipeline — it is the
  // private instance behind the public /seek workflow. The proxy gates it in
  // production; this re-check keeps the page safe if the proxy ever drifts.
  if (!(await requireContributor())) {
    redirect(`/${lang}/login?callbackUrl=${encodeURIComponent(`/${lang}/seek/board`)}`);
  }
  const t = getJobsDict(locale);

  const [jobs, profile] = await Promise.all([
    getJobsList(),
    getEvidenceProfile(),
  ]);

  return (
    <div className="px-responsive lg:px-0" dir={isRTL(locale) ? "rtl" : "ltr"}>
      <PageHeader
        announcement={
          <Announcement
            text={t.announcementText}
            href={`/${lang}/seek`}
            external={false}
            badgeClassName="px-0"
          />
        }
        heading={t.title}
        description={t.description}
        descriptionClassName="max-w-xl"
        actions={
          <TwoButtons
            primaryLabel={t.primaryAction}
            primaryHref={`/${lang}/seek/profile`}
            secondaryLabel={t.secondaryAction}
            secondaryHref={`/${lang}/docs/seek`}
          />
        }
      />

      <JobsHub initialJobs={jobs} profile={profile} lang={locale} />
    </div>
  );
}
