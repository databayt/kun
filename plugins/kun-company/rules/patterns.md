# Pattern Registry Lookup

When you encounter a Tier 3 vocabulary keyword that has a pattern card, load the card for context.

## Pattern Keywords

These keywords have canonical patterns documented in `.claude/patterns/cards/`:

`form`, `table`, `modal`, `auth`, `validation`, `action`, `columns`, `wizard`, `sidebar`, `header`

## Behavior

When building a new feature that involves one of these keywords:

1. Read `.claude/patterns/cards/{keyword}.md` for the canonical pattern
2. Read `.claude/patterns/registry.json` to check the current repo's adoption status
3. Follow the canonical pattern, adapting for the current product's stack
4. Use the canonical file structure and naming conventions
5. Reference the clone command if the pattern needs to be installed

## Examples

- User says "add a students table" → read `table.md`, follow the triplet pattern (content.tsx + table.tsx + columns.tsx)
- User says "create a form for invoices" → read `form.md`, use InputField/SelectField atoms with useActionStateBridge
- User says "add auth" → read `auth.md`, follow the five-step flow structure
- User says "multi-step wizard for onboarding" → read `wizard.md`, use createWizardProvider factory
