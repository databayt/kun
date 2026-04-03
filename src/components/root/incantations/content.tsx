"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  schools,
  workflows,
  orderTypeLabels,
  type Spell,
  type Workflow,
  type OrderItem,
} from "@/components/docs/spellbook-data"

// ─── Types ──────────────────────────────────────────────────────────────────────

type ActiveItem =
  | { type: "spell"; spell: Spell; schoolName: string }
  | { type: "workflow"; workflow: Workflow }

// ─── Order Badge ────────────────────────────────────────────────────────────────

const orderStyles: Record<string, string> = {
  familiar: "bg-foreground text-background",
  portal: "border border-foreground/60",
  skill: "border border-dashed border-foreground/60",
  hook: "bg-muted border border-border",
  ward: "bg-muted/60 border border-dotted border-foreground/40",
  memory: "bg-muted/40 border border-foreground/20",
}

function OrderBadge({ type, name }: OrderItem) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono leading-tight",
        orderStyles[type]
      )}
    >
      <span className="opacity-50">{orderTypeLabels[type]}</span>
      <span>{name}</span>
    </span>
  )
}

// ─── Close Icon ─────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

function useOutsideClick(
  ref: React.RefObject<HTMLDivElement | null>,
  callback: () => void
) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [ref, callback])
}

// ─── Tag colors by school ───────────────────────────────────────────────────────

