# Delegation — Opus plans, lanes build

The main session is the planner and the judge: it plans, decides, reviews, and answers on
Opus. It does not grind through implementation that a cheaper lane can own. The routing table
is `engine.json → lanes` (public view: `content/docs/lanes.mdx`); keywords and MCP phrases map
to a lane in `lanes.$routes`, and the `<kun-route>` hint names it.

- **After plan approval, or any build-lane work touching 2+ files**, spawn the lane's agent
  with a written brief: goal, exact files in scope, the pattern to mirror, what is out of
  scope, and the check that proves it done.
- **build** → sonnet build agents (`block`, `nextjs`, `prisma`, `react`, `tailwind`, …) or
  `general-purpose` with `model: sonnet`.
- **mechanical** → haiku agents (`git`, `comment`, `icon`, …).
- **lookups, and batches of MCP reads** → an `Explore` agent (haiku · low).
- **research** → a sonnet · low fork. **crm** → the `lead` / `funnel` agents against Twenty.
- **judge** stays in the main loop on Opus; **escalate** (Fable) is attended sessions only.
- The main loop **reviews the diff** the agent returns — read it, run the check, then land it.
  A brief is not a hand-off of responsibility.
- **Hand-edit only** one-file or one-line changes; a brief costs more than the edit.
- **Parallel** independent agents go in one message, each with a **non-overlapping file scope**.
- **Never Fable in subagents or headless runs** — it bills usage credits with no consent prompt.
