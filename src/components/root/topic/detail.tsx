import Link from "next/link"
import { ArrowLeft, ExternalLink, BookOpen, Video, GitFork, FileText, Terminal, Wrench, CircleCheck, CircleAlert, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { TopicDetail, Reference } from "./config"
import type { Locale } from "@/components/local/config"
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
  GuardianIcon,
} from "@/components/atom/icons"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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
  GuardianIcon,
}

const refTypeIcon: Record<Reference["type"], React.ReactNode> = {
  docs: <BookOpen className="size-4" />,
  repo: <GitFork className="size-4" />,
  video: <Video className="size-4" />,
  article: <FileText className="size-4" />,
  tool: <Wrench className="size-4" />,
  social: <Users className="size-4" />,
}

const refTypeLabel: Record<Reference["type"], string> = {
  docs: "Documentation",
  repo: "Repository",
  video: "Video",
  article: "Article",
  tool: "Tool",
  social: "Social",
}

const statusConfig: Record<TopicDetail["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  current: { label: "Current", variant: "default" },
  review: { label: "Needs Review", variant: "secondary" },
  behind: { label: "Behind", variant: "destructive" },
}

interface TopicDetailPageProps {
  topic: TopicDetail
  lang: Locale
}

export default function TopicDetailPage({ topic, lang }: TopicDetailPageProps) {
  const IconComponent = iconMap[topic.icon]
  const statusInfo = statusConfig[topic.status]

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-0">
      {/* Back */}
      <Link
        href={`/${lang}`}
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Home
      </Link>

      {/* Header */}
      <div className="mt-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          {IconComponent && (
            <div className="mt-1 size-10 shrink-0">
              <IconComponent className="fill-current" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{topic.title}</h1>
            <p className="text-muted-foreground mt-1 text-base">{topic.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          <span className="text-muted-foreground text-xs">Reviewed {topic.lastReviewed}</span>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" size="sm" asChild>
          <a href={topic.officialDocs} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Official Docs
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${lang}${topic.kunDocs}`}>
            <BookOpen className="size-4" />
            Kun Docs
          </Link>
        </Button>
      </div>

      <Separator className="my-8" />

      {/* Overview */}
      <section>
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-muted-foreground mt-2 leading-7">{topic.overview}</p>
      </section>

      <Separator className="my-8" />

      {/* Progress */}
      <section>
        <h2 className="text-lg font-semibold">Current Progress</h2>
        <ul className="mt-4 space-y-2">
          {topic.progress.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-6">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-500" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <Separator className="my-8" />

      {/* Improvements */}
      <section>
        <h2 className="text-lg font-semibold">Areas of Improvement</h2>
        <ul className="mt-4 space-y-2">
          {topic.improvements.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-6">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <Separator className="my-8" />

      {/* References */}
      <section>
        <h2 className="text-lg font-semibold">References</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {topic.references.map((ref) => (
            <a
              key={ref.url}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:border-primary flex items-start gap-3 rounded-lg border p-4 transition-colors"
            >
              <div className="text-muted-foreground mt-0.5 shrink-0">
                {refTypeIcon[ref.type]}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{ref.title}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{refTypeLabel[ref.type]}</p>
              </div>
              <ExternalLink className="text-muted-foreground ms-auto mt-0.5 size-3 shrink-0" />
            </a>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Setup */}
      <section>
        <h2 className="text-lg font-semibold">Setup</h2>
        <ol className="text-muted-foreground mt-4 list-inside list-decimal space-y-2 text-sm leading-6">
          {topic.setup.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      <Separator className="my-8" />

      {/* Usage */}
      <section>
        <h2 className="text-lg font-semibold">Usage</h2>
        <ul className="text-muted-foreground mt-4 list-inside list-disc space-y-2 text-sm leading-6">
          {topic.usage.map((pattern, i) => (
            <li key={i}>{pattern}</li>
          ))}
        </ul>
      </section>

      <Separator className="my-8" />

      {/* Config files */}
      <section>
        <h2 className="text-lg font-semibold">Config Files</h2>
        <div className="mt-4 space-y-2">
          {topic.configPaths.map((path, i) => (
            <div
              key={i}
              className="bg-muted flex items-center gap-2 rounded-md px-3 py-2"
            >
              <Terminal className="text-muted-foreground size-4 shrink-0" />
              <code className="text-sm">{path}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
