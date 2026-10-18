---
name: behalf
description: Web errands as Abdout — sign up, confirm, get keys
when_to_use: "Use when a site task must be done as Abdout: a new account, email confirmation or dashboard keys. Triggers on: on my behalf, sign up for, create an account, like cowork, نيابة عني."
argument-hint: "<what to get done, e.g. 'MTN MoMo sandbox keys for food'>"
---

# behalf — errands in Abdout's name

Abdout's standing authorization: **create free accounts in his name, accept their standard
terms, confirm them, and get what the errand needs. Don't ask first.** The errand is the goal,
not the account: "MTN MoMo sandbox keys for food" ends when the keys work in food's `.env`, not
when the sign-up form is submitted.

## The gates — the only reasons to stop

Never route around these. Stop, say exactly what is waiting and where, and send one
`PushNotification` if he isn't at the Mac (`~/.claude/.present` absent):

| Gate                                                                           | What to do                                                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CAPTCHA / "are you human" / puzzle                                             | **Never solve, bypass or farm it out.** Leave the page open in the vault Chrome; ask him to tick it there. When he says "done", continue. |
| SMS / authenticator code to his phone                                          | Ask for the code; continue when he replies.                                                                                               |
| Payment, card, bank details, a paid plan or trial that converts to paid        | Stop. Free tiers only, unless he names the plan.                                                                                          |
| KYC: ID / passport / selfie upload, legal entity documents, signing a contract | Stop. Prepare everything else first.                                                                                                      |
| Anything that posts publicly in his name (profile bio, a review, a post)       | Route through `/approve`.                                                                                                                 |
| The site's terms forbid automated sign-up, or a block is clearly anti-bot      | Stop and hand him the open page — don't fight it.                                                                                         |

Everything else (forms, email confirmation, choosing a free product, generating keys, settings)
is yours to finish.

## 1. Before touching the browser

1. Read the ledger `~/.claude/accounts.json` (create it as `[]` if missing). If the service is
   listed, this is a **login** → use `/auth`, then skip to step 4.
2. Look for an API first. Many dashboards (MTN MoMo sandbox, Cloudflare, Neon…) let you create
   keys over HTTP once you hold one token. Browser only for what really needs a person.
3. Identity:
   - Email: `databayt-primary` (osmanabdout@hotmail.com) by default; `databayt-secondary`
     (gmail) for Google sites. Same rules as `/auth` → "Identity map".
   - Name, phone, country, city, company, links: `~/kun/jobs/profile.json` → `identity`,
     `work`, `links`. Read the fields you need; never paste the file anywhere.
   - Password: the shared identity password, `security find-generic-password -s
databayt-primary -w`, used immediately. It goes into the page **as an `evaluate_script`
     arg**, never in the function source, a log or chat. If the site rejects it (rules,
     length), generate one (`openssl rand -base64 18`), store it first (step 5), then use it.

## 2. The browser — his own Chrome (the session vault)

Drive the `chrome-devtools` MCP. Its wrapper attaches to the persistent, visible Chrome on
`127.0.0.1:9222` (profile `~/.claude/chrome-debug-profile`), which is the same Chrome he can
see and click. That matches Cowork's edge, and adds Keychain, the inbox reader and the repo.

- Not running? `bash ~/.claude/bin/chrome-debug.sh` (or `chrome-session-agent.sh install`).
  If the MCP came up on the throwaway fallback profile, say so: the session won't persist.
- Fill fields with `/auth`'s React-safe setter (Web login playbook, step 3), extended to any
  field by `name`/`id`/label. Select dropdowns by visible text. Tick only the boxes the
  sign-up requires (terms, privacy). **Leave marketing boxes unticked.**
- `take_snapshot` after every submit; read errors on the page before retrying. Max two retries
  per step, then report what the page says.

## 3. Confirm the email — without him

```bash
bash ~/kun/.claude/scripts/mail-code.sh --from <sender-domain> --minutes 15 --wait 180
# → "code: 482913"  or  "link: https://…/verify?token=…"
```

It reads hotmail through Mail.app (INBOX + Junk) and prints only the newest code or
verification link, never a whole email. A `link:` opens in the vault (`navigate_page`). A
`code:` is typed into the page. For gmail identities use the Gmail MCP (`search_threads` from
the sender, then `get_message`), reading only the code or link. If nothing arrives in 3 min,
use the site's "resend" once, then check Junk/Spam wording on the page and stop.

## 4. Do the actual errand

Subscribe to the free product, create the app or project, generate the keys, copy the values
the target needs. Read values from the page with `evaluate_script` returning the value into a
shell variable. **Never print a secret into chat or a log**; report only the first 4 characters.

## 5. Store, then deliver

- **API keys / tokens** → Keychain service `databayt`, account = the env-var name, value on
  stdin (never in argv):
  `printf %s "$VALUE" | bash ~/kun/.claude/scripts/credentials.sh set MOMO_API_KEY`
- **A site password that isn't the shared one** → the same command with key
  `<SERVICE>_PASSWORD` (e.g. `MTN_MOMO_PASSWORD`), so the ledger can point at it.
- **Deliver** where the errand said: the repo's central `.env` (never `.env.local`), or
  production secrets via that repo's lane (food: Keychain `cf-food-<VAR>` + `scripts/cf-secrets.sh`).
  Then prove it works, e.g. one real API call or the repo's own test.

## 6. Ledger + report

Upsert one row in `~/.claude/accounts.json`. No secrets in it, ever:

```json
{
  "service": "mtn-momo-sandbox",
  "url": "https://momodeveloper.mtn.com",
  "identity": "databayt-primary",
  "createdAt": "2026-10-18",
  "keychain": [
    "databayt/MOMO_SUBSCRIPTION_KEY",
    "databayt/MOMO_API_USER",
    "databayt/MOMO_API_KEY"
  ],
  "usedBy": ["food/.env"],
  "notes": "Collections product; sandbox API user callback host bu.databayt.org"
}
```

Report in three lines: what exists now, where the secrets live, what proved it works. Then
list any gate still waiting. If he's away, attach a screenshot of the finished dashboard with
`SendUserFile` (crop or skip it if secrets show on screen).

## Never

- Solve, bypass, or outsource a CAPTCHA; spoof a browser fingerprint; rotate IPs.
- Create a second account to dodge a limit or a ban.
- Use any identity but his two, or invent identity facts that aren't in `profile.json`.
- Enter payment details, upload ID documents, or sign anything binding.
- Put a password or key in chat, a commit, a log, the ledger or a screenshot.
