import { redirect } from "next/navigation"

// Sessions live in the mega menu now.
export default async function SessionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/machine`)
}
