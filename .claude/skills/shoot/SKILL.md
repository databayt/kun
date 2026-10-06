---
name: shoot
description: Stills of real product pages and flows, framed like Abdout's MacBook
when_to_use: "Use when a page or flow needs STILL screenshots — routes or a scripted e2e flow, framed like Abdout's MacBook at Chrome 125%. Video is /record. Triggers on: shoot <route|flow>, take a screenshot of <url>, screenshot the <x> flow, لقطة شاشة."
argument-hint: "<path|url>… | --flow <name> [--role admin] [--host url] [--full]"
---

# Shoot — stills of the real product

`shoot` = screenshots, `record` = video. Shoot runs headless: no screen, no Do Not Disturb,
no browser MCP. It logs into the demo by itself, so it can run while Abdout keeps working.

```
node ~/.claude/skills/shoot/scripts/shoot.mjs /ar/students /ar/teachers   # stills, one login
node ~/.claude/skills/shoot/scripts/shoot.mjs --flow add-student          # scripted flow
  [--role admin|teacher|student|guardian|accountant|staff] [--host <url>] [--repo hogwarts]
  [--full] [--zoom 1.25] [--name <stem>] [--out <dir>]
```

## The frame — his manual screenshot

14" MacBook Pro M4 (1512x982 logical, Retina 2x), Chrome filling the screen (page area
1512x857), **Chrome zoom 125%** → CSS viewport **1210x686 at devicePixelRatio 2.5** →
~3025x1715 px. Approved by Abdout 2026-10-06 against his own Chrome.

Never fake zoom with CSS `zoom` on `<html>`: layout and breakpoints still see 1512 px,
and he can see the difference. DPR 2 gives the right layout at the wrong resolution.

## Where + name (his choice)

- `~/<repo>/public/screenshot/` — the file is the short URL with brand and host dropped,
  locale last: `/ar/students` → `students-ar.png`, `/ar` → `home-ar.png`,
  `/ar/s/demo/students/new` → `students-new-ar.png`.
- Same name = overwrite, so a re-shoot replaces the old shot.
- Flows: `<flow>/NN-<step>-<locale>.png` (`add-student/01-list-ar.png`).
- `public/` is served publicly once that folder is committed and deployed (`balqalam.com/screenshot/…`).

## Hosts + login

- Default `https://demo.balqalam.com`, the demo tenant. Its role picker is password-less,
  so `--role` picks the account (admin by default; order = `DEMO_ROLE_KEYS` in hogwarts
  `src/components/auth/login/demo-accounts.ts`).
- Marketing home: `--host https://balqalam.com`.
- Before shooting `localhost:3000`, check which repo owns the port
  (`lsof -ti tcp:3000` → `lsof -p <pid> -a -d cwd`). On 2026-10-06 it was serving `~/space`.

## Flows — write once, re-shoot forever

A flow is a file: `scripts/../flows/<repo>/<flow>.mjs`, canonical in kun.

```js
export default async ({ page, go, shot, settle }) => {
  await go("/ar/students");
  await shot("list");
  await page.getByRole("button", { name: "إضافة" }).click();
  await shot("form");
};
```

- `go(path)` navigates and logs in if asked. `shot(step)` settles (network idle, fonts,
  800 ms) then saves the next numbered still. `page` is Playwright.
- Name each step after what is on screen (`list`, `form`, `filled`, `saved`, `new-row`).
- Instant `fill()` is fine — these are stills.
- Delete demo data the flow created (the test student) at its end, or the next run's
  list shot carries it.

## Close

Read every PNG before reporting it done. Send the key ones with `SendUserFile` and give
the folder path. A wrong-looking frame means recapture, never a pixel edit.
