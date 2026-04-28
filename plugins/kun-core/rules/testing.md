---
paths:
  - "src/**/*.test.{ts,tsx}"
  - "src/**/*.spec.{ts,tsx}"
  - "tests/**"
  - "playwright.config.{ts,js}"
  - "vitest.config.{ts,js}"
description: Testing — Vitest unit, Playwright E2E, 95% coverage on tenant code
---

# Testing Rules

Active in test paths. Vitest 2 for unit/integration, Playwright for E2E.

## Test layout

Co-locate unit tests next to source: `student-form.tsx` → `student-form.test.tsx`. E2E in top-level `tests/e2e/`. Fixtures in `tests/fixtures/`.

## Unit tests — Vitest

```ts
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentForm } from "./student-form";

describe("StudentForm", () => {
  it("renders required fields", () => {
    render(<StudentForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("validates required fields on submit", async () => {
    const user = userEvent.setup();
    render(<StudentForm />);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });
});
```

Each test must read like a story: "it does X when Y". One assertion per logical concern. Use `userEvent` not `fireEvent`.

## Server actions

Hit a real database. Mocked DB tests pass while prod migrations break — already happened, don't repeat.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createStudent } from "./actions";

describe("createStudent", () => {
  beforeEach(async () => {
    await db.student.deleteMany({ where: { schoolId: "test-school" } });
  });

  it("creates with tenant scope", async () => {
    const student = await createStudent({ name: "Ali", schoolId: "test-school" });
    expect(student.schoolId).toBe("test-school");
  });

  it("rejects without auth", async () => {
    await expect(createStudent({ name: "x" }, /* no auth */))
      .rejects.toThrow(/unauthorized/i);
  });
});
```

## E2E — Playwright

Smoke flow per major feature. RTL + LTR both tested. Mobile + desktop viewports.

```ts
test("admission submits and redirects", async ({ page }) => {
  await page.goto("/ar/admission");
  await page.fill('[name="name"]', "أحمد");
  await page.click('button:has-text("إرسال")');
  await expect(page).toHaveURL(/\/ar\/admission\/success/);
});
```

Use `data-testid` only when role/text selectors don't work. Prefer accessibility selectors — they catch a11y regressions for free.

## Coverage targets

- Tenant-owned actions and queries: **95%+** (these handle paying customer data)
- UI components: **80%+**
- Utility libs: **100%** (small, pure)

CI gates: PR cannot merge if coverage drops on changed files.

## Never

- Mock the database in tests touching multi-tenant code
- Use `setTimeout` to wait — use `waitFor` / `toHaveText` / Playwright auto-wait
- Test implementation details (private function names) — test behavior
- Snapshot tests for DOM (they're brittle and rarely caught regressions)
- `it.skip` without an issue link

## Quick commands

```bash
pnpm test                    # vitest run
pnpm test -- --watch         # watch mode
pnpm test:e2e                # playwright
pnpm test:coverage           # coverage report
pnpm test path/to/spec.test.ts  # single file
```

## Reference

- Agent: `.claude/agents/test.md`
- Skill: `/test`
- Pattern card: `.claude/patterns/cards/form.md` (form testing example)
