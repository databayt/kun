import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isRTL, type Locale } from "@/components/local/config";
import { PageHeader } from "@/components/atom/page-header";
import { Announcement } from "@/components/atom/announcement";
import { TwoButtons } from "@/components/atom/two-buttons";
import { getSocialDict } from "@/components/root/social/dictionary";
import { SocialProvider } from "@/components/root/social/provider";
import { SocialShell } from "@/components/root/social/shell";

export const metadata: Metadata = {
  title: "Kun for social media | Hermes Integration",
  description:
    "Connect and publish to social media platforms via remote Hermes.",
};

interface SocialLayoutProps {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}

/**
 * The Hub's frame: header, provider, tab row. Each pipeline stage is a child
 * route; the layout persists across stage navigations, so the provider's state
 * (brand, channels, typed copy, the agent's queue poll) survives the way the
 * old single-page dashboard's hidden panels kept it alive.
 */
export default async function SocialLayout({
  params,
  children,
}: SocialLayoutProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const t = getSocialDict(locale);

  // Guard at the server boundary — publishing surfaces are contributors-only
  // (the actions re-check on top of this; see post-social.ts). Production-gated
  // rather than unconditional so local browser automation can reach the Hub
  // without a login; the same shape rate-limit.ts and turnstile.ts use. Vercel
  // builds preview as NODE_ENV=production, so preview is gated too.
  if (process.env.NODE_ENV === "production") {
    const session = await auth();
    if (!session?.user) {
      redirect(
        `/${lang}/login?callbackUrl=${encodeURIComponent(`/${lang}/social`)}`,
      );
    }
  }

  // Same shell as the homepage — PageHeader + a bar under it, one rhythm. The
  // header is static, so it renders on the server and never reaches the bundle;
  // only the shell and the stage below it are interactive. It sits inside the
  // provider only so one wrapper can hold it and the tab row together — as
  // children it is still rendered on the server and crosses nothing.
  return (
    <div className="px-responsive lg:px-0" dir={isRTL(locale) ? "rtl" : "ltr"}>
      <SocialProvider lang={locale}>
        {/*
          The first half of the screen, exactly: everything that says what
          this page is, and nothing that does anything. The stage below
          therefore starts at the fold and can centre its box in the half
          that is left (see social/stage.tsx) — the two halves are one
          decision, made here and consumed there.

          Minus the site header, which is sticky and owns the top 3.5rem
          whatever this measures. `min-h`, not `h`: on a short screen the
          header's own content is taller than half a viewport and has to
          win — the halves are a promise about roomy screens, not a clip.
        */}
        <div className="social-stage-header-area flex min-h-[calc(50svh_-_var(--header-height))] flex-col justify-center transition-all duration-300">
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
          <SocialShell />
        </div>
        {children}
      </SocialProvider>
    </div>
  );
}
