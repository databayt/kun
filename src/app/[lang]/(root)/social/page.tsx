import { redirect } from "next/navigation";

interface SocialPageProps {
  params: Promise<{ lang: string }>;
}

/**
 * The bare /social URL opens on **Publish**.
 *
 * It used to open on Draft, where the old dashboard opened. That stopped
 * being right once Publish's box grew the rest of the pipeline: it asks for
 * copy, refines it, attaches media, carries the brand, feature, shape and
 * channels, and sends — now, later, or to an approver. Every other stage is a
 * specialist room around it. Landing on Draft meant every session began one
 * tab away from the only page that can finish the job.
 */
export default async function SocialPage({ params }: SocialPageProps) {
  const { lang } = await params;
  redirect(`/${lang}/social/publish`);
}
