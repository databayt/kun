---
name: auth
description: Autonomously authenticate to any web service or CLI on Abdout's behalf using the macOS-Keychain-stored databayt identities, then reach protected pages and fetch original assets behind the login wall. Use whenever a page redirects to a login wall, a CLI reports "not authenticated", the user says "log into X / sign me into X / auth", or a clone/asset-fetch task needs content behind a paywall or dashboard. Minimizes interaction — only pauses for a one-time code when no non-interactive path exists.
---

# auth — self-service login for the kun engine

The engine holds Abdout's credentials in the **macOS Keychain** (encrypted, OS-level — never
in files, never committed) and can log itself into services as needed. Go autonomous: complete
the login without asking; only stop for a 2FA/OTP code when there is genuinely no other path.

This capability is global. It lives in the kun source of truth at
`kun/.claude/skills/auth/` and is installed to `~/.claude/skills/auth/`, so **every project
inherits it** — not just mkan.

## The permanent path — the session vault (greenlist)

**Prefer this over automated form-fill for anything bot-protected** (Airbnb, AWS, Namecheap,
Facebook, Oracle, Google consoles, hogwarts, …). Automated password login from a blank profile
trips CAPTCHAs and OTP because it looks like a bot. The fix is session reuse, not credentials:

- A single **persistent Chrome** (the "session vault") runs in the background on
  `127.0.0.1:9222`, kept alive by a LaunchAgent (`~/.claude/bin/chrome-session-agent.sh`,
  label `com.databayt.chrome-session`). Its profile is `~/.claude/chrome-debug-profile`.
- The chrome-devtools MCP command is the wrapper `~/.claude/bin/chrome-devtools-mcp.sh`, which
  **auto-attaches** to that vault. So Claude drives the same browser Abdout logs into by hand.
- **Greenlisting a site** = `bash ~/.claude/bin/greenlist.sh add <url>` opens it in the vault;
  Abdout logs in **once** (CAPTCHA + OTP included, as a human); the session persists for
  weeks/months. Claude reuses it with zero re-login. `greenlist.sh list` shows the set;
  `greenlist.sh probe` shows live tabs; the manifest is `~/.claude/greenlist.json` (URLs only,
  never cookies/passwords).

So the flow for "Claude, do X on <site>": check `greenlist.sh probe` / just navigate — if the
session is live, proceed. If it 302s to a login wall, run `greenlist.sh add <url>` and ask
Abdout to log in that once. Never re-run an automated login on a site the vault already holds.

Restart Claude Code after first enabling the vault so the MCP picks up the wrapper; after that
it's automatic. If the vault is down, the wrapper falls back to a throwaway profile (login walls
return) — bring it back with `chrome-session-agent.sh install` or `chrome-debug.sh`.

## Credentials (macOS Keychain)

Two identities, **same password**, stored as generic passwords:

| Keychain service     | Account (email)               | Role                        |
| -------------------- | ----------------------------- | --------------------------- |
| `databayt-primary`   | `osmanabdout@hotmail.com`     | **Default** for most logins |
| `databayt-secondary` | `osmanabdout.jr@gmail.com`    | Google ecosystem + fallback |

Fetch (never echo the value into chat/logs/files):

```bash
EMAIL=$(security find-generic-password -s databayt-primary 2>/dev/null | sed -n 's/.*"acct"<blob>="\(.*\)"/\1/p')
PASS=$(security find-generic-password -s databayt-primary -w)   # → password, use immediately
# or via the helper: PASS=$(bash ~/.claude/bin/keychain-mcp.sh find-generic databayt-primary)
# secondary: swap databayt-primary → databayt-secondary
```

### Bootstrap (fresh machine / rotated password)

If `find-generic-password -s databayt-primary -w` returns empty or a stale value, seed both
entries once (this is the only place the password is written, and it goes straight into the
encrypted Keychain — never a tracked file):

```bash
security add-generic-password -s databayt-primary   -a "osmanabdout@hotmail.com"  -w "<password>" -U
security add-generic-password -s databayt-secondary -a "osmanabdout.jr@gmail.com" -w "<password>" -U
```

## Identity map (which email per service)

- **Default → `databayt-primary` (hotmail)**: Airbnb, Vercel, GitHub, Neon, Stripe, Figma,
  Notion, Linear, Resend, Upstash, Sentry, PostHog, and anything not listed below.
