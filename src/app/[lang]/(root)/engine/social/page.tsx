import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { type Locale } from "@/components/local/config";
import SocialDashboard from "@/components/root/social/social-dashboard";

export const metadata: Metadata = {
  title: "Social Hub | Hermes Integration",
  description:
    "Connect and publish to social media platforms via remote Hermes.",
};

interface SocialPageProps {
  params: Promise<{ lang: string }>;
}

export default async function SocialPage({ params }: SocialPageProps) {
  const { lang } = await params;
  const locale = lang as Locale;

  // Guard at the server boundary — publishing surfaces are contributors-only
  // (the actions re-check on top of this; see post-social.ts).
  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/login`);
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 sm:px-6 lg:px-8">
      <SocialDashboard lang={locale} />
    </div>
  );
}
