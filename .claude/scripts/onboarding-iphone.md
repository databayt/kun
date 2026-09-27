# Computer Onboarding — iPhone

> Step-by-step checklist for setting up an iPhone for databayt work.
> Time: ~10 minutes. The phone is a remote control for your Mac; no code runs on it.

## Prerequisites

- Apple ID signed in
- Wi-Fi connected
- iCloud Keychain enabled (Settings > Apple ID > iCloud > Passwords & Keychain)
- Your Mac already onboarded (Claude Code signed in with the same claude.ai account)

---

## Apps to Install (App Store)

- [ ] **Claude**: chat, voice, and the **Code** tab that drives your Mac (search "Claude by Anthropic", or run `/mobile` in Claude Code for a QR code)
- [ ] **GitHub Mobile**: repos, issues, code review
- [ ] **Slack**: team communication (databayt-sh workspace)

### Optional

- [ ] **Outlook**: company email (hi@databayt.org)
- [ ] **Wispr Flow**: system-wide voice dictation

---

## Claude app: sign in and allow push

1. Open the Claude app and sign in with the **same account and organization** you use for Claude Code in the terminal.
2. Accept the notification prompt. Then **Settings → Notifications → Claude**: Allow Notifications on, **Time Sensitive** on.
3. **Focus modes and notification summaries delay or hide pushes.** Add Claude to the allowed apps of every Focus you use (Settings → Focus → each focus → Apps → Add).
4. Tap **Code** in the app's navigation. Sessions running on your Mac show a computer icon with a green dot.

Push is already switched on by the kun engine (`agentPushNotifEnabled` + `inputNeededNotifEnabled` in settings). If `/config` on the Mac says **"No mobile registered"**, open the Claude app once; the warning clears the next time Remote Control connects.

---

## On the Mac (the host machine only)

```bash
bash ~/.claude/scripts/devices.sh --install   # presence service + the kun-rc Remote Control server
bash ~/.claude/scripts/devices.sh --status    # everything should be ✓
```

- **Presence** holds pushes while you're at the Mac (input in the last 3 minutes, screen unlocked), so the phone buzzes only when you're away.
- **kun-rc** keeps one `claude remote-control` server alive in tmux. It shows up in the Code tab as **Mac · kun**, where you can start new sessions on the Mac without leaving a terminal open.
- Keep the Mac **on power with the lid open** (or docked to a display). A closed lid sleeps it, and a sleeping Mac is unreachable.

---

## What to do from the phone

| You want                                 | In the Claude app                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Check on or steer work already running   | Code → the session (answer questions, `/model`, `/effort`, attach a photo) |
| Start new work on the Mac                | Code → **Mac · kun**                                                       |
| Work that must continue with the Mac off | Code → new cloud session on a GitHub repo                                  |
| Think, draft, ask                        | A normal chat (cheapest; no repo context)                                  |

Photos you attach land on the Mac in `~/.claude/uploads/`, and other files are passed to Claude as `@` references. Reports come back to you as files (SendUserFile) or private Artifact links.

---

## Voice

- In the Claude app: the microphone in any chat, or dictate into a Code session.
- On the Mac, Claude Code has hold-to-talk voice input (`voice` in settings, already on).

---

## Verification Checklist

- [ ] Claude app signed in; the Code tab lists **Mac · kun** with a green dot
- [ ] A test: Code → Mac · kun → "say hi and push me a notification", then lock the Mac and wait for the push
- [ ] GitHub app shows the databayt repos
- [ ] Safari autofills from iCloud Keychain
- [ ] Claude is on the allowed list of each Focus mode

---

## Team-Specific Notes

| Person | iPhone Model | Extra Setup                                          |
| ------ | ------------ | ---------------------------------------------------- |
| Abdout | iPhone 16e   | Host Mac runs `devices.sh`; Wispr Flow for dictation |
| Samia  | iPhone 13    | Claude voice mode primary                            |

---

_This checklist is part of the Kun Engine onboarding suite._
_Re-read: `~/kun/.claude/scripts/onboarding-iphone.md` · Lane status: `bash ~/.claude/scripts/devices.sh --status`_
