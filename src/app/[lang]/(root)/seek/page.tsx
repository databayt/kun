import type { Metadata } from "next";
import SeekContent from "@/components/root/seek/content";
import { type Locale } from "@/components/local/config";

export const metadata: Metadata = {
  title: "Seek | Databayt",
  description:
    "An open opportunity loop for Claude Code — discover openings, tailor the CV and letter, apply, follow up, and get briefed when someone replies.",
};

// The pulse reads the loop's mirror; the loop pushes every 30 minutes.
export const revalidate = 1800;

interface SeekPageProps {
  params: Promise<{ lang: string }>;
}

export default async function SeekPage({ params }: SeekPageProps) {
  const { lang } = await params;
  return <SeekContent lang={lang as Locale} />;
}
