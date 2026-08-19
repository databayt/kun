---
name: facebook
description: Connect a brand's Facebook Page to the publishing pipeline — grant, permanent token, registration, verified first post
when_to_use: "Use when a Facebook Page must be wired into kun's social pipeline so drafts can be delivered to it — a brand-new brand Page, a Page that exists but posts nothing, a token that expired or was invalidated, or a delivery failure that reports a permissions error naming nothing. Covers the whole path: the Meta grant, the permanent Page token, the four-file code registration, env on Vercel, and a verified-then-retracted first post. This is CONNECTION work, not content: it never writes copy (/draft), never renders media (/higgs, /carousel), never approves (/approve), and never runs the everyday send (/publish, which assumes the Page is already wired). Triggers on: connect a facebook page, add my brand page, wire up facebook, new brand page, facebook token expired, page token not working, invalid scopes, add <brand> to social, اربط صفحة فيسبوك, أضف صفحة العلامة."
argument-hint: "<brand-id> [--page-url <profile-or-page-url>]"
---

# Facebook — connect a brand Page

A Page is connected when a draft addressed to that brand reaches it unattended. Everything
below exists to get to that one fact and prove it.

Arguments: $ARGUMENTS — the brand id (lowercase, becomes the env suffix uppercased) and
optionally the Page URL.

## Doctrine

- **The Page id is not the number in the URL.** Verify it from Graph before storing it.
- **`expires_at: 0` or it is not done.** A token that expires is a scheduled outage.
- **Never revoke an app grant to "start clean."** It invalidates every existing permanent Page
  token — including the working ones for other brands.
- **Nothing is connected until a real post lands and is read back.** A token that health-checks
  can still fail to publish.
- **Retract the test post.** It is scaffolding, not content.

## Steps

### 1. Establish the Page id — do not trust the URL

A Page URL of the form `profile.php?id=61592684345321` carries the **profile number**, not the
Graph Page id. Graph rejects it:

```
"Object with ID '61592684345321' does not exist, cannot be loaded due to missing
 permissions, or does not support this operation"   ← error_subcode: 33
```

The real id comes from the grant dialog's Page picker or from `/me/accounts` (step 3). In this
engine's own case the two differed entirely: profile number `61592684345321`, Graph id
`1218016808068580`. Storing the wrong one costs an hour and the error never says why.

### 2. Grant the app access to the Page

Meta app: **Gabriel** (`874547138717755`), type **Business**. A **Consumer**-type app can never
request Pages permissions — the scopes do not appear and OAuth returns *"Invalid Scopes"*. The
type cannot be changed after creation.

Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/874547138717755/),
select the app, User Token, and these five scopes:

`pages_manage_posts` · `pages_read_engagement` · `pages_read_user_content` ·
`pages_show_list` · `read_insights`

**The trap that costs the most time:** if the app already has *other* Pages, clicking
**Generate Access Token** auto-completes with *"Continue as …"* and **silently re-issues the
previous grant**. The token looks valid, but `granular_scopes` still names only the old Page ids,
and delivery later fails with a permissions error that names nothing.

The step that actually adds the new Page:

> On the login dialog click **Edit settings** — *not* Continue → **Select all** in the Page
> picker → **Continue** → **Save**.

Then Generate again. Confirm the new id appears in **every** `granular_scopes` entry:

```bash
curl -s "https://graph.facebook.com/v25.0/debug_token?input_token=$T&access_token=$T" \
  | python3 -m json.tool | grep -A4 granular
```

> **Do not revoke the app to force a fresh dialog.** Edit settings is additive and leaves other
> brands' permanent tokens untouched. Revoking destroys them.

### 3. Mint the permanent Page token

The user token from step 2 is short-lived (~1 hour), and a Page token derived from it inherits
that expiry. Two exchanges are needed.

**No app secret required.** The [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
does the long-lived exchange server-side: paste the user token → **Debug** → **Extend Access
Token** → copy the long-lived token it prints.

Then derive the Page token:

```bash
curl -s "https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&limit=50&access_token=$LLUT"
```

Verify before storing anything:

```bash
curl -s "https://graph.facebook.com/v25.0/debug_token?input_token=$PT&access_token=$PT"
# require: "type": "PAGE"   and   "expires_at": 0
```

> `/me/accounts` returns only **personally-owned** Pages. A Page owned by a Business Portfolio is
> fully granted and fully postable but **will not appear here** — take its token from the
> portfolio's System User instead, or read the id from the Page picker in step 2. An absent Page
> is not a failed grant.

### 4. Register the brand in code — four files, no logic

| File | Change |
|---|---|
| `src/components/root/social/products.ts` | add `{ id, label, labelAr, channels: { facebook: true } }` |
| `src/components/root/carousel/schema.ts` | add the id to the `brand` enum |
| `src/components/root/carousel/brands.ts` | add `{ wordmark, domain }` |
| `content/docs/social/meta.json` + `<brand>.mdx` | per-brand page, matching the existing ones |

`src/lib/facebook.ts` resolves purely by env suffix, so **no transport code changes, ever**. Env
is read in exactly two functions (`facebook.ts` `getFacebookConfig`, and `instagram.ts` which
borrows the FB token) — that is the whole surface.

### 5. Env

```
FACEBOOK_PAGE_ID_<BRAND>=<graph page id>
FACEBOOK_PAGE_ACCESS_TOKEN_<BRAND>=<permanent page token>
```

`.env` plus Vercel **production, preview and development**. Add the pair to `.env.example` too —
an undocumented brand is one nobody can reproduce. Env reads are `.trim()`ed because Vercel values
can carry a trailing newline.

### 6. Prove it, then clean up

Health check first, then a real post — a token that health-checks can still fail to publish, so
the post is the only proof that matters.

```
checkFacebookHealth("<brand>")        → returns the Page name
sendFacebookPost("...", "<brand>")    → returns an externalId
GET /{externalId}?fields=message,permalink_url  → message + live permalink
deleteFacebookPost(externalId, "<brand>")       → retract
GET /{externalId}                     → now errors ⇒ genuinely gone
```

Run the other brands' health checks in the same pass. A grant change is the moment sibling tokens
break, and finding that out later — from a silent delivery failure — is the expensive way.

## Exit gate

The Page id is Graph-verified; the token is `type: PAGE` with `expires_at: 0`; the new id appears
in every `granular_scopes` entry; the brand is registered in all four files; env is on Vercel in
three environments; a real post landed, was read back with a live permalink, and was retracted;
and **every previously-working brand still passes its health check**.

## When NOT to use

Writing the post (`/draft`), making the media (`/higgs`, `/carousel`), the sign-off
(`/approve`), the everyday send to an already-wired Page (`/publish`), or Instagram — which needs
`instagram_content_publish` and a linked Business account, and is gated separately
(`/docs/social/channels/instagram`).
