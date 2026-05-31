# Header Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| codebase | composable (10 sub-components) | production | 10 | **yes** |
| hogwarts | domain-prefixed (4 variants) | production | 12 | no |
| shifa | multi-variant (3 versions) | development | 6 | no |
| mkan | domain-specific (airbnb-style) | development | 3 | no |
| souq | single-file JS | development | 1 | no |

## Canonical: codebase

### File Structure

```
src/components/template/header-01/
  page.tsx              # Main header component
  main-nav.tsx          # Primary navigation links
  mobile-nav.tsx        # Responsive mobile menu
  command-menu.tsx      # Cmd+K search palette
  lang-switcher.tsx     # AR/EN language toggle
  mode-switcher.tsx     # Light/dark theme toggle
  config.ts             # Navigation items config
  content.tsx           # Server component wrapper
  icons.tsx             # Header icon registry
  types.ts              # Header type definitions
```

### Architecture

The header is composed of independent sub-components, each handling one concern:
- **main-nav** — Desktop navigation links
- **mobile-nav** — Hamburger menu with slide-out sheet
- **command-menu** — Cmd+K searchable command palette
- **lang-switcher** — Language toggle with cookie persistence
- **mode-switcher** — Dark/light/system theme toggle

This composability allows product repos to pick the sub-components they need.

### Hogwarts Domain Variants

Hogwarts uses 4 header variants for different contexts:
- `platform-header` — Dashboard header with user menu + notifications
- `marketing-header` — Public site header with CTA
- `saas-header` — SaaS admin header
- `notion-header` — Content-focused minimal header

Each is a customized composition of the base sub-components.

### Usage

1. Clone header-01 from codebase
2. Customize config.ts with your navigation items
3. Pick sub-components needed (drop command-menu if not needed, etc.)
4. Rename to domain-prefix (e.g., platform-header)

## Clone

```
/clone pattern:header
/clone codebase:src/components/template/header-01/
/clone codebase:src/registry/default/templates/header-01  # registry version
/clone codebase:src/registry/default/templates/header-02  # dropdown variant
```
