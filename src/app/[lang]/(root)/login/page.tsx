import { type Locale } from "@/components/local/config"
import { LoginContent } from "@/components/root/context/login"

export const metadata = {
  title: "Login",
}

interface LoginPageProps {
  params: Promise<{ lang: Locale }>
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { lang } = await params

  return <LoginContent lang={lang} />
}
