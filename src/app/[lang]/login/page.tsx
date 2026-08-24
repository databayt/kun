import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DEFAULT_LOGIN_REDIRECT, safeCallbackUrl } from "@/routes";
import { type Locale } from "@/components/local/config";
import { LoginContent } from "@/components/root/context/login";

export const metadata = {
  title: "Login",
};

interface LoginPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
}

// Lives OUTSIDE the (root) group on purpose: no header, no footer — just the
// dialog over a bare backdrop.
export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { lang } = await params;
  const { callbackUrl } = await searchParams;
  const locale = lang as Locale;

  // An auth route: someone already signed in has no business on the login
  // screen, so honour their callback (or the default hub) straight away. Same
  // role the reference block's `authRoutes` list plays in its middleware.
  const session = await auth();
  if (session?.user) {
    redirect(
      safeCallbackUrl(callbackUrl) ?? `/${lang}${DEFAULT_LOGIN_REDIRECT}`,
    );
  }

  return (
    <div className="min-h-dvh" aria-hidden>
      <LoginContent lang={locale} callbackUrl={callbackUrl} />
    </div>
  );
}
