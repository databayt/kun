import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ContextContent from "@/components/root/context/content";
import { type Locale } from "@/components/local/config";

export const metadata = {
  title: "Context",
};

interface ContextPageProps {
  params: Promise<{ lang: string }>;
}

export default async function ContextPage({ params }: ContextPageProps) {
  const { lang } = await params;
  const locale = lang as Locale;

  // Guard at the server boundary — the gating here was client-only, which hides
  // the markup but still renders the route and still lets its actions run.
  // Same pattern as social/page.tsx; middleware is the outer wall on top.
  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/login`);
  }

  return <ContextContent lang={locale} />;
}
