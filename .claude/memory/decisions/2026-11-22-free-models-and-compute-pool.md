# Free model routes and the compute pool are opt-in; the company pays $0

**ID**: D-20261122-free-models-and-compute-pool
**Date**: 2026-11-22
**Decided by**: founder (Abdout)
**Type**: 2 (reversible; both are settings a person can switch off)
**Status**: decided
**Reviewed-by**: 2026-12-06
**Tags**: #machine #economy #security #pool

## Decision

1. **Free model routes are opt-in for everyone.** Machine can run the Claude Code CLI on NVIDIA's free
   Nemotron (through Free Claude Code), on OpenRouter, or on OmniRoute. Claude on the person's own sign-in
   stays the default. The company pays $0: any OpenRouter credit (the $10 top-up that lifts the free cap) is
   the person's own money. **Client code stays on Claude**, because a free provider can read what a run sends.
2. **The compute pool is opt-in.** A machine lends idle capacity only after its owner turns on "Share when
   idle". Only allow-listed job kinds run (`transcribe`, `render`, `encode`), each a fixed template with
   validated parameters, never raw commands. **Claude runs are never a pool kind**: they would burn the
   donor's personal subscription. Files travel through presigned S3 links under `pool/<jobId>/` and
   **expire after 7 days**.

## Context

The Max plan is subscription-only (no usage credits). Heavy media work (whisper, Blender, ffmpeg) sits on
the machines of people who are asleep or away. Free routes widen what a teammate can do at zero cost;
the pool puts idle machines to work. Both ship in the Machine app; kun serves `/api/machine/pool/*`.

## Expected outcome

- **Success looks like**: a teammate switches the route in Settings and chats on a free model; a film's
  encode runs on an idle teammate's Mac and the result downloads.
- **Failure looks like**: client code sent to a free provider, a donor's machine slowed while they work, or
  files left in the bucket.
- **Probability of success**: 0.75
- **Reasoning**: both are off by default and reversible; the pool claim is a compare-and-swap with a 2-claim
  cap, and donors release a job the moment the person returns.

## Alternatives considered

1. **Company pays for OpenRouter credit for everyone**: rejected, it breaks the $0 posture.
2. **Pool that also runs Claude Code jobs**: rejected, it spends a donor's personal subscription.
3. **Do nothing**: rejected, free routes and idle machines are free capacity.

## Action

- Owner: Abdout (merge and deploy), Machine app (routes and donor loop)
- Due: 2026-11-30
- Next checkpoint: 2026-12-06
- Manual: add an S3 lifecycle rule expiring the `pool/` prefix of `databayt-cdn` after 7 days.
