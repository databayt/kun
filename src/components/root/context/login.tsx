"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface LoginContentProps {
  lang: string;
  /** Where to land after signing in — defaults to the context hub. */
  next?: string;
}

// Rendered as a dialog over a bare backdrop (the /login route carries no site
// chrome). Dismissing it goes home — the page behind it is deliberately empty.
export function LoginContent({ lang, next }: LoginContentProps) {
  const isAr = lang === "ar";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const destination = next && next.startsWith("/") ? next : `/${lang}/context`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(isAr ? "بيانات الدخول غير صحيحة" : "Invalid credentials");
      setLoading(false);
      return;
    }

    router.push(destination);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.push(`/${lang}`);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isAr ? "تسجيل الدخول" : "Sign in"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? "مساحة المساهمين — بريدك في databayt وكلمة المرور."
              : "Contributors only — your databayt email and password."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isAr ? "البريد الإلكتروني" : "Email"}
            autoComplete="username"
            autoFocus
            required
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isAr ? "كلمة المرور" : "Password"}
            autoComplete="current-password"
            required
          />

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isAr
                ? "جاري الدخول…"
                : "Signing in…"
              : isAr
                ? "دخول"
                : "Sign in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
