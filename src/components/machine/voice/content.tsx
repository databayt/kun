"use client"

import { useEffect, useRef, useState } from "react"
import { isTauri } from "@tauri-apps/api/core"
import { DownloadIcon, LoaderIcon, MicIcon, SquareIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Locale } from "@/components/local/config"
import { downloadModel, startRecording, transcribe, voiceStatus, type Recording } from "./actions"
import type { ModelEvent, VoiceStatus } from "./types"

interface VoiceButtonProps {
  lang: Locale
  onTranscript: (text: string) => void
  className?: string
}

type Phase = "idle" | "recording" | "working" | "downloading"

/**
 * Push-to-talk: press and hold (or tap to start, tap to stop). Transcribes locally with
 * whisper; the first use downloads the speech model. Disabled outside the machine app.
 */
export function VoiceButton({ lang, onTranscript, className }: VoiceButtonProps) {
  const isAr = lang === "ar"
  const [available, setAvailable] = useState(false)
  const [status, setStatus] = useState<VoiceStatus | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recording = useRef<Recording | null>(null)

  useEffect(() => {
    if (!isTauri()) return
    setAvailable(true)
    voiceStatus().then(setStatus).catch((e) => setError(String(e)))
  }, [])

  const t = {
    off: isAr ? "الصوت يعمل داخل تطبيق كن فقط" : "Voice works inside the Kun app only",
    notBuilt: isAr ? "الصوت غير مفعّل في هذا الإصدار" : "Voice is not built into this version",
    download: isAr ? `نزّل نموذج الصوت (${status?.model_mb ?? 465} م.ب)` : `Download the speech model (${status?.model_mb ?? 465} MB)`,
    talk: isAr ? "اضغط للتحدث" : "Tap to talk",
    stop: isAr ? "اضغط للإيقاف" : "Tap to stop",
    working: isAr ? "جارٍ التحويل…" : "Transcribing…",
  }

  async function fetchModel() {
    setPhase("downloading")
    setError(null)
    try {
      await downloadModel((e: ModelEvent) => setProgress(e.kind === "downloading" ? e.percent : e.kind === "ready" ? 100 : null))
      setStatus(await voiceStatus())
    } catch (e) {
      setError(String(e))
    } finally {
      setPhase("idle")
      setProgress(null)
    }
  }

  async function toggle() {
    setError(null)
    if (phase === "recording" && recording.current) {
      setPhase("working")
      try {
        const { pcm, sampleRate } = await recording.current.stop()
        recording.current = null
        const result = await transcribe(pcm, sampleRate, lang)
        if (result.text) onTranscript(result.text)
      } catch (e) {
        setError(String(e))
      } finally {
        setPhase("idle")
      }
      return
    }
    try {
      recording.current = await startRecording()
      setPhase("recording")
    } catch {
      setError(isAr ? "تعذّر الوصول إلى الميكروفون — اسمح به من إعدادات النظام." : "Cannot reach the microphone — allow it in system settings.")
    }
  }

  const needsModel = available && status?.built && !status.model_ready
  const disabled = !available || status?.built === false || phase === "working" || phase === "downloading"
  const label = !available ? t.off : status?.built === false ? t.notBuilt : needsModel ? t.download : phase === "recording" ? t.stop : phase === "working" ? t.working : t.talk

  // Sits inside the composer's pill like mkan's mic; progress and errors float above it, not in the pill.
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40",
          phase === "recording" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          className
        )}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-pressed={phase === "recording"}
        onClick={() => (needsModel ? void fetchModel() : void toggle())}
      >
        {phase === "working" || phase === "downloading" ? (
          <LoaderIcon className="size-5 animate-spin" aria-hidden />
        ) : phase === "recording" ? (
          <SquareIcon className="size-3.5 animate-pulse fill-current" aria-hidden />
        ) : needsModel ? (
          <DownloadIcon className="size-5" aria-hidden />
        ) : (
          <MicIcon className="size-[22px]" aria-hidden />
        )}
      </button>
      {phase === "downloading" && progress !== null && (
        <span className="absolute bottom-full end-0 mb-2 rounded-lg border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm" dir="ltr">{progress}%</span>
      )}
      {error && (
        <span role="alert" className="absolute bottom-full end-0 mb-2 w-56 rounded-lg border bg-background px-2 py-1 text-xs text-destructive shadow-sm">{error}</span>
      )}
    </span>
  )
}

export default VoiceButton
