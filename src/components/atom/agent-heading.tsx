"use client";

// The heading above an agent prompt window — ported from the hogwarts sales
// block (src/components/atom/agent-heading.tsx). One difference: hogwarts hard-
// codes its English sentence, and kun ships Arabic first, so the copy arrives as
// props from the caller's dictionary and the trailing arrow is a glyph that
// mirrors under `dir="rtl"` instead of a literal "→".

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentHeadingProps {
  title: string;
  /** The sentence that precedes the scroll link, e.g. "Draft a post, or". */
  lead: string;
  /** id of the element the link scrolls to. */
  scrollTarget: string;
  /** The link's own words, e.g. "explore what's already published". */
  scrollText: string;
  className?: string;
}

export default function AgentHeading({
  title,
  lead,
  scrollTarget,
  scrollText,
  className,
}: AgentHeadingProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-lg font-light">
        {lead}{" "}
        <button
          type="button"
          onClick={() => {
            document
              .getElementById(scrollTarget)
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="text-primary inline items-center gap-1 hover:underline"
        >
          {scrollText}
          <ArrowRight className="ms-1 inline size-4 align-middle rtl:rotate-180" />
        </button>
      </p>
    </div>
  );
}
