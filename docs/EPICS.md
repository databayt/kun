# Epics and Stories: Kun (كن)

> **Version**: 4.0 · **Refreshed**: 2026-05-25
> The earlier kun-engine roadmap (v3, dated 2026-03-30) is archived at [`docs/archive/EPICS-v3-2026-03-30.md`](archive/EPICS-v3-2026-03-30.md) — Phase 1 of that plan is shipped; Phase 2/3 epics were superseded by the Q3 2026 hogwarts-execution framing.

## Where the live work lives

| Surface | What it carries |
|---------|-----------------|
| [Sprint Plan](https://kun.databayt.org/en/docs/sprint) (`content/docs/sprint.mdx`) | 14 epics for Q3 2026 — owners, maturity, cash position, machine-readiness, non-tech tracks |
| [Epics](https://kun.databayt.org/en/docs/epics) (`content/docs/epics.mdx`) | The GitHub tracker map — each epic links to its rollup issue |
| [`kun#76`](https://github.com/databayt/kun/issues/76) | Q3 master tracker (sprints S0–S10, exit gates, runway) |
| [`hogwarts#313–316`](https://github.com/databayt/hogwarts/issues?q=is%3Aissue+label%3Aepic) | Per-bet epic trackers in the product repo |
| `hogwarts/src/components/<feature>/{README,ISSUE,CLAUDE}.md` | The trio — code-side truth per epic (see [Issue pipeline](https://kun.databayt.org/en/docs/issue#component-trio-claudemd--readmemd--issuemd)) |

## Why this file is slim

Epic narrative + sprint timeline + owners now live in `content/docs/{sprint,epics}.mdx` so they render on `kun.databayt.org` and stay close to the rest of the docs. The GitHub tracker is the source of truth for status. This file exists only to:

1. Pin the v3 archive (so the kun-engine Phase 1/2/3 plan is still recoverable).
2. Hand you off to the live surfaces above.
3. Match the `docs/` directory shape that other repos look up (`PROJECT-BRIEF.md`, `ARCHITECTURE.md`, `PRD.md`, `EPICS.md`, …).

For anything operational — what's open, who owns it, when it ships — read [Sprint Plan](https://kun.databayt.org/en/docs/sprint).