const schoolColors: Record<string, string> = {
  pipeline: "bg-foreground text-background hover:bg-foreground/80",
  "charm-work": "bg-muted hover:bg-muted/70 border border-border",
  transfiguration: "bg-muted hover:bg-muted/70 border border-border",
  "ancient-runes": "bg-muted hover:bg-muted/70 border border-border",
  conjuration: "bg-muted hover:bg-muted/70 border border-border",
  "dark-arts": "bg-muted hover:bg-muted/70 border border-border",
  animation: "bg-muted hover:bg-muted/70 border border-border",
  defense: "bg-muted hover:bg-muted/70 border border-border",
  reparo: "bg-muted hover:bg-muted/70 border border-border",
  quill: "bg-muted hover:bg-muted/70 border border-border",
  geminio: "bg-muted hover:bg-muted/70 border border-border",
  summoning: "bg-muted hover:bg-muted/70 border border-border",
  divination: "bg-muted hover:bg-muted/70 border border-border",
  "performance-magic": "bg-muted hover:bg-muted/70 border border-border",
  portkeys: "bg-muted hover:bg-muted/70 border border-border",
  unforgivable: "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20",
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function IncantationsContent() {
  const [active, setActive] = useState<ActiveItem | null>(null)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActive(null)
    }
    if (active) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [active])

  useOutsideClick(ref, () => setActive(null))

  // Flatten all spells with their school info
  const allSpells = schools.flatMap((school) =>
    school.spells.map((spell) => ({ spell, schoolId: school.id, schoolName: school.name }))
  )

  return (
    <>
      {/* ── Backdrop ── */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 h-full w-full bg-black/50"
          />
        )}
      </AnimatePresence>

      {/* ── Expanded Dialog ── */}
      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 z-[100] grid place-items-center">
            <motion.button
              key={`close-${id}`}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.05 } }}
              className="absolute top-4 right-4 flex items-center justify-center rounded-full bg-background p-1.5 lg:hidden"
              onClick={() => setActive(null)}
            >
              <CloseIcon />
            </motion.button>

            {active.type === "spell" ? (
              <motion.div
                layoutId={`card-${active.spell.name}-${id}`}
                ref={ref}
                className="mx-4 flex h-fit max-h-[85%] w-full max-w-[520px] flex-col overflow-y-auto rounded-lg border bg-background md:mx-0"
              >
                {/* Header */}
                <div className="border-b p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <motion.code
                        layoutId={`name-${active.spell.name}-${id}`}
                        className="text-xl font-bold"
                      >
                        {active.spell.name}
                      </motion.code>
                      <motion.p
                        layoutId={`effect-${active.spell.name}-${id}`}
                        className="mt-1 text-sm text-muted-foreground"
                      >
                        {active.spell.effect}
                      </motion.p>
                    </div>
                    <button
                      onClick={() => setActive(null)}
                      className="hidden rounded-full p-1.5 hover:bg-muted lg:flex"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {active.schoolName}
                  </p>
                </div>

                {/* Order */}
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5 p-6"
                >
                  <div>
                    <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      What activates
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {active.spell.order.map((o, i) => (
                        <OrderBadge key={`${o.type}-${o.name}-${i}`} {...o} />
                      ))}
                    </div>
                  </div>

                  {/* Steps */}
                  {active.spell.steps.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Execution
                      </div>
                      <ol className="space-y-2">
                        {active.spell.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-[13px]">
                            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-[10px] text-muted-foreground">
                              {i + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Connects */}
                  {active.spell.connects.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Connects to
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {active.spell.connects.map((c) => (
                          <code
                            key={c}
                            className="rounded bg-muted px-2 py-0.5 text-[11px]"
                          >
                            {c}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Depends */}
                  {active.spell.depends.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Depends on
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {active.spell.depends.map((d) => (
                          <code
                            key={d}
                            className="rounded border border-dashed px-2 py-0.5 text-[11px]"
                          >
                            {d}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                layoutId={`workflow-${active.workflow.id}-${id}`}
                ref={ref}
                className="mx-4 flex h-fit max-h-[85%] w-full max-w-[520px] flex-col overflow-y-auto rounded-lg border bg-background md:mx-0"
              >
                {/* Header */}
                <div className="border-b p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <motion.div
                        layoutId={`wf-name-${active.workflow.id}-${id}`}
                        className="text-lg font-semibold"
                      >
                        {active.workflow.name}
                      </motion.div>
                      <motion.p
                        layoutId={`wf-desc-${active.workflow.id}-${id}`}
                        className="mt-1 text-sm text-muted-foreground"
                      >
                        {active.workflow.description}
                      </motion.p>
                    </div>
                    <button
                      onClick={() => setActive(null)}
                      className="hidden rounded-full p-1.5 hover:bg-muted lg:flex"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Workflow — {active.workflow.steps.length} steps
                  </p>
                </div>

                {/* Steps */}
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6"
                >
                  <div className="space-y-0">
                    {active.workflow.steps.map((step, i) => (
                      <div key={step.keyword} className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex size-9 items-center justify-center rounded-full border bg-muted">
                            <code className="text-[10px] font-bold">
                              {step.keyword.slice(0, 4)}
                            </code>
                          </div>
                          {i < active.workflow.steps.length - 1 && (
                            <div className="h-6 w-px bg-border" />
                          )}
                        </div>
                        <div className="-mt-1">
                          <code className="text-sm font-bold">{step.keyword}</code>
                          <p className="text-[12px] text-muted-foreground">
                            {step.action}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* ── Page ── */}
      <div className="flex h-[calc(100vh-var(--header-height))] flex-col">
        {/* Header area */}
        <div className="border-b px-responsive py-6 lg:px-0">
          <h1 className="text-3xl font-semibold tracking-tight">Incantations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One word triggers a complete workflow. Click any to see what happens inside.
          </p>
        </div>

        {/* Cloud tag area */}
        <div className="flex-1 overflow-y-auto px-responsive py-6 lg:px-0">
          {/* Workflows */}
          <div className="mb-6">
            <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Workflows
            </div>
            <div className="flex flex-wrap gap-2">
              {workflows.map((wf) => (
                <motion.button
                  layoutId={`workflow-${wf.id}-${id}`}
                  key={wf.id}
                  onClick={() => setActive({ type: "workflow", workflow: wf })}
                  className="cursor-pointer rounded-lg border bg-muted/50 px-3 py-2 text-start transition-colors hover:bg-muted"
                >
                  <motion.div
                    layoutId={`wf-name-${wf.id}-${id}`}
                    className="text-xs font-semibold"
                  >
                    {wf.name}
                  </motion.div>
                  <motion.p
                    layoutId={`wf-desc-${wf.id}-${id}`}
                    className="text-[10px] text-muted-foreground"
                  >
                    {wf.description}
                  </motion.p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Keywords by school */}
          {schools.map((school) => (
            <div key={school.id} className="mb-5">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {school.number}.
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {school.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {school.spells.map((spell) => (
                  <motion.button
                    layoutId={`card-${spell.name}-${id}`}
                    key={spell.name}
                    onClick={() =>
                      setActive({
                        type: "spell",
                        spell,
                        schoolName: school.name,
                      })
                    }
                    className={cn(
                      "cursor-pointer rounded-full px-3 py-1 transition-all",
                      schoolColors[school.id] || "bg-muted hover:bg-muted/70 border border-border"
                    )}
                  >
                    <motion.code
                      layoutId={`name-${spell.name}-${id}`}
                      className="text-xs font-bold"
                    >
                      {spell.name}
                    </motion.code>
                    <motion.p
                      layoutId={`effect-${spell.name}-${id}`}
                      className="sr-only"
                    >
                      {spell.effect}
                    </motion.p>
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
