"use client"

type Step = {
  title: string
  detail?: string
}

export function StepperFlow({
  steps,
  title = "Setup Flow",
  compact = true,
}: {
  steps: Step[]
  title?: string
  compact?: boolean
}) {
  const sizeClass = compact ? "text-sm" : "text-base"
  const circleSize = compact ? "h-6 w-6" : "h-8 w-8"
  return (
    <div className="rounded-md border p-6">
      <div className="mb-4 text-lg font-medium">{title}</div>
      <ol className="relative">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start">
            <div className="flex flex-col items-center mr-3">
              <div className={`flex items-center justify-center rounded-full border ${circleSize} font-medium`}>{i + 1}</div>
              {i < steps.length - 1 && (
                <div className="w-px grow bg-border my-1" />
              )}
            </div>
            <div className="pb-4">
              <div className={`font-medium ${sizeClass}`}>{s.title}</div>
              {s.detail && (
                <div className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>{s.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// Kun-specific: Phase 1 setup steps
export function Phase1SetupFlow() {
  const steps: Step[] = [
    { title: "Install Tailscale", detail: "curl -fsSL https://tailscale.com/install.sh | sh" },
    { title: "Enable SSH", detail: "sudo tailscale up --ssh" },
    { title: "Start tmux Session", detail: "tmux new-session -d -s claude" },
    { title: "Install Claude Code", detail: "npm install -g @anthropic-ai/claude-code" },
    { title: "Connect from Mobile", detail: "Use Termius with Tailscale IP" },
  ]
  return <StepperFlow steps={steps} title="Phase 1: Quick Start" />
}

// Kun-specific: Phase 2 setup steps
export function Phase2SetupFlow() {
  const steps: Step[] = [
    { title: "Provision Ubuntu Server", detail: "22.04 or 24.04 LTS" },
    { title: "Create User Accounts", detail: "useradd with proper groups" },
    { title: "Configure Tailscale ACLs", detail: "Access control per user" },
    { title: "Setup Shared Config", detail: "/etc/claude-code/CLAUDE.md" },
    { title: "Enable Systemd Services", detail: "Auto-start tmux sessions" },
    { title: "Install Netdata", detail: "Monitoring dashboard" },
  ]
  return <StepperFlow steps={steps} title="Phase 2: Team Server Setup" />
}
