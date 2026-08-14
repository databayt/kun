import Link from "next/link";
import {
  Terminal,
  ChevronRight,
  UserCheck,
  Code2,
  LineChart,
  Users2,
  ArrowUpRight,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/docs/copy-button";

// ─── Install Command ─────────────────────────────────────────────────────────

const INSTALL_CMD = "curl -fsSL https://kun.databayt.org/install | bash";

export function InstallCommand() {
  return (
    <div className="not-prose my-6">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            install · macOS · Linux
          </span>
        </div>
        <div className="relative bg-muted/20">
          <pre className="no-scrollbar overflow-x-auto px-4 py-4 text-sm">
            <code className="font-mono">
              <span className="select-none text-muted-foreground">$ </span>
              {INSTALL_CMD}
            </code>
          </pre>
          <CopyButton value={INSTALL_CMD} />
        </div>
      </div>
      <p className="mt-2.5 text-sm text-muted-foreground">
        One paste — the wizard scans your machine and installs only the delta.
        Windows and the full walkthrough live in{" "}
        <Link
          href="/docs/onboarding"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Onboarding
        </Link>
        .
      </p>
    </div>
  );
}

// ─── Feature Pipeline ────────────────────────────────────────────────────────

type Stage = { name: string; note: string };

const preGate: Stage[] = [
  { name: "IDEA", note: "Capture" },
  { name: "SPEC", note: "Define" },
];
const planning: Stage[] = [
  { name: "PLAN", note: "Strategy" },
  { name: "TASKS", note: "Breakdown" },
];
const postGate: Stage[] = [
  { name: "SCHEMA", note: "Data" },
  { name: "CODE", note: "Logic" },
  { name: "WIRE", note: "UI" },
  { name: "CHECK", note: "Gate" },
  { name: "SHIP", note: "Deploy" },
  { name: "WATCH", note: "Verify" },
];

function Pill({ stage, muted = false }: { stage: Stage; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-md border px-2.5 py-1.5 text-center",
        muted ? "border-dashed bg-muted/40" : "bg-background",
      )}
    >
      <code className="text-[13px] font-bold leading-none">{stage.name}</code>
      <span className="mt-1 text-[10px] leading-none text-muted-foreground">
        {stage.note}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 rtl:rotate-180" />
  );
}

export function FeaturePipeline() {
  return (
    <div className="not-prose my-6 rounded-lg border p-5">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Feature Pipeline · Code to Production
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {preGate.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <Pill stage={s} />
            <Arrow />
          </div>
        ))}

        {/* Human gate marker */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/25 bg-muted/60 px-2.5 py-1">
            <UserCheck className="size-3.5" />
            <span className="text-[11px] font-medium">human gate</span>
          </span>
          <Arrow />
        </div>

        {/* Grouped planning sub-phase */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-1.5">
          <Pill stage={planning[0]} muted />
          <Arrow />
          <Pill stage={planning[1]} muted />
        </div>

        {postGate.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <Arrow />
            <Pill stage={s} />
          </div>
        ))}
      </div>

      <p className="mt-4 text-[13px] text-muted-foreground">
        <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-bold">
          feature &lt;name&gt;
        </code>{" "}
        chains all ten stages; each is also an independent skill with its own
        exit gate. A human approves the <code className="font-bold">spec</code>{" "}
        before any code is generated.
      </p>
    </div>
  );
}

// ─── What You'll Find Here ────────────────────────────────────────────────────

type Ref = { title: string; href: string; blurb: string };
type Group = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  refs: Ref[];
};

const groups: Group[] = [
  {
    label: "For Developers",
    icon: Code2,
    refs: [
      {
        title: "Onboarding",
        href: "/docs/onboarding",
        blurb: "Fresh machine to working env in one paste",
      },
      {
        title: "Architecture",
        href: "/docs/architecture",
        blurb: "The layered engine design",
      },
      {
        title: "Configuration",
        href: "/docs/configuration",
        blurb: "The full engine blueprint",
      },
      {
        title: "Keywords",
        href: "/docs/keywords",
        blurb: "The prose vocabulary — no slash commands",
      },
      {
        title: "Claude Code",
        href: "/docs/claude-code",
        blurb: "The primary build lane",
      },
    ],
  },
  {
    label: "For Stakeholders",
    icon: LineChart,
    refs: [
      {
        title: "Captain",
        href: "/docs/captain",
        blurb: "The CEO brain — allocation & strategy",
      },
      {
        title: "Products",
        href: "/docs/products",
        blurb: "What we ship, and to whom",
      },
      {
        title: "PRD",
        href: "/docs/prd",
        blurb: "Requirements & configuration stories",
      },
      {
        title: "Epics",
        href: "/docs/epics",
        blurb: "Roadmap and sprint intent",
      },
      {
        title: "Aldar",
        href: "/docs/aldar",
        blurb: "A live 29-school prospect",
      },
    ],
  },
  {
    label: "For Community",
    icon: Users2,
    refs: [
      {
        title: "Repositories",
        href: "/docs/repositories",
        blurb: "The open-source org map",
      },
      {
        title: "Report an Issue",
        href: "/docs/issue",
        blurb: "How a bug becomes a fix",
      },
      {
        title: "Brand",
        href: "/docs/brand",
        blurb: "Identity, voice, and assets",
      },
      {
        title: "Share Economy",
        href: "/docs/share-economy",
        blurb: "Fair contribution valuation",
      },
      {
        title: "Tips",
        href: "/docs/tips",
        blurb: "Field notes from the engine",
      },
    ],
  },
];

const gettingStarted: Ref[] = [
  {
    title: "Run the one-liner",
    href: "/docs/onboarding",
    blurb: "Provision the full fleet",
  },
  {
    title: "Explore the Architecture",
    href: "/docs/architecture",
    blurb: "See how the layers connect",
  },
  {
    title: "Learn the Keywords",
    href: "/docs/keywords",
    blurb: "One word triggers a workflow",
  },
  {
    title: "Report an Issue",
    href: "/docs/issue",
    blurb: "Shape what ships next",
  },
];

export function FindHere() {
  return (
    <div className="not-prose my-6 space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <group.icon className="size-4 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {group.label}
              </span>
            </div>
            <ul className="space-y-1">
              {group.refs.map((ref) => (
                <li key={ref.href}>
                  <Link
                    href={ref.href}
                    className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
                  >
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">
                        {ref.title}
                      </span>
                      <span className="block text-[12px] leading-tight text-muted-foreground">
                        {ref.blurb}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Getting started strip */}
      <div className="rounded-lg border bg-muted/20 p-5">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          New here? Start with the essentials
        </div>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {gettingStarted.map((step, i) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className="group flex h-full flex-col gap-1 rounded-md border bg-background p-3 transition-colors hover:border-foreground/30"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium leading-tight">
                  {step.title}
                </span>
                <span className="text-[12px] leading-tight text-muted-foreground">
                  {step.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
