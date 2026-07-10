---
name: spec
description: Technical spec — data model, file plan, refined acceptance criteria
when_to_use: "Use when a captured feature idea (GitHub issue) needs to become a technical specification — Prisma data model sketch, file plan, refined acceptance criteria, and dependencies — published as an issue comment and paused for the single human approval gate of the pipeline; this is the Specify stage between /idea and /plan or /schema, not architecture planning (/plan) or task breakdown (/tasks). Triggers on: spec the <feature>, write the spec, technical specification, pipeline Specify stage (human approval gate)."
argument-hint: <feature>|#N [product]
---

# Spec — Technical Specification

Turn a feature idea into a technical spec: data model, file plan, and refined acceptance criteria. The planning stage that bridges idea to implementation.

## Usage

- `/spec #42` — spec from issue number
- `/spec billing` — spec from feature name (finds the issue)
- `/spec billing hogwarts` — product-scoped

## Argument: $ARGUMENTS

## Instructions

### 1. READ — Load the issue

If argument is `#N`:

```bash
gh issue view <N> --repo <repo>
```

If argument is a feature name:

```bash
gh issue list --repo <repo> --search "<name> type:feature" --state open --limit 1
```

Then view the first match.

Extract: title, user story, acceptance criteria, scope.

### 2. SURVEY — Understand the existing codebase

Read the target product's current state:

**Schema:**

```bash
# Read existing Prisma models to understand the data landscape
cat prisma/schema.prisma   # or ls prisma/models/
```

Look for:

- Related models this feature connects to
- Existing patterns (how other features define relations, enums, indexes)
- Tenant isolation pattern (schoolId, vendorId, etc.)

**Routes:**

```bash
# Understand existing page structure
ls -la src/app/[lang]/
```

Look for:

- Where this feature fits in the navigation hierarchy
- Route group patterns (e.g., `(school-dashboard)`, `(saas-dashboard)`)
- Existing layouts this feature will inherit

**Components:**

```bash
# See existing feature component directories
ls src/components/
```

Look for:

- Similar features to reference (e.g., if building "invoices", look at "payments")
- Shared components that can be reused
- The file convention used: content.tsx, actions.ts, form.tsx, columns.tsx, validation.ts

**Product context:**

- Read the product's CLAUDE.md for domain constraints
- Read the product's README.md for architecture overview

### 3. DESIGN — Generate the spec

Based on the issue + codebase survey, generate:

**A. Data Model**

```prisma
// Sketch — not final, will be refined in schema stage
model FeatureName {
  id        String   @id @default(cuid())
  // ... fields based on acceptance criteria
  // ... relations to existing models
  // ... tenant isolation field
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**B. File Plan**

```
Files to create:
  src/components/{scope}/{name}/content.tsx    — server component, data fetching
  src/components/{scope}/{name}/actions.ts     — server actions (CRUD)
  src/components/{scope}/{name}/form.tsx       — client form component
  src/components/{scope}/{name}/columns.tsx    — table column definitions (if list view)
  src/components/{scope}/{name}/validation.ts  — Zod schemas
  src/app/[lang]/{route}/{name}/page.tsx       — page (mirror pattern)

Files to modify:
  prisma/schema.prisma (or prisma/models/)     — add model
  src/dictionaries/en.json                     — add i18n keys
  src/dictionaries/ar.json                     — add i18n keys
  [navigation config if applicable]
```

**C. Refined Acceptance Criteria**
Refine the original criteria with technical specifics:

- Which fields are required vs optional
- Which actions need auth guards
- Which views are needed (list, detail, create, edit)
- RTL/LTR considerations

**D. Dependencies**

- External packages needed (if any)
- MCP tools needed during implementation (shadcn, neon, etc.)
- Existing components to reuse

### 4. CLARIFY — Interrogate the draft before the gate

The human gate is the most expensive checkpoint in the pipeline — a rubber-stamped ambiguous spec wastes every stage after it. Before publishing, scan the draft against this coverage taxonomy and mark each category **Clear / Partial / Missing**:

- **Scope** — what's explicitly out of scope? MVP vs later?
- **Data** — cardinality, uniqueness, soft-delete vs hard-delete, migrations of existing rows
- **Auth + tenancy** — which roles can do what; tenant scoping on every query
- **Edge + error states** — empty lists, conflicts, failures mid-flow
- **RTL/i18n** — Arabic-first surfaces, direction-sensitive layout
- **Non-functional** — volume, speed, offline, exports

For the **Partial/Missing** categories, ask Abdout **at most 3 high-impact questions** (multiple-choice where possible, via AskUserQuestion). Skip the step entirely if everything is Clear — don't manufacture questions. Encode the answers into the spec under `### Clarifications`.

### 5. PUBLISH — Append spec to issue

```bash
gh issue comment <number> --repo <repo> --body "<spec>"
```

Format the comment with a clear header:

```markdown
## Technical Spec

### Data Model

<prisma sketch>

### File Plan

<file list>

### Acceptance Criteria (Refined)

<criteria>

### Clarifications

<Q → chosen answer, one line each — or "none needed">

### Dependencies

<list>

---

_Generated by spec pipeline. Ready for implementation._
```

### 6. PAUSE — Human checkpoint

Ask: **"Spec published to issue #N. Review and approve to continue implementation. Proceed? (Y/n)"**

This is the ONE human checkpoint in the entire pipeline. Everything after this is automated.

If the human has feedback, update the spec comment and re-ask.

## Exit Gate

Spec comment exists on the issue with: data model sketch, file plan, refined acceptance criteria, clarifications encoded. Human has approved.
