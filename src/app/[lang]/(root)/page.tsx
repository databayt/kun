import HomeContent from "@/components/root/home/content";
import { getDictionary } from "@/components/local/dictionaries";
import { type Locale } from "@/components/local/config";

export const metadata = {
  title: "Home",
}

interface HomePageProps {
  params: Promise<{ lang: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const dictionary = await getDictionary(locale);

  return <HomeContent dictionary={dictionary} params={{ lang: locale }} />;
}
