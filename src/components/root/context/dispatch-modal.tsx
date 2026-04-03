"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { type Spell } from "@/components/docs/spellbook-data"
import { dispatch } from "@/actions/dispatch"
interface StoryContext {
  name: string
  nameAr: string
  issue?: number
  keywords: string[]
}

interface DispatchModalProps {
  spell: Spell | null
  repo: string
  repoLabel: string
  feature: StoryContext | null
  onClose: () => void
  lang: string
}

export function DispatchModal({ spell, repo, repoLabel, feature, onClose, lang }: DispatchModalProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; issueUrl?: string; error?: string } | null>(null)
  const isAr = lang === "ar"

  const featureName = feature?.name?.toLowerCase() || ""

  async function handleRun() {
    if (!repo || !spell) return
    setLoading(true)
    setResult(null)
    const res = await dispatch(repo, spell.name, featureName || undefined)
    setResult(res)
    setLoading(false)
  }

  function handleClose() {
    setResult(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {spell && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-sm px-6"
          >
            <div className="space-y-4">
              {/* Keyword */}
              <div>
                <p className="font-mono text-lg">{spell.name}</p>
                <p className="text-sm text-muted-foreground">{spell.effect}</p>
              </div>

              {/* Context */}
              <p className="text-sm text-muted-foreground/60 font-mono">
                {repoLabel} &rarr; {isAr ? (feature?.nameAr || "") : (feature?.name || "")}
              </p>

              {/* Activates */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/40">
                {spell.order.map((o, i) => (
                  <span key={i} className="font-mono">
                    {o.type === "familiar" ? "agent" : o.type === "portal" ? "mcp" : o.type}:{o.name}
                  </span>
                ))}
              </div>

              {/* Result */}
              {result && (
                <p className={`text-sm ${result.ok ? "text-muted-foreground" : "text-red-500"}`}>
                  {result.ok ? (
                    <>
                      {isAr ? "تم" : "dispatched"}
                      {result.issueUrl && (
                        <>
                          {" "}&middot;{" "}
                          <a href={result.issueUrl} target="_blank" rel="noreferrer" className="underline">
                            {isAr ? "عرض" : "view"}
                          </a>
                        </>
                      )}
                    </>
                  ) : (
                    result.error
                  )}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-4 text-sm">
                <span
                  onClick={handleClose}
                  className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                >
                  {isAr ? "إلغاء" : "cancel"}
                </span>
                <span
                  onClick={!loading && !result?.ok ? handleRun : undefined}
                  className={`cursor-pointer font-mono transition-colors ${
                    loading || result?.ok
                      ? "text-muted-foreground/40"
                      : "text-foreground hover:text-foreground/80"
                  }`}
                >
                  {loading
                    ? isAr
                      ? "جاري..."
                      : "running..."
                    : result?.ok
                      ? isAr
                        ? "تم"
                        : "done"
                      : isAr
                        ? "تشغيل"
                        : "run"}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
