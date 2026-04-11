"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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

// ─── Spell Dialog Content ───────────────────────────────────────────────────────

function SpellContent({ spell, schoolName }: { spell: Spell; schoolName: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <code className="text-xl font-bold">{spell.name}</code>
        </DialogTitle>
        <DialogDescription>{spell.effect}</DialogDescription>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {schoolName}
        </p>
      </DialogHeader>

      <div className="space-y-5 pt-4">
        <div>
          <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            What activates
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spell.order.map((o, i) => (
              <OrderBadge key={`${o.type}-${o.name}-${i}`} {...o} />
            ))}
          </div>
        </div>

        {spell.steps.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Execution
            </div>
            <ol className="space-y-2">
              {spell.steps.map((step, i) => (
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

        {spell.connects.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Connects to
            </div>
            <div className="flex flex-wrap gap-1.5">
              {spell.connects.map((c) => (
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

        {spell.depends.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Depends on
            </div>
            <div className="flex flex-wrap gap-1.5">
              {spell.depends.map((d) => (
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
      </div>
    </>
  )
}

// ─── Workflow Dialog Content ────────────────────────────────────────────────────

function WorkflowContent({ workflow }: { workflow: Workflow }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{workflow.name}</DialogTitle>
        <DialogDescription>{workflow.description}</DialogDescription>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Workflow — {workflow.steps.length} steps
        </p>
      </DialogHeader>

      <div className="space-y-0 pt-4">
        {workflow.steps.map((step, i) => (
          <div key={step.keyword} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="flex size-9 items-center justify-center rounded-full border bg-muted">
                <code className="text-[10px] font-bold">
                  {step.keyword.slice(0, 4)}
                </code>
              </div>
              {i < workflow.steps.length - 1 && (
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
    </>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function IncantationsContent() {
  const [active, setActive] = useState<ActiveItem | null>(null)

  return (
    <>
      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[85vh] max-w-[520px] overflow-y-auto">
          {active?.type === "spell" && (
            <SpellContent spell={active.spell} schoolName={active.schoolName} />
          )}
          {active?.type === "workflow" && (
            <WorkflowContent workflow={active.workflow} />
          )}
        </DialogContent>
      </Dialog>

      <div className="px-responsive py-6 lg:px-0">
        <h1 className="text-3xl font-semibold tracking-tight">Incantations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One word triggers a complete workflow.
        </p>

        {/* Workflows */}
        <div className="mt-8 mb-8">
          <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Workflows
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setActive({ type: "workflow", workflow: wf })}
                className="w-fit cursor-pointer text-start"
              >
                <div className="text-sm text-blue-500 hover:underline">{wf.name}</div>
                <div className="text-xs text-muted-foreground">{wf.steps.map((s) => s.keyword).join(", ")}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Keywords index — two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {schools.map((school) => (
            <div key={school.id}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {school.number}.
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {school.name}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {school.spells.map((spell) => (
                  <button
                    key={spell.name}
                    onClick={() =>
                      setActive({
                        type: "spell",
                        spell,
                        schoolName: school.name,
                      })
                    }
                    className="w-fit cursor-pointer text-start text-sm"
                  >
                    <code className="text-sm text-blue-500 hover:underline">{spell.name}</code>
                    <span className="text-muted-foreground">
                      {spell.connects.length > 0
                        ? ` — ${spell.connects.join(", ")}`
                        : ` — ${spell.effect}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
