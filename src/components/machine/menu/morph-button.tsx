"use client";

import { cn } from "@/lib/utils";

/**
 * The only chrome: a fixed button at the top start corner. Its two lines (space's menu mark) meet in
 * the middle and rotate ±45° into an X when open, and back. 200ms ease-out; instant under
 * prefers-reduced-motion. It sits above the dialog, so it is also the close button.
 */
export function MorphButton({
  open,
  label,
  onClick,
  buttonRef,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
  buttonRef: React.Ref<HTMLButtonElement>;
}) {
  const line = (y: number, deg: number) => (
    <line
      x1={4}
      x2={20}
      y1={y}
      y2={y}
      className="transition-transform duration-200 ease-out motion-reduce:transition-none"
      style={{
        transformOrigin: "12px 12px",
        transform: open
          ? `rotate(${deg}deg) translateY(${12 - y}px)`
          : "rotate(0deg) translateY(0px)",
      }}
    />
  );
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn(
        "fixed start-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/5",
      )}
    >
      {/* Same mark as space: d="M4 8h16M4 16h16" — as two lines so each can move. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="size-6"
      >
        {line(8, 45)}
        {line(16, -45)}
      </svg>
    </button>
  );
}
