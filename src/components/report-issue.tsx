"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"

import { reportIssue } from "@/actions/report-issue"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const categories = {
  en: [
    { value: "visual", label: "Visual / Layout" },
    { value: "broken", label: "Broken / Not Working" },
    { value: "data", label: "Wrong Data" },
    { value: "slow", label: "Slow / Performance" },
    { value: "confusing", label: "Confusing / UX" },
    { value: "other", label: "Other" },
  ],
  ar: [
    { value: "visual", label: "مظهر / تخطيط" },
    { value: "broken", label: "معطل / لا يعمل" },
    { value: "data", label: "بيانات خاطئة" },
    { value: "slow", label: "بطيء / أداء" },
    { value: "confusing", label: "مربك / تجربة المستخدم" },
    { value: "other", label: "أخرى" },
  ],
} as const

const translations = {
  en: {
    report: "Report an issue",
    title: "Report an issue",
    category: "Category",
    placeholder: "Describe the issue...",
    submit: "Submit",
    submitting: "Submitting...",
    success: "Submitted. Thank you!",
    error: "Something went wrong. Try again.",
  },
  ar: {
    report: "الإبلاغ عن مشكلة",
    title: "الإبلاغ عن مشكلة",
    category: "التصنيف",
    placeholder: "صف المشكلة...",
    submit: "إرسال",
    submitting: "جاري الإرسال...",
    success: "تم الإرسال. شكراً لك!",
    error: "حدث خطأ. حاول مرة أخرى.",
  },
} as const

export function ReportIssue() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")
  const pathname = usePathname()
  const lang = pathname?.startsWith("/ar") ? "ar" : "en"
  const t = translations[lang]
  const cats = categories[lang]

  async function handleSubmit() {
    if (!description.trim()) return
    setStatus("loading")
    try {
      await reportIssue({
        description,
        pageUrl: window.location.href,
        category: category || undefined,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        direction: document.documentElement.dir || (lang === "ar" ? "rtl" : "ltr"),
        browser: navigator.userAgent,
      })
      setStatus("success")
      setDescription("")
      setCategory("")
      setTimeout(() => {
        setOpen(false)
        setStatus("idle")
      }, 1500)
    } catch {
      setStatus("error")
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline font-medium underline underline-offset-4 cursor-pointer"
      >
        {t.report}
      </button>

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
          <select
            className="border-input text-foreground bg-transparent w-full rounded-md border px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t.category}</option>
            {cats.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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
    </>
  )
}
