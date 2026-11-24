// Feature heroes — helpers for the feature-<id> flows behind the looping clip on /<lang>/features/<id>.
// A step is [name, path, action?, ready?]: go to the path (null stays on the page), run the action
// (a click, a scroll), wait for the `ready` selector when the data loads late, then shoot. Pick screens that are FULL of real data — a "coming soon"
// card or an empty state makes a dead loop. Probe a page before adding it (see SKILL.md › Flows).
// A leading _ marks a helper, not a flow.
// Blur what could be a real person's contact on screen: phone numbers in live Sudanese ranges (as
// add-student does) and any email address outside the house domains — the demo seeds teachers with
// plausible @gmail addresses (timetable, 2026-11-08). And hide rows that are not school data: the
// demo's joke student "Harry Potter" (a trademarked name, gradebook) and the end-to-end test exam
// "E2E Objective Exam" (exams list), both flagged by media-qa.
// Self-contained: Playwright serialises it.
export const initScript = () => {
  const phone = /(\+?249|\b0)[19]\d{5,8}/, fake = /2499000000\d\d/
  const email = /[\w.+-]+@(?!(?:balqalam\.com|databayt\.org)\b)[\w-]+\.[\w.]+/
  const scan = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n; (n = w.nextNode()); ) {
      const s = n.textContent.replace(/[\s-]/g, "")
      const hit = (phone.test(s) && !fake.test(s)) || email.test(n.textContent)
      if (hit && n.parentElement) n.parentElement.style.filter = "blur(6px)"
      const row = /Harry Potter|هاري بوتر|\bE2E\b/.test(n.textContent) && n.parentElement?.closest("tr")
      if (row) row.style.display = "none"
    }
  }
  new MutationObserver(() => scan(document.body)).observe(document, { childList: true, subtree: true, characterData: true })
  addEventListener("DOMContentLoaded", () => scan(document.body))
}

export const feature = (steps) => async (ctx) => {
  for (const [step, path, act, ready] of steps) {
    if (path) await ctx.go(path)
    if (act) await act(ctx)
    // `ready`: a selector that only exists once the data is in (rows that load after first paint)
    if (ready)
      await ctx.page
        .locator(ready)
        .first()
        .waitFor({ state: "visible", timeout: 30000 })
        .catch(() => console.warn(`  ⚠ ${step}: "${ready}" never showed — shooting anyway`))
    await ctx.shot(step)
  }
}

/** Open the first element matching `sel`: click it when visible, else follow its href
 *  (a grid view or a collapsed row can hide the link the table showed). */
export const clickFirst = (sel) => async ({ page }) => {
  const visible = page.locator(sel).locator("visible=true").first()
  if (await visible.count()) await visible.click()
  else {
    const href = await page.locator(sel).first().getAttribute("href", { timeout: 15000 })
    await page.goto(new URL(href, page.url()).href, { waitUntil: "load", timeout: 90000 })
  }
  await page.waitForLoadState("load").catch(() => {})
}

/** Click a button by its accessible name, [ar, en]. */
export const press = ([ar, en]) => async ({ page, t }) => {
  await page.getByRole("button", { name: t(ar, en), exact: true }).first().click()
  await page.waitForTimeout(800)
}

/** Open the picker whose button reads [ar, en] and choose the option named [ar, en]. */
export const pick = ([tAr, tEn], [ar, en]) => async ({ page, t }) => {
  await page.getByRole("button", { name: t(tAr, tEn), exact: true }).first().click()
  await page.getByRole("option", { name: t(ar, en) }).first().click()
  await page.waitForTimeout(1500)
}

/** Click the element whose visible text is exactly [ar, en] (segmented controls, chips). */
export const clickText = ([ar, en]) => async ({ page, t }) => {
  await page.getByText(t(ar, en), { exact: true }).first().click()
  await page.waitForTimeout(1500)
}

/** Click the nth tab (language-independent). */
export const tab = (n) => async ({ page }) => {
  await page.getByRole("tab").nth(n).click()
  await page.waitForTimeout(800)
}

/** Scroll the page to y px, so a long dashboard gives a second shot. */
export const scrollTo = (y) => async ({ page }) => {
  await page.evaluate((y) => window.scrollTo(0, y), y)
  await page.waitForTimeout(800)
}
