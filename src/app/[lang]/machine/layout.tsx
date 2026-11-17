// The machine app has no top bar: each page draws its own (the chat's slim bar, or ‹ back + title).
export default function MachineLayout({ children }: { children: React.ReactNode }) {
  return <main className="h-dvh overflow-hidden bg-background">{children}</main>
}
