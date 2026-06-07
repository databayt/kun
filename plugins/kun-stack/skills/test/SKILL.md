---
name: Test
description: Generate and run tests - unit, component, or E2E
argument-hint: "<file|e2e|coverage>"
allowed-tools: Bash(pnpm *), Bash(npx *)
model: claude-opus-4-7
---

# Test Generator

Generate comprehensive tests for code.

## Usage

- `/test src/lib/utils.ts` - Unit tests
- `/test src/components/Button` - Component tests
- `/test e2e login` - E2E flow
- `/test coverage` - Run coverage report

## Argument: $ARGUMENTS

## Test Types

### Unit Tests (Vitest)

```tsx
describe("functionName", () => {
  it("should handle normal case", () => {});
  it("should handle edge case", () => {});
  it("should throw on invalid input", () => {});
});
```

### Component Tests

```tsx
import { render, screen } from "@testing-library/react";

describe("Component", () => {
  it("renders correctly", () => {});
  it("handles user interaction", () => {});
});
```

### E2E Tests (Playwright 1.60)

Canonical config: `.claude/patterns/cards/e2e.md` (`/clone pattern:e2e`) — setup-project auth (storageState), desktop + mobile + Arabic-RTL projects, sharded CI.

```tsx
import { test, expect } from "@playwright/test";

// Authenticated via the setup project's storageState — no per-test login.
test("creates a student", async ({ page }) => {
  await page.goto("/dashboard/students");
  await page.getByRole("button", { name: /add student/i }).click();
  await page.getByLabel(/first name/i).fill("Ada");
  await page.getByRole("button", { name: /create/i }).click();
  await expect(page.getByTestId("toast")).toContainText(/created/i);
});
```

## Coverage Target: 95%+
