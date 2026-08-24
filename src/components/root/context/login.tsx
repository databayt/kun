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
  /** Where to land after signing in — defaults to the context hub. */
  next?: string;
}

// Rendered as a dialog over a bare backdrop (the /login route carries no site
// chrome). Dismissing it goes home — the page behind it is deliberately empty.
// The form itself is the shared auth block LoginForm, so this route and the
// header UserButton stay in lockstep.
export function LoginContent({ lang, next }: LoginContentProps) {
  const router = useRouter();
  const t = getAuthText(lang);

  const destination =
    next && next.startsWith("/") ? next : `/${lang}/context`;

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

        <LoginForm lang={lang} onSuccessHref={destination} />
      </DialogContent>
    </Dialog>
  );
}
