"use client"

import { useState } from "react"
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
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useSession } from "next-auth/react"
import { LoginForm } from "@/components/auth/login/form"
import { logout } from "@/components/auth/logout-action"
import { getAuthText } from "@/components/auth/dictionary"

// Header avatar. Signed out → a dialog wrapping the shared LoginForm; signed in
// → a dropdown with profile + sign-out. All auth copy, the form, and the guards
// now come from the auth block, so this button no longer hand-rolls a second
// credentials form.
export function UserButton() {
  const { data: session, status } = useSession()
  const user = session?.user
  const pathname = usePathname()
  const lang = pathname.startsWith("/ar") ? "ar" : "en"
  const t = getAuthText(lang)

  const [open, setOpen] = useState(false)

  if (status === "loading") return null

  async function handleLogout() {
    await logout()
    window.location.href = `/${lang}`
  }

  if (user) {
    const initial = user.name?.[0] || "?"

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" title={user.name || ""}>
            <span className="text-xs font-mono">{initial}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={`/${lang}/profile`}>
              <User className="size-4" />
              {t.profile}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="size-4" />
            {t.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title={t.signIn}
        onClick={() => setOpen(true)}
      >
        <LogIn className="size-4.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <p className="text-sm text-muted-foreground">{t.description}</p>
          <LoginForm lang={lang} onSuccessHref={pathname} />
        </DialogContent>
      </Dialog>
    </>
  )
}
