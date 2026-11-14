# Kun (كن)

Kun is a configuration engine for Claude Code. It turns Anthropic's tools into the operating system of a small company: you say a word, and the right skill, agent, repository and model are already chosen.

Kun (كن) is Arabic for "be". Say the word, and the work follows.

## The two halves

**Kun is the word.** What should be, declared once and kept in git:

- **Keywords.** Every skill, every repository and every feature block is a word you can say in plain language. Nobody types slash commands. ([Keywords](https://kun.databayt.org/en/docs/keywords), [Places](https://kun.databayt.org/en/docs/places))
- **Lanes.** One table in `.claude/engine.json` fixes a model and an effort for each kind of work. Every agent and skill names a lane, and a script stamps the settings Claude Code reads. A lookup runs on Haiku, build work on Sonnet, a judgment on Opus; nothing unattended runs on the most expensive model.
- **Rules.** The stack rules, the block protocol, the mandate.

**Gabriel is the messenger.** One command, `gabriel`, carries a request to whoever runs it and brings the answer back:

- `gabriel route "…"` shows where the words land and on which lane.
- `gabriel run -- "…"` runs one bounded task under a contract: resume from the progress note, commit only what is green, report only what the evidence shows.
- `gabriel queue` lets a teammate ask for work on the owner's account. Nothing runs until the owner himself says yes on that ask.
- `gabriel node` lets a machine take marked issues in its idle hours.

What may run unattended, and what always waits for a person (publishing, production deploys, spending, messages to people, deletes), is written in one place and enforced by a hook. ([Gabriel](https://kun.databayt.org/en/docs/gabriel))

## Install

```bash
curl -fsSL https://kun.databayt.org/install | bash
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -Command "iwr https://kun.databayt.org/install.ps1 | iex"
```

The installer clones this repo to `~/kun` and copies the engine into `~/.claude`, where Claude Code loads it for every project. Re-run it any time; `bash ~/kun/.claude/scripts/setup.sh` refreshes an existing install. The two plugins (`kun-stack`, `kun-company`) are a lighter way in: `/plugin marketplace add databayt/kun`.

A teammate without a Claude plan works on their own lane: `d --setup`, then `d` (Claude Code on DeepSeek's endpoint with their own key).

## What is in the repo

| Path            | What it is                                                                            |
| --------------- | ------------------------------------------------------------------------------------- |
| `.claude/`      | The engine: `engine.json` (the declared truth), agents, skills, hooks, rules, scripts |
| `.claude/bin/`  | Commands the engine installs: `gabriel`, `d`, the headless wrapper                    |
| `content/docs/` | The documentation, served at [kun.databayt.org](https://kun.databayt.org/en/docs)     |
| `src/`          | The Hub: the site behind kun.databayt.org                                             |
| `plugins/`      | Generated plugin trees; never edited by hand                                          |
| `scripts/`      | The company's scheduled loops                                                         |
| `docs/`         | The canon the agents read: constitution, principles, north star, stack                |

## Checks

```bash
bash .claude/scripts/health.sh                    # counts, parity, drift
node .claude/scripts/lint-contracts.mjs --check   # every agent and skill names a lane
node .claude/scripts/resolve.mjs --test           # the router
node .claude/scripts/ledger.mjs --test            # the sharing rule
```

## Working here

Everything lands on `main`: no branches, no pull requests. Commits are small and conventional, and each one names its paths. A change to the fleet (an agent, a skill, a rule) carries its counts and its regenerated plugin in the same commit.

## Licence

Kun is licensed under the [Server Side Public License v1](LICENSE) (SSPL-1.0). A commercial licence is available from Databayt for uses the SSPL does not permit.

Databayt builds in the open and shares what it earns by a public rule. ([Share economy](https://kun.databayt.org/en/docs/share-economy))