- **`databayt-secondary` (gmail) →** the Google ecosystem: Google account, Gmail, Google Cloud /
  `gcloud`, Google Drive, YouTube, Firebase, Google Analytics, Google OAuth ("Continue with Google").
- **Fallback rule:** if a login fails with *"account/email not found"* or *"wrong password"*,
  retry once with the **other** identity before reporting blocked — the account may have been
  created under the other email.

## Web login playbook (chrome-devtools MCP)

The `chrome-devtools` MCP drives a real, persistent Chrome — cookies survive, so **one login
lasts the whole session/profile**. Steps:

1. `new_page` / `navigate_page` to the service. If it's already authed (no login wall), stop —
   done.
2. Resolve the identity from the map; fetch `EMAIL` + `PASS` from Keychain.
3. Fill the form with the **controlled-input technique** (plain `fill`/value-set does NOT fire
   React's `onChange`, so submit buttons stay disabled). Via `evaluate_script`:

   ```js
   (email, pass) => {
     const set = (el, v) => {
       const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
       Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
       el.dispatchEvent(new Event('input',  { bubbles: true }));
       el.dispatchEvent(new Event('change', { bubbles: true }));
     };
     const e = document.querySelector('input[type=email],input[name*=email i],input[name=identifier],input[autocomplete=username]');
     const p = document.querySelector('input[type=password]');
     if (e) set(e, email);
     if (p) set(p, pass);
     return { filledEmail: !!e, filledPass: !!p };
   }
   ```
   Pass `EMAIL`/`PASS` as `args` — do **not** inline the password into the function source.
4. Submit: click the primary submit button (`button[type=submit]`, or the one whose text is
   Continue / Log in / Sign in — exclude OAuth "Continue with …"). **Multi-step forms**
   (Google, Microsoft, Airbnb): fill email → Continue → wait → fill password → submit.
5. Wait for redirect off `/login`; confirm an authed signal (avatar, dashboard, account menu).
   On a slow cold backend, poll a few seconds before deciding.

### Persistent profile — log in once, stay logged in

The chrome-devtools MCP uses a **persistent** user-data-dir by default
(`~/.cache/chrome-devtools-mcp/chrome-profile`), so cookies survive across Claude Code
sessions. A successful login therefore only has to happen **once per service** — after that,
navigating to a protected page just works. Check for an existing session before ever filling a
login form.

### CAPTCHA / OTP on automated login → the real-Chrome path (auto-wired)

Bot-detecting sites (Airbnb, Google, Cloudflare-fronted apps) throw a puzzle/"security check"
CAPTCHA — and often an email OTP ("Confirm it's you") — when an automation profile logs in.
**Never try to solve a CAPTCHA.** Instead let the login happen once in a real Chrome, then reuse
its session automatically:

1. `bash ~/.claude/bin/chrome-debug.sh` launches Chrome with remote debugging on `:9222` using a
   dedicated persistent profile (`~/.claude/chrome-debug-profile`), opening the target's login.
2. Abdout completes the login **by hand, once** — including any CAPTCHA and the email OTP (the
   code goes to `osmanabdout@hotmail.com` for the primary identity, which is not machine-readable
   here). This is his normal manual login; the persistent profile keeps the session.
3. The chrome-devtools MCP command is the wrapper `~/.claude/bin/chrome-devtools-mcp.sh`, which
   **auto-attaches** to `:9222` whenever that Chrome is running (else falls back to the default
   profile). So after logging in, just restart Claude Code — no `mcp.json` edit needed — and the
   automation drives the authenticated site directly.

You (Claude) can pre-fill the email/password over CDP with Playwright
(`chromium.connectOverCDP('http://127.0.0.1:9222')`, credentials from Keychain via env) to save
Abdout typing, but the CAPTCHA + OTP still need him. Detect the OTP screen ("Confirm it's you"),
report which identity's inbox holds the code, and stop for it.

### 2FA / OTP (autonomous-first)

Prefer, in order: (a) an already-valid session/cookie (skip login), (b) a saved passkey /
"trust this device", (c) an app-specific password or API token stored in Keychain. Only if none
exist: print exactly which service + which identity is waiting, and ask Abdout for the one-time
code — then continue. Never loop on a CAPTCHA; report it and move on.

### Signup

Same fill technique on the signup form, default identity, the shared password. Stop and report
if it requires email/phone verification, a CAPTCHA, or payment — those need Abdout.

## Fetching assets & content behind the login wall

Once authed in the persistent Chrome profile, the session cookie unlocks protected pages and
their assets. Use this for clone/asset-fetch tasks (e.g. mirroring an Airbnb dashboard page and
pulling its original images, icons, fonts, and API responses):

1. **Navigate authed.** `navigate_page` to the protected URL in the same profile that just
   logged in — the cookie rides along, no re-auth.
2. **Harvest asset URLs from the live DOM** (runs in the authed context, so lazy/`srcset`/
   CSS-`url()` assets resolve):

   ```js
   () => {
     const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
     const imgs = [...document.querySelectorAll('img')].flatMap(i =>
       [i.currentSrc || i.src, ...(i.srcset ? i.srcset.split(',').map(s => s.trim().split(' ')[0]) : [])]);
     const bg = [...document.querySelectorAll('*')].map(el =>
       getComputedStyle(el).backgroundImage).filter(v => v && v !== 'none')
       .flatMap(v => [...v.matchAll(/url\((['"]?)(.*?)\1\)/g)].map(m => m[2]));
     const media = [...document.querySelectorAll('source,video,audio')].map(e => e.src || e.getAttribute('srcset'));
     return [...new Set([...imgs, ...bg, ...media].map(abs).filter(Boolean))];
   }
   ```
3. **Capture network assets** the DOM scrape misses (fonts, XHR/JSON, CDN blobs): use
   `list_network_requests` after the page settles, or reload with the network panel to record
   every request URL + type.
4. **Download** each asset with the session cookie so protected/CDN-signed URLs succeed. Export
   the cookie from the authed profile, then fetch:

   ```js
   // In the authed page: read cookies for the current origin
   () => document.cookie
   ```
   ```bash
   # curl with the harvested cookie; -L follows CDN redirects
   curl -sL -H "Cookie: $COOKIE" -A "$UA" "$ASSET_URL" -o "assets/$(basename "${ASSET_URL%%\?*}")"
   ```
   For same-origin assets you can also fetch inside the page via `evaluate_script` +
   `fetch(url).then(r => r.blob())` (the browser attaches the cookie automatically) and read
   the bytes back as a data URL — handy for CORS-locked CDNs.
5. **Screenshot the protected view** (`take_screenshot`, full-page) as the visual reference for
   the clone. Pair this with the `clone` skill's url-mode capture, which expects the page to be
   reachable — auth first, then clone.

Keep fetched assets under the project's asset dir (e.g. `.clone/<slug>/` or `public/`), never
commit credentials or cookies, and respect that this is for Abdout's own accounts.

## CLI / token auth

| Tool      | State / command                                                              |
| --------- | --------------------------------------------------------------------------- |
| `gh`      | authed as `abdout` (keyring). Re-auth: `gh auth login`                       |
| `vercel`  | authed as `abdout`. Re-auth: `vercel login`                                 |
| `neonctl` | authed. `neonctl auth` to refresh                                            |
| `gcloud`  | OAuth: `bash ~/.claude/bin/gcloud-mcp.sh auth-login` (gmail identity) — URL+code flow |
| `stripe`  | `stripe login` (browser OAuth) — or set `STRIPE_API_KEY` from Keychain       |
| API-key MCPs (neon/stripe/ref/algolia/posthog/airtable) | resolve `${VAR}` from the repo `.env` or a Keychain generic password of the same name |

## Security rules

- Read credentials from Keychain **only**, at point of use; never write them to a file, a repo,
  a log, or the chat. Never paste a password into an `evaluate_script` function body — pass it
  as a bound `arg`.
- A new service's password goes into Keychain via
  `security add-generic-password -s <service> -a <account> -w <pwd> -U` — never a tracked file.
- Cookies and session tokens harvested for asset-fetching are transient — use them in the same
  turn, never persist them to the repo.
- This capability is global (`~/.claude/`), so every repo inherits it; the same Keychain is
  machine-wide. Source of truth: `kun/.claude/skills/auth/`. Helpers: `kun/.claude/bin/`
  (installed to `~/.claude/bin/`).
