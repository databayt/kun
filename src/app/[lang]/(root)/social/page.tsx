import { redirect } from "next/navigation";

interface SocialPageProps {
  params: Promise<{ lang: string }>;
}

/**
 * The Hub's stages are routes; the bare /social URL keeps working by opening
 * where the old dashboard opened — the Draft stage.
 */
export default async function SocialPage({ params }: SocialPageProps) {
  const { lang } = await params;
  redirect(`/${lang}/social/draft`);
}
