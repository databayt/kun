"use client"

import { useEffect, useId, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { type Spell } from "@/components/docs/spellbook-data"
import { dispatch } from "@/actions/dispatch"
import { getVisibleStories, getRepo, type Story } from "./config"
import { Button } from "@/components/ui/button"

interface KeywordCardProps {
  spell: Spell | null
  onClose: () => void
  lang: string
}

export function KeywordCard({ spell, onClose, lang }: KeywordCardProps) {
  const isAr = lang === "ar"
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const stories = getVisibleStories()

  const [dispatching, setDispatching] = useState<string | null>(null)
  const [result, setResult] = useState<{ storyId: string; ok: boolean; issueUrl?: string; error?: string } | null>(null)

  // Close on Escape
  useEffect(() => {
    if (!spell) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = "auto"
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [spell, onClose])

  // Close on outside click
  useEffect(() => {
    if (!spell) return
    function handleClick(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("touchstart", handleClick)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("touchstart", handleClick)
    }
  }, [spell, onClose])

  async function handleDispatch(story: Story) {
    if (!spell || dispatching) return
    const repo = getRepo(story.repo)
    if (!repo) return

    setDispatching(story.id)
    setResult(null)

    const res = await dispatch(repo.github, spell.name, story.name.toLowerCase())

    setResult({
      storyId: story.id,
      ok: res.ok,
      issueUrl: res.issueUrl,
      error: res.error,
    })
    setDispatching(null)
  }

  return (
    <AnimatePresence>
      {spell && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          />

          {/* Card */}
          <div className="fixed inset-0 z-50 grid place-items-center p-6">
            <motion.div
              layoutId={`keyword-${spell.name}-${id}`}
              ref={ref}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg"
            >
              {/* Header */}
              <div>
                <p className="font-mono text-lg text-foreground">{spell.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{spell.effect}</p>
              </div>

              {/* Agents/MCPs */}
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/40">
                {spell.order.map((o, i) => (
                  <span key={i} className="font-mono">
                    {o.type === "familiar" ? "agent" : o.type === "portal" ? "mcp" : o.type}:{o.name}
                  </span>
                ))}
              </div>

              {/* Stories */}
              <div className="mt-6 space-y-2">
                {stories.map((story) => {
                  const repo = getRepo(story.repo)
                  const isDispatching = dispatching === story.id
                  const storyResult = result?.storyId === story.id ? result : null

                  return (
                    <div
                      key={story.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-mono truncate">
                          {isAr ? story.nameAr : story.name}
                          {story.issue && (
                            <a
                              href={`https://github.com/${repo?.github}/issues/${story.issue}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              #{story.issue}
                            </a>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground/40">
                          {repo?.label}
                          {story.status === "active" && (
                            <span className="ml-1.5 text-foreground/60">
                              {isAr ? "نشط" : "active"}
                            </span>
                          )}
                        </p>
                      </div>

                      {storyResult?.ok ? (
                        <a
                          href={storyResult.issueUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isAr ? "عرض" : "view"}
                        </a>
                      ) : storyResult?.error ? (
                        <span className="shrink-0 text-xs text-red-500">
                          {isAr ? "خطأ" : "error"}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!dispatching}
                          onClick={() => handleDispatch(story)}
                          className="shrink-0 h-7 text-xs"
                        >
                          {isDispatching
                            ? isAr ? "..." : "..."
                            : isAr ? "تشغيل" : "run"}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="mt-4 cursor-pointer text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground"
              >
                {isAr ? "إغلاق" : "close"}
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
