---
name: domains
description: Domain + mail health — expiry, renewal, DNS, inboxes
when_to_use: "Use when a domain or company inbox needs checking or fixing, or a domains issue fired. Triggers on: domains, renew, auto-renew, dmarc, spf, mail bouncing."
argument-hint: "[check|renew|verify-renew|lock|restore|harden|lock-mail|add] [domain]"
allowed-tools: Bash(node *), Bash(bash *), Bash(dig *), Bash(whois *), Bash(gh *), Bash(curl *), Bash(security *)
---

# Domains — keep every domain renewed and every inbox reachable

Watchlist + baseline: `cf/domains.json`. Tracer: `scripts/domains/check.mjs` (read-only).
Runs: GitHub Actions `domains.yml` daily 05:30 UTC (DNS, registry, TLS) and launchd
`com.databayt.domains-probe` Mondays 09:30 (SMTP inbox probe — GitHub blocks :25).
Alerts: one `domains: <domain> needs action` issue per unhealthy domain in databayt/kun,
assigned @abdout, rewritten each run, closed when green; blocking items @-mention him daily.
Architecture + provider decision: `content/docs/email.mdx`.

**Hard rule: this skill never changes a zone, a registrar setting or a mailbox without
Abdout's explicit yes in this conversation.** Diagnose, show the exact change, wait.
Before any DNS write, snapshot the zone to `cf/dns/<domain>-snapshot-<date>.json`.

## Credentials (see memory `reference_cloudflare_dash_api`)

| Need                                                                     | Use                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Read/write DNS on any databayt zone                                      | Keychain `cloudflare-zones` (`security find-generic-password -s cloudflare-zones -w`) |
| Registrar auto-renew (Cloudflare), Email Routing rules, rulesets, DNSSEC | dashboard session in the Chrome vault (`X-Cross-Site-Security: dash`)                 |
| Namecheap (databayt.org, abdoutgroup.com, nmbdsd.org)                    | no API — Cowork in Abdout's Chrome, or the vault session; Abdout logs in              |
| sdnic (mkan.sd)                                                          | email `domains@isoc.sd` / local agent — human only                                    |

## Verbs

**`check [domain]`** — `node scripts/domains/check.mjs [--only <d>]` (add `--smtp` only from
the Mac and at most weekly). Explain every ⚠️/🛑 row in plain words, and name the verb.

**`renew <domain>`** — expiry ≤90 days. Look up the registrar in `cf/domains.json`. Cloudflare:
dash → Domain Registration → renew + confirm the card. Namecheap: hand Cowork the exact
domain + "renew 1 year, keep auto-renew on" (payment is Abdout's — a hard stop). sdnic: draft
the renewal email to `domains@isoc.sd` for Abdout. After renewal, re-run `check` — RDAP shows
the new date within hours.

**`verify-renew <domain>`** — nobody has looked at auto-renew in 35 days. Have Cowork (or the
vault) open the `renewal.where` page and report: auto-renew on/off, payment method valid,
expiry. Then stamp `renewal.autoRenew: "on"` + `autoRenewVerifiedAt: <today>` in
`cf/domains.json` and commit. Never stamp without someone having seen the page.

**`lock <domain>`** — registrar transfer lock off. Turn on "Domain Lock" at the registrar.

**`restore <domain>`** — NS/MX/SPF/DKIM changed or vanished, TLS expiring, or an inbox
rejecting. Diff live DNS against `cf/domains.json` and the latest `cf/dns/*` snapshot, show
the missing records, and on yes recreate them with the `cloudflare-zones` token. NS changed =
treat as possible hijack: check registrar account access + contact email before anything else.
Inbox 5xx = the mailbox/alias/routing rule was deleted at the provider.

**`harden <domain>`** — DMARC weaker than wanted or without reports. The path is
`p=none` + `rua` → watch reports 2–4 weeks → `p=quarantine` → `p=reject`. Never jump a domain
that sends real mail straight to reject. Report mailbox: the one chosen in `email.mdx`.

**`lock-mail <domain>`** — the domain sends no mail but can be spoofed. On yes, publish
`v=spf1 -all` and `_dmarc` `v=DMARC1; p=reject;` (safe only while the domain truly sends nothing —
check `cf/domains.json` `mail: null`). Remove both before giving the domain mailboxes.

**`add <domain>`** — new domain (e.g. the upcoming fourth product): add an entry to
`cf/domains.json` with registrar, renewal page and mail baseline, move its NS to the Cloudflare
pair, run `check`, and run `verify-renew` the same day.

## Changing mail on purpose

A planned mail change (new provider, new DKIM selector) must update the `mail` baseline in
`cf/domains.json` **in the same commit** — otherwise the next run calls it drift and opens a
🛑 issue, which is the tracer working correctly.
