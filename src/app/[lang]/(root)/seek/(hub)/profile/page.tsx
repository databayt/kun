import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContributor } from "@/lib/auth-guard";
import { type Locale } from "@/components/local/config";
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

// The evidence dossier, now a console view — the hub layout carries the header.
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  if (!(await requireContributor())) {
    redirect(`/${lang}/login?callbackUrl=${encodeURIComponent(`/${lang}/seek/profile`)}`);
  }
  const profile = await getEvidenceProfile();
  return <ProfileDossier profile={profile} lang={locale} />;
}
