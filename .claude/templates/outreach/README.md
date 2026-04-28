# Outreach Templates

> Story 18.4 in `docs/EPICS-V4.md`. Used by `/proposal` skill (revenue agent) and `/dispatch --channel cowork`.

## Inventory

| Stage | Arabic | English |
|-------|--------|---------|
| `cold` | `cold.ar.md` | `cold.en.md` |
| `warm` | `warm.ar.md` | `warm.en.md` |
| `proposal` | `proposal.ar.md` | `proposal.en.md` |
| `reminder` | `reminder.ar.md` | `reminder.en.md` |

## Variable resolution

Each template's frontmatter declares the variables it expects. The `/proposal` skill resolves them in this order:

1. Explicit args passed to the skill
2. Lookup in `.claude/memory/revenue.json` (for client name + tier + last action)
3. Lookup in `.claude/memory/pilot-king-fahad.json` (for active pilot context)
4. Prompt user for any remaining

## Usage

```
/proposal client=king-fahad stage=warm lang=ar
```

`/proposal` reads `.claude/memory/revenue.json` for the client entry, picks `templates/outreach/warm.ar.md`, fills variables, and outputs the rendered Markdown to stdout (and optionally saves to `.claude/proposals/<client>-<date>.md`).

## Conventions

- **Arabic-first**: For Saudi clients (default), use `.ar.md`. English version is fallback.
- **Tone**: Respectful, businesslike, no marketing fluff. Same pitch for everyone.
- **No pressure**: The reminder template explicitly invites the recipient to push back without consequence — fits databayt's open-source/sharing-economy positioning.
- **Variables in `{dotted.path}` format**: Match the structure of `revenue.json` so substitution is mechanical.

## Editing

When a template changes, also update:
- `.claude/agents/revenue.md` if the change affects pricing logic
- `.claude/agents/captain.md` inter-agent contract if the variable list changes
- This README if a new stage is added

## Future stages (not yet templated)

- `contract` — final contract terms language (legal review needed before adding)
- `onboarding` — first-week tenant setup walkthrough
- `renewal` — month-11 renewal pitch
- `lost` — graceful close-out for declined proposals
