import { PageHeader } from '@/components/atom/page-header';
import { Announcement } from '@/components/atom/announcement';
import { TwoButtons } from '@/components/atom/two-buttons';
import type { getDictionary } from '@/components/local/dictionaries';
import type { Locale } from '@/components/local/config';

interface HeroProps {
  dictionary: Awaited<ReturnType<typeof getDictionary>>;
  params: { lang: Locale };
}

export default function Hero({ dictionary, params }: HeroProps) {
  return (
    <PageHeader
      announcement={
        <Announcement
          text={dictionary.announcement?.text || "Configuration engine for Anthropic products"}
          href={`/${params.lang}/docs`}
        />
      }
      heading={dictionary.homepage?.heading || "The Databayt Engine"}
      description={dictionary.homepage?.description || "28 agents, 17 skills, 18 MCP servers, 100+ keywords — configured to run both technical and business operations from a single word."}
      actions={
        <TwoButtons
          primaryLabel={dictionary.actions?.getStarted || "Get Started"}
          primaryHref={`/${params.lang}/docs`}
          secondaryLabel={dictionary.actions?.configuration || "Configuration"}
          secondaryHref={`/${params.lang}/docs/configuration`}
        />
      }
    />
  );
}
