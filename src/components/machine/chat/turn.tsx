"use client"

import { Fragment, memo, useState } from "react"
import { CheckIcon, CopyIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { copy, tr } from "./config"

/** The user's turn as Claude draws it: a rounded bubble at the end side, a 5% tint of the text colour, up to 85% of the column. */
export const UserTurn = memo(function UserTurn({ text }: { text: string }) {
  return (
    <li className="flex justify-end">
      <p dir="auto" className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-foreground/5 px-4 py-3 text-[17px] leading-[1.45] text-foreground md:text-base">
        {text}
      </p>
    </li>
  )
})

/** The agent's turn: no bubble and no avatar — its steps, then plain full-width text. */
export function AgentTurn({ steps, children }: { steps?: React.ReactNode; children?: React.ReactNode }) {
  return <li className="min-w-0 scroll-mt-16 space-y-2.5 text-[17px] leading-7 md:text-base">{steps}{children}</li>
}

/** `**bold**` inside a line; everything else stays text (no HTML is ever parsed). */
function inline(line: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}

type Block = { kind: "p"; lines: string[] } | { kind: "h"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[] }

/** An answer as ChatGPT sets it: paragraphs, bold heads, `-`/`•` bullets and `1.` steps. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const blocks: Block[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd()
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line)
    const step = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const head = /^#{1,4}\s+(.*)$/.exec(line)
    const last = blocks.at(-1)
    if (!line.trim()) blocks.push({ kind: "p", lines: [] })
    else if (bullet || step) {
      const kind = bullet ? "ul" : "ol"
      const item = (bullet ?? step)![1]!
      if (last && last.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else if (head) blocks.push({ kind: "h", lines: [head[1]!] })
    else if (last?.kind === "p") last.lines.push(line)
    else blocks.push({ kind: "p", lines: [line] })
  }

  return (
    <div dir="auto" className={cn("space-y-3 text-start leading-[inherit] text-foreground", className)}>
      {blocks.map((b, i) =>
        b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1.5 ps-6 marker:text-foreground">
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : b.kind === "ol" ? (
          <ol key={i} className="list-decimal space-y-2 ps-6 marker:text-foreground">
            {b.items.map((item, j) => (
              <li key={j} className="ps-1">
                {inline(item)}
              </li>
            ))}
          </ol>
        ) : b.kind === "h" ? (
          <h3 key={i} className="pt-2 text-[1.15em] font-semibold leading-snug">
            {inline(b.lines[0]!)}
          </h3>
        ) : b.lines.length ? (
          <p key={i} className="whitespace-pre-wrap break-words">
            {inline(b.lines.join("\n"))}
          </p>
        ) : null
      )}
    </div>
  )
}

/** The row under the latest answer: copy, 👍, 👎. The thumbs are local state only. */
export function TurnActions({ text, isAr }: { text: string; isAr: boolean }) {
  const t = tr(isAr)
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<"good" | "bad" | null>(null)
  const plain = text.replace(/\*\*/g, "").replace(/^#{1,4}\s+/gm, "")
  const doCopy = () => {
    void navigator.clipboard?.writeText(plain).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  const button = "flex size-9 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 [&_svg]:size-[19px]"
  const copyLabel = copied ? t(copy.copied) : t(copy.copy)

  return (
    <div className="-ms-2 flex items-center">
      <button type="button" className={button} aria-label={copyLabel} title={copyLabel} onClick={doCopy}>
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </button>
      {vote !== "bad" && (
        <button type="button" className={button} aria-pressed={vote === "good"} aria-label={t(copy.good)} title={t(copy.good)} onClick={() => setVote(vote === "good" ? null : "good")}>
          <ThumbsUpIcon className={cn(vote === "good" && "fill-current text-foreground")} aria-hidden />
        </button>
      )}
      {vote !== "good" && (
        <button type="button" className={button} aria-pressed={vote === "bad"} aria-label={t(copy.bad)} title={t(copy.bad)} onClick={() => setVote(vote === "bad" ? null : "bad")}>
          <ThumbsDownIcon className={cn(vote === "bad" && "fill-current text-foreground")} aria-hidden />
        </button>
      )}
    </div>
  )
}
