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
    <div className="not-prose mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      {stages.map((stage, i) => (
        <div key={stage.name} className="rounded-lg border p-6">
          <h3 className="mb-2 text-base font-medium">
            <span className="text-muted-foreground me-2 font-mono text-xs">
              {String(i + 1).padStart(2, "0")}
            </span>
            {stage.name}
          </h3>
          <p className="text-muted-foreground text-sm">{stage.description}</p>
        </div>
      ))}
    </div>
  );
}

const featureStages: Stage[] = [
  {
    name: "Idea",
    description:
      "Capture the feature as a structured, deduplicated issue with a user story and acceptance criteria.",
  },
  {
    name: "Spec",
    description:
      "Detail the requirement and settle scope. This is the human gate — nothing is generated until it is approved.",
  },
  {
    name: "Plan",
    description:
      "Turn the approved spec into an implementation strategy and the architectural calls it depends on.",
  },
  {
    name: "Tasks",
    description:
      "Break the plan into atomic, ordered units of work, each small enough to verify on its own.",
  },
  {
    name: "Schema",
    description:
      "The data layer: Prisma models, migrations, and tenant scoping for every new table.",
  },
  {
    name: "Code",
    description:
      "The logic layer: server actions carrying auth, validation, and tenant isolation.",
  },
  {
    name: "Wire",
    description:
      "The UI layer: components composed from the registry and wired to the server actions.",
  },
  {
    name: "Check",
    description:
      "The quality gate: typecheck, production build, and visual verification, with auto-fix loops.",
  },
  {
    name: "Ship",
    description:
      "Conventional commit, push straight to main, and deploy to production.",
  },
  {
    name: "Watch",
    description:
      "Post-deploy verification: screenshot the live page, scan the console, run a smoke interaction.",
  },
];

export function FeaturePipeline() {
  return (
    <>
      <StageGrid stages={featureStages} />
      <p className="text-muted-foreground mt-4 text-sm">
        <code className="bg-muted rounded px-1.5 py-0.5 text-[13px] font-bold">
          feature &lt;name&gt;
        </code>{" "}
        chains all ten stages; each is also an independent skill with its own
        exit gate.
      </p>
    </>
  );
}

const socialStages: Stage[] = [
  {
    name: "Calendar",
    description:
      "Decide which brand publishes what, and on which day, before a word is written.",
  },
  {
    name: "Draft",
    description:
      "Write the copy — Arabic crafted first, English mirrored — with UTM on every link.",
  },
  {
    name: "Assets",
    description:
      "Render the media: generated imagery, recorded product flows, and bilingual slide decks.",
  },
  {
    name: "Approve",
    description:
      "The human gate. A contributor signs off in the review queue at /social/publish.",
  },
  {
    name: "Publish",
    description:
      "Deliver the approved draft to every channel, now or on the scheduled drain.",
  },
  {
    name: "Measure",
    description:
      "Read the numbers back: reach, engagement, and UTM-attributed traffic per brand.",
  },
];

export function SocialPipeline() {
  return (
    <>
      <StageGrid stages={socialStages} />
      <p className="text-muted-foreground mt-4 text-sm">
        <code className="bg-muted rounded px-1.5 py-0.5 text-[13px] font-bold">
          social &lt;topic&gt;
        </code>{" "}
        chains every stage; assets come from{" "}
        <code className="font-bold">record</code>,{" "}
        <code className="font-bold">higgs</code>, and{" "}
        <code className="font-bold">carousel</code>.
      </p>
    </>
  );
}
