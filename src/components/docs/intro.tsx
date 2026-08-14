import Link from "next/link";
import { Terminal } from "lucide-react";
import { CopyButton } from "@/components/docs/copy-button";

// ─── Install Command ─────────────────────────────────────────────────────────

const INSTALL_CMD = "curl -fsSL https://kun.databayt.org/install | bash";

export function InstallCommand() {
  return (
    <div className="not-prose my-6">
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2">
          <Terminal className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
            install · macOS · Linux
          </span>
        </div>
        <div className="bg-muted/20 relative">
          <pre className="no-scrollbar overflow-x-auto px-4 py-4 text-sm">
            <code className="font-mono">
              <span className="text-muted-foreground select-none">$ </span>
              {INSTALL_CMD}
            </code>
          </pre>
          <CopyButton value={INSTALL_CMD} />
        </div>
      </div>
      <p className="text-muted-foreground mt-2.5 text-sm">
        One paste — the wizard scans your machine and installs only the delta.
        Windows and the full walkthrough live in{" "}
        <Link
          href="/docs/onboarding"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Onboarding
        </Link>
        .
      </p>
    </div>
  );
}

// ─── Pipelines ───────────────────────────────────────────────────────────────

type Stage = { name: string; description: string };

function StageGrid({ stages }: { stages: Stage[] }) {
  return (
    <div className="not-prose mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      {stages.map((stage, i) => (
        <div key={stage.name} className="rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 font-mono text-xs">
            {String(i + 1).padStart(2, "0")}
          </div>
          <h3 className="mb-1 text-base font-medium">{stage.name}</h3>
          <p className="text-muted-foreground text-sm">{stage.description}</p>
        </div>
      ))}
    </div>
  );
}

const featureStages: Stage[] = [
  { name: "Idea", description: "Capture the ask" },
  { name: "Spec", description: "Human gate" },
  { name: "Plan", description: "Strategy" },
  { name: "Tasks", description: "Break it down" },
  { name: "Schema", description: "Data layer" },
  { name: "Code", description: "Logic layer" },
  { name: "Wire", description: "UI layer" },
  { name: "Check", description: "Typecheck + build" },
  { name: "Ship", description: "Push to main" },
  { name: "Watch", description: "Verify live" },
];

export function FeaturePipeline() {
  return (
    <>
      <StageGrid stages={featureStages} />
      <p className="text-muted-foreground mt-4 text-sm">
        <code className="bg-muted rounded px-1.5 py-0.5 text-[13px] font-bold">
          feature &lt;name&gt;
        </code>{" "}
        chains all ten stages; each is also a skill on its own.
      </p>
    </>
  );
}

const socialStages: Stage[] = [
  { name: "Calendar", description: "Pick the slot" },
  { name: "Draft", description: "Arabic first" },
  { name: "Assets", description: "Render media" },
  { name: "Approve", description: "Human gate" },
  { name: "Publish", description: "Deliver" },
  { name: "Measure", description: "Read the numbers" },
];

export function SocialPipeline() {
  return (
    <>
      <StageGrid stages={socialStages} />
      <p className="text-muted-foreground mt-4 text-sm">
        <code className="bg-muted rounded px-1.5 py-0.5 text-[13px] font-bold">
          social &lt;topic&gt;
        </code>{" "}
        chains every stage; each is also a skill on its own.
      </p>
    </>
  );
}
