import { Metadata } from "next";
import { type Locale, isRTL } from "@/components/local/config";
import { PageHeader } from "@/components/atom/page-header";
import { Announcement } from "@/components/atom/announcement";
import { TwoButtons } from "@/components/atom/two-buttons";
import { getJobsDict } from "@/components/root/jobs/dictionary";
import { ProfileDossier } from "@/components/root/jobs/profile-dossier";
import { getEvidenceProfile } from "@/actions/jobs";

export const metadata: Metadata = {
  title: "Engineering Knowledge Profile | Databayt",
  description:
    "Verified engineering capabilities extracted directly from Databayt repositories.",
};

interface ProfilePageProps {
  params: Promise<{ lang: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const isAr = locale === "ar";
  const t = getJobsDict(locale);

  const profile = await getEvidenceProfile();

  return (
    <div className="px-responsive lg:px-0" dir={isRTL(locale) ? "rtl" : "ltr"}>
      <PageHeader
        announcement={
          <Announcement
            text={isAr ? "ملف الأدلة الهندسية — Databayt" : "Engineering Evidence Dossier — Databayt"}
            href={`/${lang}/jobs`}
            external={false}
            badgeClassName="px-0"
          />
        }
        heading={t.evidenceTitle}
        description={t.evidenceSubtitle}
        descriptionClassName="max-w-xl"
        actions={
          <TwoButtons
            primaryLabel={isAr ? "العودة للوظائف" : "Back to Jobs"}
            primaryHref={`/${lang}/jobs`}
            secondaryLabel={isAr ? "التوثيق" : "Docs"}
            secondaryHref={`/${lang}/docs`}
          />
        }
      />

      <div className="container-wrapper py-8 max-w-7xl mx-auto">
        <ProfileDossier profile={profile} lang={locale} />
      </div>
    </div>
  );
}
