import { type Locale } from "@/components/local/config"
import { LoginContent } from "@/components/root/context/login"

export const metadata = {
  title: "Login",
}

interface LoginPageProps {
  params: Promise<{ lang: string }>
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { lang } = await params
  const locale = lang as Locale

  return <LoginContent lang={locale} />
}
