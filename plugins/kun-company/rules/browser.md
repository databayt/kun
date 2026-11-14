# Browser — one setup, and it is silent

Abdout does not want pages flying across his screen. There are exactly two browsers, and
neither takes focus:

| Need | Use | How |
| --- | --- | --- |
| A public or local page: QA, `see`, `flow`, `watch`, screenshots | `browser` MCP | headless, a fresh profile each session |
| A page behind a login: errands, dashboards, portals | `chrome-devtools` MCP on the session Chrome (:9222) | `new_page` with `background: true`; never `bringToFront` |
| A script that needs a login | `scripts/lib/vault-page.mjs` → `quietPage()` | a hidden page: no tab, no focus |

- The session Chrome is also the browser he works in. Open your own page; never navigate or
  close one of his tabs.
- Bring a window to the front only when a person must act (a CAPTCHA, a code) or for a
  recording: `bash ~/.claude/bin/chrome-debug.sh 9222 <url>`, and say that you did.
- Computer use and Claude in Chrome move the real pointer and windows. Use them only when he
  asks for them by name.
- Do not add a second logged-in browser or a project-level `browser` server.
  `/mcp-doctor` repairs the two that exist.
