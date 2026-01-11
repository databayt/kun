"use client"

import { ArrowRight, Server, Users, Terminal, Cloud, Shield, Container, CreditCard, Globe, LayoutPanelLeft, Layers } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

type Node = { id: string; label: string; icon?: ComponentType<SVGProps<SVGSVGElement>> }
type Edge = { from: string; to: string; note?: string }

export function FlowChart({
  nodes,
  edges,
  title = "Flow",
  large = false,
  showIcons = true,
}: {
  nodes: Node[]
  edges: Edge[]
  title?: string
  large?: boolean
  showIcons?: boolean
}) {
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]))
  return (
    <div className={`rounded-md border ${large ? "p-6" : "p-4"}`}>
      <div className={`mb-4 ${large ? "lead" : "muted"}`}>{title}</div>
      <div className={`flex flex-col ${large ? "gap-4" : "gap-3"}`}>
        {edges.map((e, i) => {
          const FromIcon = nodeById[e.from]?.icon ?? LayoutPanelLeft
          const ToIcon = nodeById[e.to]?.icon ?? Layers
          return (
            <div key={`${e.from}-${e.to}-${i}`} className="flex items-center gap-3">
              <div className={`flex items-center ${showIcons ? "gap-2" : "gap-1"} rounded-md border ${large ? "p-2" : "px-2 py-1"}`}>
                {showIcons ? <FromIcon className={`${large ? "h-6 w-6" : "h-4 w-4"}`} /> : null}
                <span>{nodeById[e.from]?.label ?? e.from}</span>
              </div>
              <ArrowRight className={`${large ? "h-6 w-6" : "h-4 w-4"} text-muted-foreground`} />
              {e.note && <span className={`${large ? "text-xs" : "text-[10px]"} text-muted-foreground`}>{e.note}</span>}
              <div className={`flex items-center ${showIcons ? "gap-2" : "gap-1"} rounded-md border ${large ? "p-2" : "px-2 py-1"}`}>
                {showIcons ? <ToIcon className={`${large ? "h-6 w-6" : "h-4 w-4"}`} /> : null}
                <span>{nodeById[e.to]?.label ?? e.to}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Kun-specific: Phase 1 Individual Setup Flow
export function Phase1Flow() {
  const nodes: Node[] = [
    { id: "install", label: "Install Tailscale", icon: Cloud },
    { id: "ssh", label: "Enable SSH", icon: Shield },
    { id: "tmux", label: "Start tmux", icon: Terminal },
    { id: "claude", label: "Run Claude Code", icon: Terminal },
    { id: "mobile", label: "Connect from Mobile", icon: Users },
  ]
  const edges: Edge[] = [
    { from: "install", to: "ssh", note: "tailscale up --ssh" },
    { from: "ssh", to: "tmux", note: "tmux new-session" },
    { from: "tmux", to: "claude", note: "claude" },
    { from: "mobile", to: "tmux", note: "Termius SSH" },
  ]
  return <FlowChart nodes={nodes} edges={edges} title="Phase 1: Individual Setup" large />
}

// Kun-specific: Phase 2 Team Server Flow
export function Phase2Flow() {
  const nodes: Node[] = [
    { id: "server", label: "Ubuntu Server", icon: Server },
    { id: "users", label: "Create Users", icon: Users },
    { id: "tailscale", label: "Tailscale ACLs", icon: Shield },
    { id: "config", label: "Shared Config", icon: Globe },
    { id: "systemd", label: "Systemd Services", icon: Terminal },
    { id: "monitor", label: "Netdata", icon: Layers },
  ]
  const edges: Edge[] = [
    { from: "server", to: "users", note: "Multi-user accounts" },
    { from: "users", to: "tailscale", note: "Access control" },
    { from: "tailscale", to: "config", note: "/etc/claude-code/" },
    { from: "config", to: "systemd", note: "Auto-start" },
    { from: "systemd", to: "monitor", note: "Health checks" },
  ]
  return <FlowChart nodes={nodes} edges={edges} title="Phase 2: Team Server" large />
}

// Kun-specific: Phase 3 Commercial Flow
export function Phase3Flow() {
  const nodes: Node[] = [
    { id: "docker", label: "Docker Isolation", icon: Container },
    { id: "meter", label: "Usage Metering", icon: Layers },
    { id: "billing", label: "Stripe Billing", icon: CreditCard },
    { id: "patterns", label: "Pattern Marketplace", icon: Globe },
  ]
  const edges: Edge[] = [
    { from: "docker", to: "meter", note: "Container per user" },
    { from: "meter", to: "billing", note: "Track resources" },
    { from: "billing", to: "patterns", note: "Sell patterns" },
  ]
  return <FlowChart nodes={nodes} edges={edges} title="Phase 3: Commercial Platform" large />
}

// Compact end-to-end flow
export function KunEndToEndFlow() {
  const nodes: Node[] = [
    { id: "dev", label: "Developer" },
    { id: "tailscale", label: "Tailscale VPN" },
    { id: "server", label: "Remote Server" },
    { id: "tmux", label: "tmux Session" },
    { id: "claude", label: "Claude Code" },
    { id: "code", label: "Generated Code" },
  ]
  const edges: Edge[] = [
    { from: "dev", to: "tailscale" },
    { from: "tailscale", to: "server" },
    { from: "server", to: "tmux" },
    { from: "tmux", to: "claude" },
    { from: "claude", to: "code" },
  ]
  return <FlowChart nodes={nodes} edges={edges} title="End-to-end Development Flow" large={false} showIcons={false} />
}
