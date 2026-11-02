#!/usr/bin/env python3
"""Put every scheduled engine job's launchd plist behind ~/.claude/bin/job-run.sh (2026-11-02).

  python3 wrap-plists.py [--dry] [--job <name>]

A job's ProgramArguments become: /bin/bash ~/.claude/bin/job-run.sh <job> -- <its old arguments>.
Idempotent: a wrapped plist is left alone; an installer that rewrote one gets wrapped again (the
supervisor calls this every tick). Only scheduled jobs: daemons (cadence 0) and WatchPaths triggers
keep their own entry. A job is reloaded only when it is not running — a bootout would kill the run;
it is reported "pending" and the next call finishes it. The first original is kept in
~/.claude/state/plist-backup/<label>.plist.
"""
import json
import os
import plistlib
import subprocess
import sys

HOME = os.path.expanduser("~")
ENGINE = os.path.join(os.environ.get("KUN_DIR", os.path.join(HOME, "kun")), ".claude", "engine.json")
WRAPPER = os.path.join(HOME, ".claude", "bin", "job-run.sh")
BACKUP = os.path.join(HOME, ".claude", "state", "plist-backup")
DOMAIN = f"gui/{os.getuid()}"


def running(label):
    out = subprocess.run(["launchctl", "print", f"{DOMAIN}/{label}"], capture_output=True, text=True).stdout
    return "\tstate = running" in out


def main(argv):
    dry = "--dry" in argv
    only = argv[argv.index("--job") + 1] if "--job" in argv else None
    jobs = json.load(open(ENGINE)).get("jobs", {})
    changed = 0
    for name, j in jobs.items():
        if name.startswith("$") or name.startswith("hermes:") or (only and name != only):
            continue
        label = j.get("label")
        if not label or j.get("kind") == "trigger" or float(j.get("cadence_hours", 24)) == 0:
            continue
        path = os.path.join(HOME, "Library", "LaunchAgents", f"{label}.plist")
        if not os.path.exists(path):
            continue
        with open(path, "rb") as f:
            pl = plistlib.load(f)
        args = pl.get("ProgramArguments") or ([pl["Program"]] if pl.get("Program") else [])
        if WRAPPER in args[:2]:
            continue
        new = ["/bin/bash", WRAPPER, name, "--"] + args
        print(f"{'would wrap' if dry else 'wrap'} {name}: {' '.join(args)[:110]}")
        if dry:
            continue
        os.makedirs(BACKUP, exist_ok=True)
        keep = os.path.join(BACKUP, f"{label}.plist")
        if not os.path.exists(keep):
            with open(keep, "wb") as f:
                plistlib.dump(pl, f)
        pl.pop("Program", None)
        pl["ProgramArguments"] = new
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            plistlib.dump(pl, f)
        os.replace(tmp, path)
        changed += 1
        if running(label):
            print(f"  pending reload: {label} is running (the next call reloads it)")
            continue
        subprocess.run(["launchctl", "bootout", f"{DOMAIN}/{label}"], capture_output=True)
        r = subprocess.run(["launchctl", "bootstrap", DOMAIN, path], capture_output=True, text=True)
        print(f"  reloaded {label}" if r.returncode == 0 else f"  ! bootstrap {label}: {r.stderr.strip()[:160]}")
    # A wrapped plist whose loaded copy is still the old one (it was running last time): reload now.
    for name, j in jobs.items():
        if name.startswith("$") or not j.get("label") or (only and name != only):
            continue
        label, path = j["label"], os.path.join(HOME, "Library", "LaunchAgents", f"{j['label']}.plist")
        if not os.path.exists(path):
            continue
        out = subprocess.run(["launchctl", "print", f"{DOMAIN}/{label}"], capture_output=True, text=True).stdout
        with open(path, "rb") as f:
            want = WRAPPER in (plistlib.load(f).get("ProgramArguments") or [])[:2]
        if want and out and WRAPPER not in out and not running(label):
            print(f"{'would reload' if dry else 'reload'} {name} (loaded copy predates its wrapper)")
            if not dry:
                subprocess.run(["launchctl", "bootout", f"{DOMAIN}/{label}"], capture_output=True)
                subprocess.run(["launchctl", "bootstrap", DOMAIN, path], capture_output=True)
                changed += 1
    if not changed and not dry:
        print("every scheduled job already runs through job-run.sh")


if __name__ == "__main__":
    main(sys.argv[1:])
