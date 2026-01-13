"use client"

import Link from "next/link"
import { ReactNode } from "react"
import {
  NextJS,
  ReactIcon,
  TypeScript,
  TailwindCSS,
  ShadcnUI,
  PrismaIcon,
  Vercel,
  Claude,
  ZodIcon,
  Figma,
  NodeJS,
  PlanetScale,
} from "@/components/icons"

interface StackItem {
  id: string
  title: string
  description: string
  icon: ReactNode
  href: string
}

const stackItems: StackItem[] = [
  {
    id: "nextjs",
    title: "Next.js 16",
    description: "React meta-framework with App Router",
    icon: <NextJS className="h-8 w-8" />,
    href: "https://nextjs.org",
  },
  {
    id: "react",
    title: "React 19",
    description: "Component-based UI library",
    icon: <ReactIcon className="h-8 w-8" />,
    href: "https://react.dev",
  },
  {
    id: "typescript",
    title: "TypeScript",
    description: "Strongly-typed JavaScript",
    icon: <TypeScript className="h-8 w-8" />,
    href: "https://typescriptlang.org",
  },
  {
    id: "tailwind",
    title: "Tailwind CSS",
    description: "Utility-first CSS framework",
    icon: <TailwindCSS className="h-8 w-8" />,
    href: "https://tailwindcss.com",
  },
  {
    id: "shadcn",
    title: "shadcn/ui",
    description: "Accessible React components",
    icon: <ShadcnUI className="h-8 w-8" />,
    href: "https://ui.shadcn.com",
  },
  {
    id: "prisma",
    title: "Prisma",
    description: "Next-generation ORM",
    icon: <PrismaIcon className="h-8 w-8" />,
    href: "https://prisma.io",
  },
  {
    id: "vercel",
    title: "Vercel",
    description: "Frontend cloud platform",
    icon: <Vercel className="h-8 w-8" />,
    href: "https://vercel.com",
  },
  {
    id: "claude",
    title: "Claude",
    description: "AI-assisted development",
    icon: <Claude className="h-8 w-8" />,
    href: "https://claude.ai",
  },
  {
    id: "zod",
    title: "Zod",
    description: "TypeScript-first validation",
    icon: <ZodIcon className="h-8 w-8" />,
    href: "https://zod.dev",
  },
  {
    id: "planetscale",
    title: "PlanetScale",
    description: "Serverless MySQL platform",
    icon: <PlanetScale className="h-8 w-8" />,
    href: "https://planetscale.com",
  },
  {
    id: "nodejs",
    title: "Node.js",
    description: "JavaScript runtime",
    icon: <NodeJS className="h-8 w-8" />,
    href: "https://nodejs.org",
  },
  {
    id: "figma",
    title: "Figma",
    description: "Collaborative design platform",
    icon: <Figma className="h-8 w-8" />,
    href: "https://figma.com",
  },
]

function StackCard({ item }: { item: StackItem }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="relative overflow-hidden rounded-lg border bg-background p-2 transition-[border-color] hover:border-primary"
    >
      <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
        <div className="h-8 w-8">{item.icon}</div>
        <div className="space-y-2">
          <h4 className="font-medium">{item.title}</h4>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </a>
  )
}

export function StackCards() {
  return (
    <section className="py-16">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {stackItems.map((item) => (
          <StackCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}
