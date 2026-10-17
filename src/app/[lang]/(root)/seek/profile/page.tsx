import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContributor } from "@/lib/auth-guard";
import { type Locale, isRTL } from "@/components/local/config";
import { PageHeader } from "@/components/atom/page-header";
import { Announcement } from "@/components/atom/announcement";
import { TwoButtons } from "@/components/atom/two-buttons";
import { getJobsDict } from "@/components/root/jobs/dictionary";
import { ProfileDossier } from "@/components/root/jobs/profile-dossier";
import { getEvidenceProfile } from "@/actions/jobs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
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

  // The board carries one person's CV facts, letters and pipeline — it is the
  // private instance behind the public /seek workflow. The proxy gates it in
  // production; this re-check keeps the page safe if the proxy ever drifts.
  if (!(await requireContributor())) {
    redirect(`/${lang}/login?callbackUrl=${encodeURIComponent(`/${lang}/seek/profile`)}`);
  }
  const isAr = locale === "ar";
  const t = getJobsDict(locale);

  const profile = await getEvidenceProfile();

  return (
    <div className="px-responsive lg:px-0" dir={isRTL(locale) ? "rtl" : "ltr"}>
      <PageHeader
        announcement={
          <Announcement
            text={isAr ? "ملف الأدلة الهندسية — Databayt" : "Engineering Evidence Dossier — Databayt"}
            href={`/${lang}/seek`}
            external={false}
            badgeClassName="px-0"
          />
        }
        heading={t.evidenceTitle}
        description={t.evidenceSubtitle}
        descriptionClassName="max-w-xl"
        actions={
          <TwoButtons
            primaryLabel={isAr ? "العودة للوحة" : "Back to the board"}
            primaryHref={`/${lang}/seek/board`}
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
