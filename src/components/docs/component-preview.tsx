import * as React from "react"
import { cn } from "@/lib/utils"
import { highlightCode } from "@/lib/highlight-code"
import { CopyButton } from "@/components/docs/copy-button"

interface ComponentPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "center" | "start" | "end"
  hideCode?: boolean
  chromeLessOnMobile?: boolean
  code?: string
}

export async function ComponentPreview({
  children,
  className,
  align = "center",
  hideCode = false,
  chromeLessOnMobile = false,
  code,
  ...props
}: ComponentPreviewProps) {
  let highlightedCode: string | null = null

  if (code) {
    highlightedCode = await highlightCode(code, "tsx")
  }

  return (
    <div
      className={cn(
        "group relative mt-4 mb-12 flex flex-col gap-2 rounded-lg border",
        className
      )}
      {...props}
    >
      <div data-slot="preview">
        <div
          data-align={align}
          className={cn(
            "preview flex w-full justify-center data-[align=center]:items-center data-[align=end]:items-end data-[align=start]:items-start",
            chromeLessOnMobile ? "sm:p-10" : "h-[450px] p-10"
          )}
        >
          {children}
        </div>
        {!hideCode && code && highlightedCode && (
          <div
            data-slot="code"
            className="overflow-hidden [&_[data-rehype-pretty-code-figure]]:!m-0 [&_[data-rehype-pretty-code-figure]]:rounded-t-none [&_[data-rehype-pretty-code-figure]]:border-t [&_pre]:max-h-[400px]"
          >
            <ComponentCode code={code} highlightedCode={highlightedCode} />
          </div>
        )}
      </div>
    </div>
  )
}

function ComponentCode({
  code,
  highlightedCode,
}: {
  code: string
  highlightedCode: string
}) {
  return (
    <figure data-rehype-pretty-code-figure="" className="[&>pre]:max-h-96">
      <CopyButton value={code} />
      <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
    </figure>
  )
}
