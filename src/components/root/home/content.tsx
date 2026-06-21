import Hero from "./hero";
import HomeTabs from "./tabs";
import type { getDictionary } from "@/components/local/dictionaries";
import type { Locale } from "@/components/local/config";

interface HomeContentProps {
  dictionary: Awaited<ReturnType<typeof getDictionary>>;
  params: { lang: Locale };
}

export default function HomeContent({ dictionary, params }: HomeContentProps) {
  return (
    <div className="px-responsive lg:px-0">
      <Hero dictionary={dictionary} params={params} />
      <HomeTabs lang={params.lang} />
    </div>
  );
}
