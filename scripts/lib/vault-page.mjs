// vault-page.mjs — a page in the session-vault Chrome that nobody sees.
//
// The vault (Chrome on :9222, profile ~/.claude/chrome-debug-profile) is the one browser that
// holds Abdout's logins, and it is also the browser he works in. A script that calls
// context.newPage() there puts a tab in front of him. quietPage() asks Chrome for a HIDDEN
// target instead: it shares the vault's cookies, never shows in the tab strip, takes no focus,
// and closes when the script disconnects. Focus emulation makes the page believe it is visible,
// so it renders, screenshots work and its timers run (measured on Chrome 157, 2026-11-14).
// If Chrome refuses a hidden target (an older build), the fallback is a background tab — still
// no focus change. KUN_BROWSER_SHOW=1 opens an ordinary tab, for watching a script work.
export async function quietPage(browser, { width = 1440, height = 900 } = {}) {
  const context = browser.contexts()[0];
  let page = null;
  if (!process.env.KUN_BROWSER_SHOW) {
    const cdp = await browser.newBrowserCDPSession();
    for (const params of [{ url: "about:blank", hidden: true }, { url: "about:blank", background: true }]) {
      try {
        const arriving = context.waitForEvent("page", { timeout: 8000 });
        await cdp.send("Target.createTarget", params);
        page = await arriving;
        break;
      } catch {
        page = null;
      }
    }
  }
  if (!page) page = await context.newPage();
  await page.setViewportSize({ width, height });
  try {
    const s = await context.newCDPSession(page);
    await s.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  } catch {}
  return page;
}
