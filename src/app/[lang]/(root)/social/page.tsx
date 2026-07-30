import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { isRTL, type Locale } from "@/components/local/config";
import { PageHeader } from "@/components/atom/page-header";
import { Announcement } from "@/components/atom/announcement";
import { TwoButtons } from "@/components/atom/two-buttons";
import { getSocialDict } from "@/components/root/social/dictionary";
import { SocialLedger } from "@/components/root/social/ledger";
import SocialDashboard from "@/components/root/social/social-dashboard";

export const metadata: Metadata = {
  title: "Kun for social media | Hermes Integration",
  description:
    "Connect and publish to social media platforms via remote Hermes.",
};

interface SocialPageProps {
  params: Promise<{ lang: string }>;
}

export default async function SocialPage({ params }: SocialPageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const t = getSocialDict(locale);

  // Guard at the server boundary — publishing surfaces are contributors-only
  // (the actions re-check on top of this; see post-social.ts).
  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/login`);
  }

  // Same shell as the homepage — PageHeader + a bar under it, one rhythm. The
  // header is static, so it renders on the server and never reaches the bundle;
  // only the dashboard below it is interactive.
  return (
    <div className="px-responsive lg:px-0" dir={isRTL(locale) ? "rtl" : "ltr"}>
      <PageHeader
        announcement={
          <Announcement
            text={t.announcementText}
            href={`/${lang}/docs`}
            external={false}
            badgeClassName="px-0"
          />
        }
        heading={t.title}
        description={t.description}
        descriptionClassName="max-w-lg"
        actions={
          <TwoButtons
            primaryLabel={t.primaryAction}
            primaryHref={`/${lang}/docs/social`}
            secondaryLabel={t.secondaryAction}
            secondaryHref="https://github.com/databayt/kun/issues/new?labels=type%3Afeature&title=feat(social)%3A+"
          />
        }
      />
      <SocialDashboard lang={locale} />
      {/* The DB read streams in behind the interactive dashboard. */}
      <Suspense fallback={null}>
        <SocialLedger lang={locale} />
      </Suspense>
    </div>
  );
}
