# E2E Pattern (Playwright)

The canonical end-to-end testing config databayt products clone. Targets `@playwright/test@1.60` — the setup-project auth pattern, multi-browser + mobile + Arabic-RTL projects, deterministic artifacts, and sharded CI with blob-report merge.

## Status

| Repo            | E2E state                                                                                                 | Maturity  | Canonical |
| --------------- | --------------------------------------------------------------------------------------------------------- | --------- | --------- |
| **(blueprint)** | setup-project auth (storageState), 6 projects (3 desktop + 2 mobile + Arabic RTL), sharded CI, blob merge | canonical | **yes**   |
| hogwarts        | to adopt — not yet verified                                                                               | —         | no        |
| souq            | to adopt — not yet verified                                                                               | —         | no        |
| mkan            | to adopt — not yet verified                                                                               | —         | no        |
| shifa           | to adopt — not yet verified                                                                               | —         | no        |

> This card is the source of truth; products adopt it via `/clone pattern:e2e`. Update each repo's row as it adopts (record the real project list + maturity), don't fabricate counts.

## Canonical: the blueprint

### Why these choices

- **Setup-project auth** — log in once, persist `storageState`, and every browser project reuses it via `dependencies: ['setup']`. No per-test login, no flaky auth.
- **Determinism** — `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` keep artifacts cheap but present when they matter. Pinned `locale`/`timezoneId` make date-bearing assertions stable.
- **RTL is a first-class project** — Arabic ships RTL-default; the `Arabic RTL` project runs `@rtl`-tagged specs under `ar-AE` so layout mirroring is tested, not assumed. Other projects `grepInvert` those specs.
- **Reporters fit the audience** — `html` for humans, `blob` to merge sharded CI runs, `junit` for CI dashboards, `github` for inline PR annotations.
- **Sharding** — CI splits the suite across N runners with `--shard`, then merges the blob reports into one HTML report.

### File Structure

```
playwright.config.ts        # root config (below)
e2e/
  auth.setup.ts             # logs in once → playwright/.auth/user.json
  students.spec.ts          # example flow (web-first assertions, getByTestId)
  students.ar.spec.ts       # @rtl-tagged — runs under the Arabic RTL project
playwright/
  .auth/user.json           # generated storageState (gitignored — never commit)
.github/workflows/e2e.yml   # sharded CI + blob merge
```

### `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

const STORAGE_STATE = "playwright/.auth/user.json";
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined, // CI scales via --shard, not workers
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["html", { open: "never" }],
    ["blob"], // merge sharded CI runs → one HTML report
    ["junit", { outputFile: "test-results/junit.xml" }],
    process.env.CI ? ["github"] : ["list"],
  ],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    testIdAttribute: "data-testid",
    locale: "en-US",
    timezoneId: "Asia/Dubai",
  },

  projects: [
    // 1. Auth runs first; everything else depends on it.
    { name: "setup", testMatch: /.*\.setup\.ts/ },

    // 2. Desktop — skip @rtl specs (the Arabic project owns those).
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      grepInvert: /@rtl/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      grepInvert: /@rtl/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      grepInvert: /@rtl/,
    },

    // 3. Mobile.
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      grepInvert: /@rtl/,
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 15"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      grepInvert: /@rtl/,
    },

    // 4. Arabic RTL — ar-AE locale, only @rtl-tagged specs (they hit /ar/… routes).
    {
      name: "Arabic RTL",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
        locale: "ar-AE",
      },
      dependencies: ["setup"],
      grep: /@rtl/,
    },
  ],

  // Auto-start the app (port 3000 always; reuse a running dev server locally).
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### `e2e/auth.setup.ts`

```ts
import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  // Credentials come from the central .env (never .env.local). See .env.example.
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_USER_EMAIL / E2E_USER_PASSWORD in .env");
  }

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Confirm the session is live by landing on a guarded route.
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("user-menu")).toBeVisible();

  await page.context().storageState({ path: authFile });
});
```

### Example specs

```ts
// e2e/students.spec.ts — web-first assertions + getByTestId, runs authenticated
import { test, expect } from "@playwright/test";

test("creates a student", async ({ page }) => {
  await page.goto("/dashboard/students");
  await page.getByRole("button", { name: /add student/i }).click();
  await page.getByLabel(/first name/i).fill("Ada");
  await page.getByRole("button", { name: /create/i }).click();
  await expect(page.getByTestId("toast")).toContainText(/created/i);
  await expect(page.getByRole("row", { name: /ada/i })).toBeVisible();
});
```

```ts
// e2e/students.ar.spec.ts — @rtl: only runs in the Arabic RTL project
import { test, expect } from "@playwright/test";

test("renders the roster RTL @rtl", async ({ page }) => {
  await page.goto("/ar/dashboard/students");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
```

### `package.json`

```jsonc
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report",
    "test:e2e:install": "playwright install --with-deps",
  },
  "devDependencies": {
    "@playwright/test": "1.60.0", // browsers via `pnpm exec playwright install`
  },
}
```

### `.gitignore`

```
/test-results/
/playwright-report/
/blob-report/
/playwright/.auth/
```

### CI — sharded + blob merge (`.github/workflows/e2e.yml`)

```yaml
name: E2E
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test --shard=${{ matrix.shard }}/4
        env:
          CI: "true"
          E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report/
          retention-days: 7
  merge-reports:
    if: ${{ !cancelled() }}
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: corepack enable && pnpm install --frozen-lockfile
      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: pnpm exec playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with: { name: html-report, path: playwright-report/ }
```

## Clone

```
/clone pattern:e2e
```

Then: add the `@playwright/test` devDependency, run `pnpm exec playwright install --with-deps`, set `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` in the central `.env`, and add the CI secrets.

## Migration

**From an ad-hoc `playwright.config.ts` (e.g. the old `Playwright 1.55` stub):**

1. Add the `setup` project + `e2e/auth.setup.ts`; give every browser project `dependencies: ['setup']` + `storageState`, and delete per-test login.
2. Add `webkit`, a mobile project, and the `Arabic RTL` project; tag RTL specs `@rtl` and `grepInvert: /@rtl/` on the others.
3. Switch reporters to `['html','blob','junit', CI?'github':'list']`; wire the sharded CI workflow + blob merge.
4. Bump `@playwright/test` to `1.60.0`; pin `locale`/`timezoneId` and `testIdAttribute: 'data-testid'` in `use`.

> Conventions: port **3000** always · **pnpm** · credentials from the central **`.env`** (never `.env.local`) · RTL via `/ar/…` routes.
