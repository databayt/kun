# Registry, CLI, MCP, Skills, Directory — the deep spec

## CLI (`npx shadcn@latest <cmd>`)

| Command                              | Use                                        | Key flags                                                                                |
| ------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `init [components…]`                 | scaffold `components.json`, deps, CSS vars | `--template --base --defaults --force --css-variables --monorepo --rtl` (alias `create`) |
| `add [components…]`                  | install items (namespaced `@reg/name`)     | `--yes --overwrite --all --path --dry-run --diff`                                        |
| `view <items…>`                      | print item(s) from a registry              | namespaced: `view @acme/auth @v0/dashboard`                                              |
| `search` / `list <registries…>`      | search items in registries                 | `--query --limit --offset` (names need `@`)                                              |
| `build [registry]`                   | compile items → JSON                       | `--output <path>` (default `public/r`)                                                   |
| `info`                               | project config                             | `--json` (skills read this)                                                              |
| `docs [component]`                   | fetch docs / API                           | `--base --json`                                                                          |
| `migrate <rtl\|radix\|icons> [path]` | codemods                                   | glob paths                                                                               |
| `eject`                              | inline shadcn/tailwind utils, drop the dep | irreversible                                                                             |
| `mcp init --client claude`           | write the MCP block to `.mcp.json`         | —                                                                                        |

## components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "utils": "@/lib/utils",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {
    "@acme": "https://acme.com/r/{name}.json",
    "@internal": {
      "url": "https://internal.co/{name}.json",
      "headers": { "Authorization": "Bearer ${REGISTRY_TOKEN}" }
    }
  }
}
```

## registry-item.json

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "hello-world",
  "type": "registry:block",
  "title": "Hello World",
  "description": "A simple hello world component.",
  "dependencies": ["zod@3.23.8"],
  "registryDependencies": ["button", "@acme/utils"],
  "files": [
    {
      "path": "registry/new-york/hello/page.tsx",
      "type": "registry:page",
      "target": "app/hello/page.tsx"
    },
    {
      "path": "registry/new-york/hello/button.tsx",
      "type": "registry:ui",
      "target": "@ui/button.tsx"
    }
  ],
  "cssVars": {
    "theme": { "font-heading": "Poppins, sans-serif" },
    "light": { "brand": "oklch(0.6 0.2 25)" },
    "dark": { "brand": "oklch(0.7 0.18 25)" }
  },
  "css": { "@layer components": { ".card": { "padding": "1rem" } } },
  "docs": "Remember to set REGISTRY_TOKEN before installing."
}
```

- **Types**: `registry:ui | block | component | lib | hook | page | file | style | theme` — plus the org's `registry:atom` and `registry:template`.
- **`files[].target`**: where the file lands. Placeholders `@components/ @ui/ @lib/ @hooks/` resolve via `components.json` aliases; `~` is project root. **Required** for `registry:page` and `registry:file` (routes / config have no default home).
- **`registryDependencies`**: shadcn slugs (`button`, `card`) or namespaced (`@acme/utils`) — resolved recursively.
- **`cssVars` / `css`**: injected into the theme on install (OKLCH for us). `docs`: a CLI install message.

## registry.json (root)

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "acme",
  "homepage": "https://acme.com",
  "items": [
    /* registry-item objects */
  ]
}
```

Build with `shadcn build` → emits one JSON per item under `public/r/`, served at `{homepage}/r/{name}.json` and installable via `add @acme/{name}`.

## MCP tools (`mcp__shadcn__*`)

`search_items_in_registries` · `list_items_in_registries` · `view_items_in_registries` · `get_item_examples_from_registries` · `get_add_command_for_items` · `get_project_registries` · `get_audit_checklist`. They read the **current repo's** `components.json` `registries`, so namespaced installs work without extra config. Install the server with `npx shadcn@latest mcp init --client claude` (emits `{ "command": "npx", "args": ["shadcn@latest", "mcp"] }` — already registered in this engine).

## Skills (the official per-repo one)

`pnpm dlx skills add shadcn/ui` → installs into `.claude/skills/`. It activates when it finds a `components.json`, runs `shadcn info --json`, and injects project config so the assistant uses the right style / aliases / registries. Use it per-repo; this user-level pack is the umbrella that's always on.

## Directory

`https://ui.shadcn.com/docs/directory` lists community registries built into the CLI — address them by `@namespace` with no extra config for public ones. Add your own (or private) by putting them in `components.json` → `registries` (with `headers` for auth). Always review third-party code on install.
