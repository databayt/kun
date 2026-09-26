# Registry, CLI, MCP, Skills, Directory — the deep spec

> Verified 2026-09-26 against shadcn CLI 4.21.0 (ui.shadcn.com/docs/cli, /docs/registry/github, /docs/changelog).

## CLI (`npx shadcn@latest <cmd>`)

| Command                                              | Use                                                    | Key flags                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init [components…]`                                 | scaffold `components.json`, deps, CSS vars             | `--template --base <base\|radix\|aria> --preset --defaults --force --css-variables --monorepo --rtl --pointer` (alias `create`; `--defaults` = `--template=next --preset=nova`) — databayt: always `-b radix --rtl` |
| `add [components…]`                                  | install items (`@reg/name` or `owner/repo/item[#ref]`) | `--yes --overwrite --all --path --dry-run --diff --view`                                                                                                                                                            |
| `view <items…>`                                      | print item(s) from a registry                          | `view @acme/auth @v0/dashboard` · `view owner/repo/item`                                                                                                                                                            |
| `search` / `list <registries…>`                      | search items in registries                             | `--query --limit --offset` (`@name` or `owner/repo`)                                                                                                                                                                |
| `apply <preset>`                                     | apply a preset to an existing project                  | `--only theme\|font` (skip reinstalling components)                                                                                                                                                                 |
| `preset decode\|resolve\|url\|open`                  | inspect preset codes (`preset info` = `resolve`)       | `--json` — never decode preset codes by hand                                                                                                                                                                        |
| `build [registry]`                                   | compile items → JSON                                   | `--output <path>` (default `public/r`)                                                                                                                                                                              |
| `registry validate <owner/repo[#ref]>`               | validate a GitHub registry                             | checks root `registry.json`, `include`s, referenced files                                                                                                                                                           |
| `info`                                               | project config                                         | `--json` (skills read this)                                                                                                                                                                                         |
| `docs [component]`                                   | fetch docs / API                                       | `--base --json`                                                                                                                                                                                                     |
| `migrate <rtl\|radix\|icons\|cn\|base-color> [path]` | codemods                                               | glob paths · `--from --to --yes` (icons, base-color: `neutral\|zinc\|stone\|mauve\|olive\|mist\|taupe`)                                                                                                             |
| `eject`                                              | inline shadcn/tailwind utils, drop the dep             | irreversible                                                                                                                                                                                                        |
| `mcp init --client claude`                           | write the MCP block to `.mcp.json`                     | —                                                                                                                                                                                                                   |

- **After `migrate rtl`**: strip every `rtl:space-x-reverse` / `rtl:divide-x-reverse` it inserts — Tailwind v4 `space-x-*`/`divide-x-*` are already logical, so the reverse flips them twice (kun rule `tailwind-v4/no-rtl-space-reverse`). Its `left-/right-→start-/end-` output is fine on the vendored `ui/` layer.
- **`migrate cn`** (4.20) swaps `clsx` + `tailwind-merge` for the `cn` package, which registry items import from `"cn"` since 4.21 — upstream state only; adoption is a pending decision (kun keeps `cn` in `@/lib/utils`).

## components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "rtl": true,
  "tailwind": {
    "config": "",
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
      "headers": { "Authorization": "Bearer ${REGISTRY_TOKEN}" },
      "params": { "version": "latest" }
    }
  }
}
```

- **`rtl`** — databayt: always `true`; `add` then rewrites physical classes to logical ones and flips directional icons (`rtl:rotate-180`). **`tailwind.config`** — leave blank on Tailwind v4.
- **`menuColor`** (`default | inverted | default-translucent | inverted-translucent`) and **`menuAccent`** (`subtle | bold`) — optional menu styling keys (schema, 2026).
- **`registries`** — `${VAR}` expands from the environment; `params` become query params. Since 4.18 registries can also live in `package.json` under a top-level `"registries"` key: merged with `components.json` (built-in → package.json → components.json, most specific wins) and resolved in memory by `add`/`search`/`view`/`init`.
- **Env & secrets** — the CLI loads `.env.local`, `.env.development.local`, `.env.development` and `.env` without overriding variables already set, so `${REGISTRY_TOKEN}` resolves from the central `.env` (ignore the docs' `.env.local` advice). Items that declare `envVars` append to the first existing env file (`.env.local` → `.env` → …) and **create `.env.local` when none exists**. Databayt keeps secrets in the central `.env` only — never `.env.local`: make sure `.env` exists before `add`, and move anything the CLI writes elsewhere back into it.

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

- **Types**: `registry:ui | block | component | lib | hook | page | file | style | theme | base | font | item` — plus the org's `registry:atom` and `registry:template`.
  - `registry:base` — a whole design system; its `config` field (unique to this type) sets `style`, `iconLibrary`, `rsc`, `tsx`, `rtl`, `menuColor`, `menuAccent`, `tailwind.*`, `aliases.*`, `registries`. Since Base UI became the default (Jul 2026), registries that ship no `registry:base` "now init as Base UI" — pin the lane with one.
  - `registry:font` — a font; requires the `font` property (family, provider, import name, CSS variable, npm package).
  - `registry:item` — a universal item: any files (configs, docs, rules, `AGENTS.md`, `.claude/*`, `.mcp.json`, CI), the GitHub-registry workhorse.
- **`files[].target`**: where the file lands. Placeholders `@components/ @ui/ @lib/ @hooks/` resolve via `components.json` aliases; `~` is project root. **Required** for `registry:page` and `registry:file` (routes / config have no default home).
- **`registryDependencies`**: shadcn slugs (`button`, `card`) or namespaced (`@acme/utils`) — resolved recursively.
- **`cssVars` / `css`**: injected into the theme on install (OKLCH for us). `docs`: a CLI install message.

## registry.json (root)

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "acme",
  "homepage": "https://acme.com",
  "items": [/* registry-item objects */]
}
```

Build with `shadcn build` → emits one JSON per item under `public/r/`, served at `{homepage}/r/{name}.json` and installable via `add @acme/{name}`.

## GitHub registries (June 2026; private repos since CLI 4.19)

Any github.com repo with a root `registry.json` is a **source registry** — no `shadcn build`, no hosting, no generated JSON. Items can distribute any files, usually as `registry:item` with `registry:file` targets under `~/`.

| Task     | Command                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------- |
| install  | `add owner/repo/item` — pin with `#<branch\|tag\|sha>`; segments after `owner/repo` are the item name |
| browse   | `list owner/repo` · `search owner/repo -q <term>` · `view owner/repo/item`                            |
| validate | `registry validate owner/repo[#ref]` — root `registry.json`, `include`s, referenced files             |

