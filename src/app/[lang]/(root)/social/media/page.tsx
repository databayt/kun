import type { Locale } from "@/components/local/config";
import { ShowroomContent } from "@/components/root/social/showroom/content";

interface SocialMediaPageProps {
  params: Promise<{ lang: string }>;
}

/**
 * The media stage — the showroom: generated assets and kept references,
 * filterable by collection, brand, and type; rendered decks link to their
 * live carousel routes.
 */
export default async function SocialMediaPage({
  params,
}: SocialMediaPageProps) {
  const { lang } = await params;
  return <ShowroomContent lang={lang as Locale} />;
}
