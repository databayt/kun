"use client"

import { useState } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"

export function UserButton() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const lang = pathname.startsWith("/ar") ? "ar" : "en"
  const isAr = lang === "ar"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  if (status === "loading") return null

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

    setOpen(false)
    window.location.reload()
  }

  // Signed in — show initial, click to sign out
  if (session?.user) {
    const initial = session.user.name?.[0] || "?"

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            title={session.user.name || ""}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-foreground text-xs font-mono text-background transition-opacity hover:opacity-80"
          >
            {initial}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-xs p-6 gap-0 [&>button]:hidden">
          <p className="text-sm text-foreground">
            {isAr ? session.user.name : session.user.name}
          </p>
          <p className="text-xs text-muted-foreground/50">
            {session.user.email}
          </p>
          <button
            onClick={() => signOut({ callbackUrl: `/${lang}` })}
            className="mt-6 cursor-pointer text-sm font-mono text-muted-foreground/50 transition-colors hover:text-foreground text-start"
          >
            {isAr ? "خروج" : "sign out"}
          </button>
        </DialogContent>
      </Dialog>
    )
  }

  // Not signed in — show ?, click to open login dialog
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); }}>
      <DialogTrigger asChild>
        <button className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-xs font-mono text-muted-foreground/40 transition-colors hover:text-foreground">
          ?
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xs p-6 gap-0 [&>button]:hidden">
        <p className="text-sm text-muted-foreground/50">
          {isAr ? "سياق" : "context"}
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
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

          {error && <p className="text-xs text-red-500">{error}</p>}

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
      </DialogContent>
    </Dialog>
  )
}
