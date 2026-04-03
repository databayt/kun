"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  schools,
  workflows,
  orderTypeLabels,
  type School,
  type Spell,
  type OrderItem,
  type Workflow,
} from "./spellbook-data"

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

// ─── Spell Card ─────────────────────────────────────────────────────────────────

function SpellCard({ spell }: { spell: Spell }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-4 transition-all",
        "hover:border-foreground/30",
        open && "border-foreground/20 bg-muted/30"
      )}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 text-start"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <code className="text-base font-bold">{spell.name}</code>
            {spell.order.find((o) => o.type === "skill") && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {spell.order.find((o) => o.type === "skill")?.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {spell.effect}
          </p>
        </div>
        <svg
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground/40 transition-transform",
            open && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Order badges */}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {spell.order.map((o, i) => (
          <OrderBadge key={`${o.type}-${o.name}-${i}`} {...o} />
        ))}
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Steps */}
          {spell.steps.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Execution
              </div>
              <ol className="space-y-1.5">
                {spell.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px]">
                    <span className="mt-px font-mono text-[11px] text-muted-foreground/60">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Connects */}
          {spell.connects.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Connects to
              </div>
              <div className="flex flex-wrap gap-1">
                {spell.connects.map((c) => (
                  <code
                    key={c}
                    className="rounded bg-muted px-1.5 py-0.5 text-[11px]"
                  >
                    {c}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Depends */}
          {spell.depends.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Depends on
              </div>
              <div className="flex flex-wrap gap-1">
                {spell.depends.map((d) => (
                  <code
                    key={d}
                    className="rounded border border-dashed px-1.5 py-0.5 text-[11px]"
                  >
                    {d}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── School Section ─────────────────────────────────────────────────────────────

function SchoolSection({ school }: { school: School }) {
  return (
    <section className="mt-16 first:mt-0">
      {/* School header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-muted-foreground">
            {school.number}.
          </span>
          <h2 className="text-xl font-semibold tracking-tight">{school.name}</h2>
        </div>
        <p className="mt-0.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {school.subtitle}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {school.description}
        </p>
      </div>

      {/* Spell grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {school.spells.map((spell) => (
          <SpellCard key={spell.name} spell={spell} />
        ))}
      </div>

      {/* Quote */}
      {school.quote && (
        <p className="mt-4 border-s-2 ps-4 text-[13px] italic text-muted-foreground">
          {school.quote}
        </p>
      )}
    </section>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────────────

export function SpellbookLegend() {
  const types = [
    { type: "familiar", label: "Agent", desc: "AI familiar that does the work" },
    { type: "portal", label: "MCP", desc: "Portal to an external service" },
    { type: "skill", label: "Skill", desc: "Slash command executed" },
    { type: "hook", label: "Hook", desc: "Silent enchantment (auto-fires)" },
    { type: "ward", label: "Ward", desc: "Rule auto-activated by file path" },
    { type: "memory", label: "Memory", desc: "Persisted knowledge file" },
  ] as const

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        The Order — what activates behind each spell
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {types.map(({ type, label, desc }) => (
          <div key={type} className="flex items-center gap-2">
            <OrderBadge type={type} name={label} />
            <span className="text-[11px] text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Workflow Diagram ───────────────────────────────────────────────────────────

function WorkflowStep({
  keyword,
  action,
  isLast,
}: {
  keyword: string
  action: string
  isLast: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center">
        <div className="flex size-8 items-center justify-center rounded-full border bg-background">
          <code className="text-[10px] font-bold">{keyword.slice(0, 3)}</code>
        </div>
        {!isLast && <div className="h-6 w-px bg-border" />}
      </div>
      <div className="-mt-1">
        <code className="text-xs font-bold">{keyword}</code>
        <p className="text-[11px] text-muted-foreground">{action}</p>
      </div>
    </div>
  )
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-1 text-sm font-medium">{workflow.name}</div>
      <p className="mb-4 text-[11px] text-muted-foreground">{workflow.description}</p>
      <div>
        {workflow.steps.map((step, i) => (
          <WorkflowStep
            key={step.keyword}
            keyword={step.keyword}
            action={step.action}
            isLast={i === workflow.steps.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

export function SpellWorkflows() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workflows.map((wf) => (
        <WorkflowCard key={wf.id} workflow={wf} />
      ))}
    </div>
  )
}

// ─── Mastery Levels ─────────────────────────────────────────────────────────────

const levels = [
  {
    year: "First Year",
    title: "The Basics",
    spells: ["dev", "build", "push", "fix", "format", "lint"],
    desc: "Cast every day. Reflexes, not decisions.",
  },
  {
    year: "Third Year",
    title: "Creating",
    spells: ["component", "page", "form", "table", "card", "modal", "test"],
    desc: "Each spell creates something real.",
  },
  {
    year: "O.W.L.",
    title: "Compound Magic",
    spells: ["atom", "template", "deploy", "security", "docs", "motion"],
    desc: "Your spells have structure and ambition.",
  },
  {
    year: "N.E.W.T.",
    title: "System Magic",
    spells: ["block", "saas", "auth", "feature", "handover"],
    desc: "One word, dozens of files, complete functionality.",
  },
  {
    year: "Beyond",
    title: "Performance Mastery",
    spells: ["parallelize", "waterfall", "bundle", "streaming", "dedup"],
    desc: "You see invisible chains of latency and break them.",
  },
]

export function SpellMastery() {
  return (
    <div className="space-y-4">
      {levels.map((level) => (
        <div key={level.year} className="rounded-lg border p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {level.year}
            </span>
            <span className="text-sm font-medium">{level.title}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {level.spells.map((s) => (
              <code
                key={s}
                className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-bold"
              >
                {s}
              </code>
            ))}
          </div>
          <p className="mt-2 text-[12px] italic text-muted-foreground">
            {level.desc}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Stats ──────────────────────────────────────────────────────────────────────

export function SpellStats() {
  const totalSpells = schools.reduce((acc, s) => acc + s.spells.length, 0)
  const totalFamiliars = new Set(
    schools.flatMap((s) =>
      s.spells.flatMap((sp) => sp.order.filter((o) => o.type === "familiar").map((o) => o.name))
    )
  ).size
  const totalPortals = new Set(
    schools.flatMap((s) =>
      s.spells.flatMap((sp) => sp.order.filter((o) => o.type === "portal").map((o) => o.name))
    )
  ).size

  const stats = [
    { label: "Incantations", value: totalSpells },
    { label: "Schools", value: schools.length },
    { label: "Familiars", value: totalFamiliars },
    { label: "Portals", value: totalPortals },
    { label: "Workflows", value: workflows.length },
  ]

  return (
    <div className="grid grid-cols-5 gap-px overflow-hidden rounded-lg border bg-border">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-background p-3 text-center">
          <div className="font-mono text-2xl font-bold">{stat.value}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Spellbook ─────────────────────────────────────────────────────────────

export function Spellbook() {
  return (
    <div className="space-y-6">
      <SpellStats />
      <SpellbookLegend />
      {schools.map((school) => (
        <SchoolSection key={school.id} school={school} />
      ))}
    </div>
  )
}

export function SpellSchool({ id }: { id: string }) {
  const school = schools.find((s) => s.id === id)
  if (!school) return null
  return <SchoolSection school={school} />
}
