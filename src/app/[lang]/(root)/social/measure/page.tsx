import { Suspense } from "react";
import type { Locale } from "@/components/local/config";
import { SocialLedger } from "@/components/root/social/ledger";

interface SocialMeasurePageProps {
  params: Promise<{ lang: string }>;
}

/**
 * The activity ledger. A Server Component rendered directly — the old
 * dashboard had to smuggle it in as a prop because a tab panel had to sit
 * inside the client that owned the tab state; a route needs no smuggling.
 */
export default async function SocialMeasurePage({
  params,
}: SocialMeasurePageProps) {
  const { lang } = await params;
  return (
    <Suspense fallback={null}>
      <SocialLedger lang={lang as Locale} />
    </Suspense>
  );
}
