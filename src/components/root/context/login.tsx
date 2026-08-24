"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoginForm } from "@/components/auth/login/form";
import { getAuthText } from "@/components/auth/dictionary";

interface LoginContentProps {
  lang: string;
  /**
   * Where to land after signing in — set by whoever bounced the contributor
   * here (the proxy, a page guard). Validated and defaulted in the login
   * action; passed through untouched.
   */
  callbackUrl?: string;
}

// Rendered as a dialog over a bare backdrop (the /login route carries no site
// chrome). Dismissing it goes home — the page behind it is deliberately empty.
// The form itself is the shared auth block LoginForm, so this route and the
// header UserButton stay in lockstep.
export function LoginContent({ lang, callbackUrl }: LoginContentProps) {
  const router = useRouter();
  const t = getAuthText(lang);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.push(`/${lang}`);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <LoginForm lang={lang} callbackUrl={callbackUrl} />
      </DialogContent>
    </Dialog>
  );
}
