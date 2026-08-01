# shadcn docs — the docs-block pattern

`shadcn docs` means: reproduce shadcn/ui's documentation block — its MDX anatomy, its
CLI/Manual install tabs, its live previews — using the org's worked example in
`/Users/abdout/codebase` as the template. This is _style + structure_, not a component install.

## MDX anatomy (in order)

````mdx
---
title: Button
description: Displays a button or a component that looks like a button.
---

<ComponentPreview name="button-demo" />

## Installation

<Tabs defaultValue="cli">
  <TabsList>
    <TabsTrigger value="cli">CLI</TabsTrigger>
    <TabsTrigger value="manual">Manual</TabsTrigger>
  </TabsList>
  <TabsContent value="cli">

```bash
npx shadcn@latest add button
```

  </TabsContent>
  <TabsContent value="manual">

<Steps>
  <Step>Install the following dependencies:</Step>

```bash
npm install @radix-ui/react-slot
```

  <Step>Copy and paste the following code into your project.</Step>
  <ComponentSource name="button" />
</Steps>

  </TabsContent>
</Tabs>

## Usage

```tsx
import { Button } from "@/components/ui/button";
```

```tsx
<Button variant="outline">Button</Button>
```

## Examples

<ComponentPreview name="button-secondary" />

## API Reference

<!-- props table per component / sub-component -->
````

## The pieces

| Piece                               | Role                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| frontmatter `title` + `description` | page head + sidebar label                                    |
| `<ComponentPreview name="…" />`     | live render + code toggle, sourced from the registry         |
| `## Installation` `<Tabs>`          | CLI command vs Manual `<Steps>` (deps + `<ComponentSource>`) |
| `## Usage`                          | import line + minimal JSX                                    |
| `## Examples`                       | one `<ComponentPreview>` per variant                         |
| `## API Reference`                  | props tables                                                 |

## Routing & build (fumadocs)

- Catch-all route: `app/[lang]/(root)/docs/[[...slug]]/page.tsx` (and `/atoms/[[...slug]]` for atoms).
- Source: `content/docs/**.mdx`, `content/atoms/(root)/*.mdx`.
- `meta.json` per folder controls sidebar order / grouping.
- Shared MDX components in `mdx-components.tsx`: `ComponentPreview`, `ComponentSource`, `Steps`/`Step`, `Tabs`.

## Where to look

- **Upstream**: `shadcn-ui/ui` → `apps/v4/content/docs/**` (MDX) + `apps/v4/registry/new-york-v4/**` (the previewed source) + `apps/v4/components` (MDX components).
- **Org worked example**: `/Users/abdout/codebase` → `content/docs/`, `content/atoms/(root)/*.mdx`, `docs-factory.md`, `atoms-factory.md`; generator `scripts/generate-atom-docs.mts`; sidebar via `src/components/docs/`.

## When writing a docs page

1. Mirror the anatomy above — same heading order, same tab structure.
2. Reference an existing registry item for `<ComponentPreview>` / `<ComponentSource>` (don't inline large code).
3. Add the page to `meta.json`.
4. Keep prose terse — shadcn docs are reference, not tutorial.
5. Bilingual repos: the route is under `[lang]`; keep copy translatable and layout RTL-safe (logical properties).
