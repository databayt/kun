"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { type Spell } from "@/components/docs/spellbook-data"
import {
  contributors as allContributors,
  type Contributor,
} from "./config"
import { CloudTag } from "./cloud-tag"
import { KeywordCard } from "./keyword-card"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ContextContentProps {
  lang: string
}

export default function ContextContent({ lang }: ContextContentProps) {
  const isAr = lang === "ar"
  const { data: session, status: authStatus } = useSession()

  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)

  // Login form state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Resolve contributor from session
  const contributor: Contributor | null =
    allContributors.find((c) => c.id === (session?.user as { contributorId?: string })?.contributorId) || null

  async function handleLogin(e: React.FormEvent) {
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

    window.location.reload()
  }

  // Loading or not authenticated — skeleton cloud
  if (authStatus === "loading") {
    return (
      <div className="container-wrapper h-[calc(100vh-var(--header-height)-var(--footer-height))]">
        <div className="mx-auto max-w-xl flex h-full flex-col items-center justify-center px-6">
          <CloudTag selectedStory={null} contributor={null} skeleton />
        </div>
      </div>
    )
  }

  if (!contributor) {
    return (
      <div className="container-wrapper h-[calc(100vh-var(--header-height)-var(--footer-height))]">
        <div className="mx-auto max-w-xl flex h-full flex-col items-center justify-center px-6">
          <CloudTag
            selectedStory={null}
            contributor={null}
            skeleton
          />
        </div>

        <Dialog open onOpenChange={() => {}}>
          <DialogContent className="max-w-xs p-6 gap-0 [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-sm text-muted-foreground/50 cursor-pointer transition-colors hover:text-foreground text-start"
            >
              {isAr ? "رجوع" : "back"}
            </button>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAr ? "البريد" : "email"}
                autoFocus
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

              {error && <p className="text-xs text-red-500">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading
                  ? isAr ? "جاري..." : "signing in..."
                  : isAr ? "دخول" : "sign in"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="container-wrapper h-[calc(100vh-var(--header-height)-var(--footer-height))]">
      <div className="mx-auto max-w-xl flex h-full flex-col items-center justify-center px-6">
        <CloudTag
          selectedStory={null}
          contributor={contributor}
          onSelect={setSelectedSpell}
        />
      </div>

      <KeywordCard
        spell={selectedSpell}
        onClose={() => setSelectedSpell(null)}
        lang={lang}
      />
    </div>
  )
}
