"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bug, CircleHelp, X } from "lucide-react"

import { reportIssue } from "@/actions/report-issue"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const translations = {
  en: {
    report: "Report an issue",
    title: "Report an issue",
    placeholder: "Describe the issue...",
    submit: "Submit",
    submitting: "Submitting...",
    success: "Submitted. Thank you!",
    error: "Something went wrong. Try again.",
    help: "Help",
    close: "Close",
  },
  ar: {
    report: "الإبلاغ عن مشكلة",
    title: "الإبلاغ عن مشكلة",
    placeholder: "صف المشكلة...",
    submit: "إرسال",
    submitting: "جاري الإرسال...",
    success: "تم الإرسال. شكراً لك!",
    error: "حدث خطأ. حاول مرة أخرى.",
    help: "مساعدة",
    close: "إغلاق",
  },
} as const

export function ReportIssue() {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")
  const pathname = usePathname()
  const t = translations[pathname?.startsWith("/ar") ? "ar" : "en"]

  async function handleSubmit() {
    if (!description.trim()) return
    setStatus("loading")
    try {
      await reportIssue({ description, pageUrl: window.location.href })
      setStatus("success")
      setDescription("")
      setTimeout(() => {
        setOpen(false)
        setStatus("idle")
      }, 1500)
    } catch {
      setStatus("error")
    }
  }

  if (dismissed) return null

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(true)}
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <Bug className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t.report}</p>
          </TooltipContent>
        </Tooltip>

        <Link
          href="https://databayt.org"
          target="_blank"
          className="text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
        >
          d
        </Link>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="https://github.com/databayt/kun/issues"
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <CircleHelp className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t.help}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t.close}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setStatus("idle")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
          </DialogHeader>
          <textarea
            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
            placeholder={t.placeholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {status === "error" && (
            <p className="text-destructive text-sm">{t.error}</p>
          )}
          {status === "success" ? (
            <p className="text-sm text-green-600">{t.success}</p>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!description.trim() || status === "loading"}
            >
              {status === "loading" ? t.submitting : t.submit}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
