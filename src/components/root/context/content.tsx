"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { type Spell } from "@/components/docs/spellbook-data"
import { type RepoStatus, fetchRepoStatus } from "@/actions/status"
import {
  contributors as allContributors,
  repos,
  getVisibleStories,
  getRepo,
  type Story,
  type Contributor,
} from "./config"
import { StoryBar } from "./story-bar"
import { StatusBar } from "./status-bar"
import { CloudTag } from "./cloud-tag"
import { DispatchModal } from "./dispatch-modal"
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

  const stories = getVisibleStories()
  const [selectedStory, setSelectedStory] = useState<Story | null>(stories.find((s) => s.status === "active") || null)
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null)

  // Login form state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Resolve contributor from session
  const contributor: Contributor | null =
    allContributors.find((c) => c.id === (session?.user as { contributorId?: string })?.contributorId) || null

  // Derive repo from selected story
  const activeRepo = selectedStory ? getRepo(selectedStory.repo) : repos[0]

  useEffect(() => {
    if (activeRepo) {
      fetchRepoStatus(activeRepo.github).then(setRepoStatus).catch(() => {})
    }
  }, [activeRepo?.id])

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

  if (authStatus === "loading") return null

  // Not authenticated — skeleton cloud + login dialog
  if (!contributor) {
    return (
      <div className="container-wrapper h-[calc(100vh-var(--header-height))]">
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
    <div className="container-wrapper min-h-[calc(100vh-var(--header-height))]">
      <div className="mx-auto max-w-xl py-12 px-6">
        {/* Greeting */}
        <p className="text-sm text-muted-foreground/50">
          {isAr ? contributor.nameAr : contributor.name}
        </p>

        {/* Stories */}
        <div className="mt-6">
          <StoryBar
            stories={stories}
            selected={selectedStory}
            onSelect={setSelectedStory}
            lang={lang}
          />
        </div>

        {/* Status */}
        <div className="mt-2">
          {activeRepo && (
            <StatusBar
              status={repoStatus}
              repoLabel={isAr ? activeRepo.labelAr : activeRepo.label}
              lang={lang}
            />
          )}
        </div>

        {/* Cloud Tag */}
        <div className="mt-10">
          <CloudTag
            selectedStory={selectedStory}
            contributor={contributor}
            onSelect={setSelectedSpell}
          />
        </div>

        {/* Dispatch Modal */}
        <DispatchModal
          spell={selectedSpell}
          repo={activeRepo?.github || "databayt/hogwarts"}
          repoLabel={isAr ? (activeRepo?.labelAr || "") : (activeRepo?.label || "")}
          feature={selectedStory ? { name: selectedStory.name, nameAr: selectedStory.nameAr, issue: selectedStory.issue, keywords: selectedStory.keywords } : null}
          onClose={() => setSelectedSpell(null)}
          lang={lang}
        />
      </div>
    </div>
  )
}
