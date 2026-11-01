---
name: kun
description: "Hand real work to Claude Code (Opus 5.5) on this Mac — building, fixing, changing or deploying code, kun spells (social, report, scrape, jobs, deploy, release, qa…), deep questions about the mkan or kun repos, screenshots or files to read, anything multi-step. One command starts it; Claude Code posts its own answer in the thread."
version: 1.0.0
author: databayt
license: SSPL
platforms: [macos]
metadata:
  hermes:
    tags:
      [kun, claude code, opus, delegate, build, fix, deploy, code, mkan, engine]
    related_skills: [mkan, home, crm]
prerequisites:
  commands: [bash, claude]
---

# kun — hand the work to Claude Code

You are the ears. **Claude Code (Opus 5.5, on Abdout's Max plan) is the hands.** It runs
on this Mac with the kun engine loaded — every kun skill, the repos, the CRM, the
Keychain, the browser vault — and it answers in the Slack thread itself.

## Hand off when

- Abdout asks to build, fix, change, check, deploy, commit or release anything.
- He uses a kun spell word: social, draft, carousel, higgs, report, scrape, leads, funnel,
  jobs, seek, deploy, release, qa, handover, record, shoot, edit, health, captain, sync…
- A question needs reading code, the database or several sources ("why did…", "how does…",
  "what went wrong with…", "check whether…").
- He attaches a screenshot or a file to be read.
- It would take you more than two commands.

**Keep for yourself:** quick mkan facts from `pnpm mkan:read` (the `mkan` skill), the
quick commands, cron jobs, greetings, one-line answers you already know.

**Never from #mkan** (`C0BS2NZE2AY`): that channel belongs to the intake desk (`home`).

## How

Pick the repo: **`mkan`** for mkan.sd, rentals, the /find chat, WhatsApp, the mkan CRM,
brokers, TikTok; **`kun`** for everything else (the engine, hogwarts ops, social, jobs,
docs, other products). Pass Abdout's message **word for word** as the task — never
summarize or rewrite it. Add one line of context only when the thread makes it necessary.

```bash
bash /Users/abdout/kun/scripts/hermes/claude.sh mkan <<'TASK'
<Abdout's message, word for word>
TASK
```

A file Abdout attached: pass its local path with `--file <path>` right after the repo
name (repeat for several files).

The command returns within a second, with one line:

- **"Started — …"** → answer exactly `[SILENT]`. Claude Code posts "on it" and then its
  answer in this thread itself. Do not wait, poll, or add anything.
- **"busy"**, **"cap"** or **"Only Abdout…"** → tell Abdout that one line, nothing else.

A follow-up in the same thread ("now push it", "also fix the Arabic") → run the same
command again from that thread; it continues the same Claude session.

## Never

- Never run `claude` yourself, and never add flags or a permission mode — only this script.
- Never restate, summarize or translate Claude Code's answer; it is already in the thread.
- Never start it for anyone but Abdout (the script refuses anyway).
