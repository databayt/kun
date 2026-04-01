import { notFound } from "next/navigation"
import type { Metadata } from "next"
import TopicDetailPage from "@/components/root/topic/detail"
import { getTopicDetail, getAllTopicSlugs } from "@/components/root/topic/config"
import type { Locale } from "@/components/local/config"

export const runtime = "nodejs"
export const revalidate = false
export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  const slugs = getAllTopicSlugs()
  return slugs.flatMap((slug) => [
    { lang: "en", slug },
    { lang: "ar", slug },
  ])
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string; lang: Locale }>
}): Promise<Metadata> {
  const { slug } = await props.params
  const topic = getTopicDetail(slug)

  if (!topic) notFound()

  return {
    title: topic.title,
    description: topic.description,
  }
}

export default async function TopicPage(props: {
  params: Promise<{ slug: string; lang: Locale }>
}) {
  const { slug, lang } = await props.params
  const topic = getTopicDetail(slug)

  if (!topic) notFound()

  return <TopicDetailPage topic={topic} lang={lang} />
}
