"use client"

import { useState } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { LogIn, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

export function UserButton() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const lang = pathname.startsWith("/ar") ? "ar" : "en"
  const isAr = lang === "ar"

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" title={session.user.name || ""}>
            <span className="text-xs font-mono">{initial}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{session.user.name}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={`/${lang}/profile`}>
              <User className="size-4" />
              {isAr ? "الملف الشخصي" : "Profile"}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: `/${lang}` })}>
            <LogOut className="size-4" />
            {isAr ? "خروج" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Not signed in
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Sign in"
        onClick={() => setOpen(true)}
      >
        <LogIn className="size-4.5" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); }}>
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
    </>
  )
}
