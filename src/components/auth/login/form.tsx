"use client";

import { useTransition, useState } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getAuthText } from "../dictionary";
import { FormError } from "../form-error";
import { createLoginSchema, type LoginValues } from "../validation";
import { login } from "./action";

interface LoginFormProps {
  /** Locale override; falls back to the `[lang]` route param. */
  lang?: string;
  /** Where to send the browser after a successful sign-in. */
  onSuccessHref: string;
}

// The one login form in the app. Both entry points render it: the /login
// dialog and the header's UserButton. React Hook Form + zodResolver +
// createLoginSchema is the canonical validation stack from the mature block.
//
// After success we hard-navigate (window.location) rather than a client push,
// so the freshly-set session cookie is picked up on the next request instead of
// racing an in-memory session refresh.
export function LoginForm({ lang, onSuccessHref }: LoginFormProps) {
  const params = useParams();
  const resolvedLang = lang ?? (params.lang as string) ?? "en";
  const t = getAuthText(resolvedLang);

  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginValues>({
    resolver: zodResolver(createLoginSchema(t)),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginValues) => {
    setError("");
    startTransition(async () => {
      const result = await login(values, resolvedLang);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      window.location.href = onSuccessHref;
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.email}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder={t.emailPlaceholder}
                  autoComplete="username"
                  autoFocus
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.password}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  placeholder={t.passwordPlaceholder}
                  autoComplete="current-password"
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormError message={error} />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t.signingIn : t.signIn}
        </Button>
      </form>
    </Form>
  );
}
