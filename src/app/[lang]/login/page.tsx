import { type Locale } from "@/components/local/config";
import { LoginContent } from "@/components/root/context/login";

export const metadata = {
  title: "Login",
};

interface LoginPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string }>;
}

// Lives OUTSIDE the (root) group on purpose: no header, no footer — just the
// dialog over a bare backdrop.
export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { lang } = await params;
  const { next } = await searchParams;
  const locale = lang as Locale;

  return (
    <div className="min-h-dvh" aria-hidden>
      <LoginContent lang={locale} next={next} />
    </div>
  );
}