- `"include": ["rules/registry.json", …]` splits a large catalog; file paths resolve relative to the `registry.json` that declares the item.
- `registryDependencies` take full addresses (`owner/repo/item#ref`, `@ns/item`); refs are **not** inherited by dependencies.
- **Private repos**: the CLI tries anonymous access first, then your `gh auth login` credentials (the token stays inside `gh`), or `GH_TOKEN` / `GITHUB_TOKEN` in CI — a fine-grained PAT with Contents: Read-only, sent only to `api.github.com`. GitHub Enterprise hosts are not supported (use a namespaced registry + auth instead).

## MCP tools (`mcp__shadcn__*`)

`search_items_in_registries` · `list_items_in_registries` · `view_items_in_registries` · `get_item_examples_from_registries` · `get_add_command_for_items` · `get_project_registries` · `get_audit_checklist`. They read the **current repo's** `components.json` `registries` (plus `package.json` `registries` since 4.18), so namespaced installs work without extra config. Install the server with `npx shadcn@latest mcp init --client claude` (emits `{ "command": "npx", "args": ["shadcn@latest", "mcp"] }` — already registered in this engine).

## Skills (the official per-repo one)

`pnpm dlx skills add shadcn/ui` → installs into `.claude/skills/`. It activates when it finds a `components.json`, runs `shadcn info --json`, and injects project config so the assistant uses the right style / aliases / registries. Use it per-repo; this user-level pack is the umbrella that's always on.

## Directory

`https://ui.shadcn.com/docs/directory` lists community registries built into the CLI — address them by `@namespace` with no extra config for public ones. Add your own (or private) by putting them in `components.json` → `registries` (with `headers` for auth). Always review third-party code on install.
