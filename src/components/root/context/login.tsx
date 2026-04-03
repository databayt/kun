"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

interface LoginContentProps {
  lang: string
}

export function LoginContent({ lang }: LoginContentProps) {
  const isAr = lang === "ar"
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError(isAr ? "بيانات خاطئة" : "invalid credentials")
      setLoading(false)
      return
    }

    router.push(`/${lang}/context`)
  }

  return (
    <div className="container-wrapper">
      <div className="mx-auto max-w-xs py-24 px-6">
        <p className="text-sm text-muted-foreground/50">
          {isAr ? "سياق" : "context"}
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isAr ? "البريد" : "email"}
            className="w-full bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground/30 border-b border-muted-foreground/20 pb-2 outline-none focus:border-foreground transition-colors"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isAr ? "كلمة المرور" : "password"}
            className="w-full bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground/30 border-b border-muted-foreground/20 pb-2 outline-none focus:border-foreground transition-colors"
            required
          />

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer text-sm font-mono text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/20"
          >
            {loading
              ? isAr ? "جاري..." : "signing in..."
              : isAr ? "دخول" : "sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
