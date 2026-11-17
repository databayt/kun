import { redirect } from "next/navigation"

// Sessions live in the chat's ☰ drawer now.
export default async function SessionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/machine`)
}
