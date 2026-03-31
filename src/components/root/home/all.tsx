import Card from "@/components/atom/card"
import { homeItems } from "./config"
import {
  ClaudeMdIcon,
  RulesIcon,
  CommandsIcon,
  AgentsIcon,
  HooksIcon,
  SkillsIcon,
  MCPIcon,
  ConnectorsIcon,
  AppsIcon,
  MemoryIcon,
  DispatchIcon,
  VoiceIcon,
  CoworkIcon,
  CaptainIcon,
  TeamIcon,
  CredentialsIcon,
  TipsIcon,
  TwitterIcon,
} from "@/components/atom/icons"
import type { Locale } from '@/components/local/config'

const iconMap = {
  ClaudeMdIcon,
  RulesIcon,
  CommandsIcon,
  AgentsIcon,
  HooksIcon,
  SkillsIcon,
  MCPIcon,
  ConnectorsIcon,
  AppsIcon,
  MemoryIcon,
  DispatchIcon,
  VoiceIcon,
  CoworkIcon,
  CaptainIcon,
  TeamIcon,
  CredentialsIcon,
  TipsIcon,
  TwitterIcon,
}

interface HomeCardsProps {
  lang?: Locale
}

export default function HomeCards({ lang = 'en' }: HomeCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 py-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {homeItems.map((item) => {
        const IconComponent = iconMap[item.icon as keyof typeof iconMap]
        return (
          <Card
            key={item.id}
            id={item.id}
            title={item.title}
            description={item.description}
            icon={IconComponent ? <IconComponent className="fill-current" /> : null}
            href={`/${lang}${item.href}`}
          />
        )
      })}
    </div>
  )
}
