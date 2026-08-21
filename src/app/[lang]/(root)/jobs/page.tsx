import { Metadata } from "next";
import { type Locale, isRTL } from "@/components/local/config";
import { PageHeader } from "@/components/atom/page-header";
import { Announcement } from "@/components/atom/announcement";
import { TwoButtons } from "@/components/atom/two-buttons";
import { getJobsDict } from "@/components/root/jobs/dictionary";
import { JobsHub } from "@/components/root/jobs/jobs-hub";
import { getJobsList, getEvidenceProfile } from "@/actions/jobs";

export const metadata: Metadata = {
  title: "Job Engine | Databayt",
  description:
    "Evidence-based career matching engine powered by real repository engineering proof from Databayt.",
};

interface JobsPageProps {
  params: Promise<{ lang: string }>;
}

export default async function JobsPage({ params }: JobsPageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
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
            href={`/${lang}/jobs`}
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
            primaryHref={`/${lang}/jobs/profile`}
            secondaryLabel={t.secondaryAction}
            secondaryHref={`/${lang}/docs/jobs`}
          />
        }
      />

      <JobsHub initialJobs={jobs} profile={profile} lang={locale} />
    </div>
  );
}
