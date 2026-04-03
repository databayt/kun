"use client"

import { useState } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  // Signed in
  if (session?.user) {
    const initial = session.user.name?.[0] || "?"

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" title={session.user.name || ""}>
            <span className="text-xs font-mono">{initial}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xs p-6 gap-0 [&>button]:hidden">
          <p className="text-sm text-foreground">{session.user.name}</p>
          <p className="text-xs text-muted-foreground/50">{session.user.email}</p>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: `/${lang}` })}
            className="mt-6 w-full"
          >
            {isAr ? "خروج" : "sign out"}
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  // Not signed in
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" title="Sign in">
          <LogIn className="size-4.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs p-6 gap-0 [&>button]:hidden">
        <p className="text-sm text-muted-foreground/50">
          {isAr ? "تسجيل الدخول" : "sign in"}
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

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? isAr ? "جاري..." : "signing in..."
              : isAr ? "دخول" : "sign in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
