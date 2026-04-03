# Agile Methodology: Databayt (داتابايت)

> **Version**: 1.0
> **Date**: 2026-04-03
> **Framework**: Kun Agile — AI-Native Scrum for Small Teams

---

## 1. Philosophy

### The 4+40 Principle

Databayt is not a 4-person team. It is 4 humans + 40 AI agents. The humans are strategists — they decide what to build, verify quality, close deals, and handle the physical world. The agents are executors — they write code, run QA, generate reports, and facilitate ceremonies.

**Agile ceremonies exist for human coordination, not agent management.**

### Four Pillars

| Pillar | What It Means |
|--------|---------------|
| **Keyword-native** | Ceremonies are keywords (`/sprint-plan`, `/standup`, `/retro`), not calendar events |
| **Async-first** | Every ceremony works asynchronously via Dispatch. Sync meetings are optional enhancements |
| **Zero new tooling** | GitHub Issues + Projects, Apple Notes Dispatch, Claude. No Jira, no Linear, no Notion |
| **AI-facilitated** | The captain agent runs ceremonies. Humans review, approve, and decide |

### What This Replaces

| Before | After |
|--------|-------|
| Ad-hoc priorities (Abdout decides alone in his head) | Visible sprint goals with ICE-scored backlogs |
| No standups | 3 async standups/week, auto-generated from system state |
| No retrospectives | Keep/change/try retro every 2 weeks |
| Invisible business work (Ali's sales, Samia's research, Sedon's ops) | Tracked as GitHub Issues with dedicated types |
| "Build passes" = done | 4 Definitions of Done by work type |
| No velocity measurement | Auto-calculated from issue metadata |

### What This Preserves

Everything that already works stays untouched:

- Keyword-driven development (`feature`, `report`, `qa`, `deploy`)
- Feature pipeline (`idea` → `spec` → `schema` → `code` → `wire` → `check` → `ship` → `watch`)
- 5-pass QA handover (bug-free, flow, responsive, RTL, translation)
- Captain weekly rhythm (Monday plan, Wednesday check, Friday review)
- Dispatch communication (Apple Notes async)
- Bridge handoff (Cowork ↔ Code)
- GitHub Issues with 22 labels and 3 milestones
- Report pipeline (auto-fix user-reported issues)

---

## 2. Roles

### Role Map

| Agile Role | Person | Core Duty | AI Delegation |
|------------|--------|-----------|---------------|
| **Product Owner** | Abdout | Sprint goals, architecture, final approval | `product` agent writes stories and ICE scores; Abdout approves |
| **QA Lead** | Ali | Judgment QA, client demos, sales pipeline | `quality-engineer` agent runs automated QA; Ali does human judgment passes |
| **Research Lead** | Samia | Vision input, R&D, Kun caretaking | `growth` agent drafts content; Samia reviews and directs via screen reader |
| **Operations Lead** | Sedon | Saudi ops, physical tasks, reliable delivery | `ops` agent monitors infrastructure; Sedon executes physical tasks |
| **Scrum Facilitator** | captain agent | Runs all ceremonies, tracks metrics, generates reports | N/A — IS the AI |

### Role Details

**Abdout — Product Owner**
- Scarce resource: decision-making and architecture, not keystrokes
- Approves sprint goals, story selection, and scope cuts
- Reviews AI-generated code for architecture alignment
- Writes specs for complex features; delegates routine features to pipeline

**Ali — QA Lead + Business Development**
- QA is a sprint commitment (assigned URLs and checklists)
- Sales is a kanban stream (tracked separately, never competes with QA)
- Presents sprint demos to clients (Ahmed Baha / King Fahad Schools)
- Reports bugs on GitHub Issues (not WhatsApp)

**Samia — Research Lead**
- Receives time-boxed research spikes (1 week max)
- Reviews via screen reader (all artifacts must be plain text accessible)
- Strategic input on sharing economy, revenue models, partnerships
- Taking over Kun caretaking (agent configuration via Cowork)

**Sedon — Operations Lead**
- Receives a Monday Map every sprint planning day
- Delivers by Friday — batch-oriented, weekly cadence
- Saudi operations: bank, physical presence, payments, logistics
- Confirms completion via Dispatch or GitHub Issue comment

---

## 3. Sprint Structure

### Cadence

```
Sprint: 2 weeks (10 working days)

WEEK 1
  Monday    → Sprint Planning (/sprint-plan)
  Wednesday → Async Standup (/standup)
  Friday    → Async Standup (/standup)

WEEK 2
  Monday    → Async Standup (/standup)
  Wednesday → Backlog Refinement (/refine) + Standup
  Friday    → Sprint Review + Retrospective (/sprint-review)
```

### Mapping to Captain Rhythm

The captain agent already operates on a Monday/Wednesday/Friday rhythm. The agile ceremonies overlay precisely:

| Day | Captain Rhythm | Agile Ceremony |
|-----|---------------|----------------|
| Week 1 Monday | Plan | **Sprint Planning** |
| Week 1 Wednesday | Check | Standup |
| Week 1 Friday | Review | Standup |
| Week 2 Monday | Plan | Standup |
| Week 2 Wednesday | Check | **Backlog Refinement** + Standup |
| Week 2 Friday | Review | **Sprint Review + Retro** |

### Sprint Calendar (S1–S5)

| Sprint | Dates | Planning | Refinement | Review + Retro |
|--------|-------|----------|------------|----------------|
| **S1** | Apr 1–14 | Mon Apr 7* | Wed Apr 9 | Fri Apr 11 |
| **S2** | Apr 15–30 | Mon Apr 15 | Wed Apr 23 | Fri Apr 25 |
| **S3** | May 1–14 | Mon May 1 | Wed May 7 | Fri May 9 |
| **S4** | May 15–31 | Mon May 15 | Wed May 21 | Fri May 23 |
| **S5** | Jun 1–14 | Mon Jun 2 | Wed Jun 9 | Fri Jun 13 |

*S1 is mid-sprint when this methodology starts. First full ceremony cycle begins with S1 Review on April 11.

---

## 4. Ceremonies

### 4.1 Sprint Planning (`/sprint-plan`)

**When**: First Monday of each sprint
**Duration**: 15 min sync (optional) or async via Dispatch
**Facilitator**: captain agent

#### AI Does

1. Pull previous sprint velocity (completed story points)
2. Pull top backlog items sorted by ICE score (via `product` agent)
3. Generate sprint goal based on epic priorities and business context
4. Calculate capacity:
   - Abdout: 80 hrs (full-time engineering)
   - Ali: 40 hrs QA + 20 hrs sales
   - Samia: 20 hrs research
   - Sedon: 10 hrs ops
5. Propose story selection that fits capacity
6. Generate Sedon's Monday Map (physical tasks for the week)
7. Generate Samia's research spike list
8. Post draft to Dispatch/Captain

#### Humans Do

1. **Abdout**: Reviews and approves/adjusts sprint goal and stories
2. **Ali**: Confirms QA capacity, flags sales commitments that conflict
3. **Samia**: Confirms research priorities (via Cowork or Dispatch)
4. **Sedon**: Receives Monday Map via Dispatch

#### Artifacts Produced

- Sprint goal (pinned GitHub Issue)
- Stories moved to "Sprint" column on board
- Sedon's Monday Map (Dispatch/Captain)
- Samia's research spike list

---

### 4.2 Async Standup (`/standup`)

**When**: Monday, Wednesday, Friday (non-ceremony days)
**Duration**: 0 min — fully async, AI-generated
**Facilitator**: captain agent

#### AI Does

1. Read git commits since last standup (all active repos)
2. Read GitHub Issues opened/closed/commented
3. Check deployment status (Vercel)
4. Check error rates (Sentry)
5. Generate standup report:
   - **Shipped**: What was completed
   - **Blocked**: What is stuck and why
   - **Next**: What is planned for today/tomorrow
   - **Anomalies**: Anything unusual (failed deploys, error spikes, unplanned work)
6. Post to Dispatch/Captain

#### Humans Do

1. Read Dispatch on phone (iCloud syncs to all devices)
2. Reply to Dispatch/Inbox **only if something needs to change**
3. Ali adds sales activity notes to his `type:sales` issues if relevant

#### Key Principle

> Humans do not write standups. They read them and intervene on exceptions. The system is the source of truth, not self-reported status.

---

### 4.3 Sprint Review + Retrospective (`/sprint-review`)

**When**: Last Friday of each sprint
**Duration**: 30 min (15 min demo + 15 min retro) or fully async
**Facilitator**: captain agent

#### Sprint Review — AI Does

1. Generate demo script: shipped features with URLs and screenshots
2. Calculate velocity: planned points vs. completed points
3. Generate burndown from issue close dates
4. Take production screenshots of shipped features (browser MCP)
5. Compile client-facing demo brief (for Ali to present to Ahmed Baha)
6. List incomplete stories with reasons

#### Sprint Review — Humans Do

1. **Abdout**: Walks through technical demo (or delegates to Ali for client)
2. **Ali**: Presents sales pipeline update and client feedback
3. **Samia**: Shares research findings (async written summary if unavailable)
4. **Sedon**: Reports on ops deliverables (async via Dispatch)

#### Retrospective — AI Does

1. Generate quantitative observations:
   - Velocity trend (improving, flat, declining)
   - Error rate trend
   - Deployment frequency
   - Bug cycle time
2. Note anomalies ("3 stories blocked by the same dependency", "no sales issues closed")
3. Post three prompts to Dispatch/Captain

#### Retrospective — Humans Do

Answer three questions (async, 1–2 bullets each):

1. **Keep** — What should we keep doing?
2. **Change** — What should we change?
3. **Try** — What should we try next sprint?

**Abdout picks one action item** → becomes a GitHub Issue labeled `retro:action` → committed to next sprint.

#### Key Principle

> Sprint Review doubles as client demo. Ali can screen-share the demo brief with Ahmed Baha. This makes client engagement a natural output of the process.

---

### 4.4 Backlog Refinement (`/refine`)

**When**: Second Wednesday of each sprint
**Duration**: Fully async
**Facilitator**: `product` agent + captain agent

#### AI Does

1. Identify all open issues without ICE scores
2. Score each using ICE framework (Impact × Confidence × Ease)
3. Identify issues missing specifications
4. Generate Definition of Ready checklist for top 10 items
5. Flag issues with unresolved dependencies
6. Post refinement summary to Dispatch/Captain

#### Humans Do

1. **Abdout**: Adjusts ICE scores where AI misjudged complexity or impact
2. **Ali**: Adds market signal notes ("schools keep asking for X")
3. **Samia**: Adds research context to relevant issues

#### Key Principle

> Refinement is 90% AI, 10% human adjustment. The product agent does the heavy lifting. Humans correct and add context that AI cannot observe.

---

## 5. Artifacts

### 5.1 GitHub Projects Board

Seven columns, progressing left to right:

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐
│  Icebox  │→│ Backlog  │→│  Sprint  │→│In Progress │→│ In Review │→│   Done   │ │ Business │
│          │ │          │ │          │ │            │ │           │ │          │ │          │
│ Unrefined│ │ Refined  │ │ Committed│ │ Active work│ │ QA/verify │ │ Shipped  │ │ Sales    │
│ ideas    │ │ ICE score│ │ this     │ │ branch     │ │ human     │ │ verified │ │ Research │
│          │ │ DoR met  │ │ sprint   │ │ created    │ │ check     │ │ deployed │ │ Ops      │
└──────────┘ └──────────┘ └──────────┘ └────────────┘ └───────────┘ └──────────┘ └──────────┘
```

| Column | Entry Trigger | Exit Trigger |
|--------|--------------|--------------|
| Icebox | New issue created | ICE score assigned + DoR met |
| Backlog | `refined` label added | Added to sprint during `/sprint-plan` |
| Sprint | Sprint Planning commits it | First commit or branch created |
| In Progress | Work begins | PR opened or `needs-qa` label |
| In Review | Ready for QA/verification | All DoD criteria met |
| Done | Issue closed | — |
| Business | `type:sales`, `type:research`, or `type:ops` label | Issue closed with evidence |

### 5.2 Labels (Extending Existing 22)

**New labels to add:**

| Label | Color | Purpose |
|-------|-------|---------|
| `type:sales` | Green | Ali's sales pipeline work |
| `type:research` | Purple | Samia's R&D spikes |
| `type:ops` | Orange | Sedon's physical operations |
| `type:business` | Blue | Generic business work |
| `refined` | Teal | Has ICE score + DoR met |
| `retro:action` | Red | Action item from retrospective |
| `sprint:N` | Gray | Assigned to sprint N |

### 5.3 Definition of Ready (DoR)

A story is ready for sprint commitment when:

- [ ] User story format: "As a [role], I want [action], so that [outcome]"
- [ ] Acceptance criteria: testable checklist (3–7 items)
- [ ] ICE score assigned (Impact × Confidence × Ease, each 1–10)
- [ ] Story points estimated (1, 2, 3, 5, 8)
- [ ] Dependencies resolved or identified
- [ ] Product and repo labels assigned

For business items, add:
- [ ] Clear deliverable (document, email, setup, etc.)
- [ ] Verification method (how we know it's done)

### 5.4 Definition of Done (DoD)

#### Technical Stories

- [ ] Code committed (conventional commit format)
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm build` passes
- [ ] Visual verification via browser MCP (screenshot on issue)
- [ ] i18n: Arabic and English dictionary keys present
- [ ] RTL: Verified in Arabic locale
- [ ] Responsive: Verified at 375px, 768px, 1440px
- [ ] Deployed to production (Vercel)
- [ ] Post-deploy screenshot clean
- [ ] Issue closed with summary comment

#### QA Stories

- [ ] All 5 QA passes completed (bug-free, flow, responsive, RTL, translation)
- [ ] All bugs filed as separate GitHub Issues
- [ ] Regression check: previously fixed bugs still fixed
- [ ] Issue closed with pass/fail summary

#### Business Stories (Sales, Outreach)

- [ ] Deliverable produced (proposal, email, meeting notes, etc.)
- [ ] Evidence attached to issue (screenshot, link, document)
- [ ] Next action identified (follow-up date, next step)
- [ ] Issue closed with outcome summary

#### Ops Stories

- [ ] Task completed (bank action, server config, payment, logistics)
- [ ] Confirmation provided (receipt, screenshot, status update)
- [ ] Issue closed with verification proof

---

## 6. Work Types and Flows

### 6.1 Feature Work (Engineering)

```
IDEA → SPEC → [approve] → SCHEMA → CODE → WIRE → CHECK → SHIP → WATCH
```

Existing `/feature` pipeline. Sprint-committed. Moves through board: Sprint → In Progress → In Review → Done.

**Owner**: Abdout + AI agents
**Tracking**: GitHub Issue with `enhancement` label + `sprint:N` label

### 6.2 Bug Fixes

```
REPORT → LOCATE → VALIDATE → FIX → BUILD → PUSH → VERIFY → CLOSE
```

Existing `/report` pipeline. **Kanban-style** — pulled from queue, not sprint-committed, unless P0/P1 severity.

**Owner**: AI agents (auto-fix) or Abdout (complex bugs)
**Tracking**: GitHub Issue with `bug` + `report` labels

### 6.3 QA Work

```
HANDOVER → 5-PASS QA → FILE BUGS → RE-VERIFY → APPROVE
```

Existing handover pipeline. Sprint-committed — Ali gets a list of URLs and checklists each sprint.

**Owner**: Ali (human judgment) + `quality-engineer` agent (automated checks)
**Tracking**: GitHub Issue with `qa` label + checklist

### 6.4 Sales Work (NEW)

```
LEAD → RESEARCH → PITCH → FOLLOW-UP → CONVERT or CLOSE
```

Kanban-style — Ali manages his pipeline. Not sprint-committed (sales has its own rhythm).

**Owner**: Ali + `revenue` agent (proposal generation)
**Tracking**: GitHub Issue with `type:sales` label

**Stages (tracked as issue labels):**
| Stage | Label | Action |
|-------|-------|--------|
| Lead identified | `sales:lead` | Research the prospect |
| Pitch prepared | `sales:pitch` | Send proposal or schedule meeting |
| Follow-up | `sales:followup` | Waiting for response |
| Won | `sales:won` | Convert to customer |
| Lost | `sales:lost` | Document reason, close |

### 6.5 Research Spikes (NEW)

```
QUESTION → RESEARCH → FINDINGS → APPLY or ARCHIVE
```

**Time-boxed**: 1 week maximum. If not answered in a week, archive with what was found.

**Owner**: Samia + `growth` agent (drafts, summaries)
**Tracking**: GitHub Issue with `type:research` label

**Format:**
```markdown
## Research Spike: [Question]
**Deadline**: [1 week from creation]
**Context**: Why we need to know this

## Findings
[Samia posts findings as comments]

## Recommendation
[Final recommendation or "needs more work"]

## Action Items
[Spawned issues if actionable]
```

### 6.6 Ops Tasks (NEW)

```
MONDAY MAP → EXECUTE → CONFIRM → CLOSE
```

Batch-oriented. Captain agent generates Monday Map during sprint planning. Sedon executes during the week. Confirms completion via Dispatch or issue comment.

**Owner**: Sedon + `ops` agent (monitoring, checklists)
**Tracking**: GitHub Issue with `type:ops` label

**Monday Map format:**
```markdown
## Monday Map — Week of [date]

### Must Do (this week)
- [ ] Task 1 — [details, deadline]
- [ ] Task 2 — [details, deadline]

### Should Do (if time permits)
- [ ] Task 3 — [details]

### Standing Items
- [ ] Check bank balance
- [ ] Confirm domain renewals
```

---

## 7. Metrics

### Automated Metrics (Captain Agent)

All metrics are auto-calculated from GitHub Issue metadata + external services. Zero manual entry.

| Metric | Source | Frequency | Target |
|--------|--------|-----------|--------|
| **Sprint Velocity** | Closed issue points per sprint | Per sprint | Trending up |
| **Burndown** | Remaining points by day | Daily | Linear decline |
| **Completion Rate** | Completed / committed stories | Per sprint | > 80% |
| **Deploy Frequency** | Vercel deployment count | Weekly | > 3/week |
| **Error Rate** | Sentry error count | Weekly | Trending down |
| **Bug Cycle Time** | Issue open → close for `bug` label | Per sprint | < 48 hours |
| **Sales Pipeline** | `type:sales` issues by stage | Weekly | Growing |
| **Research Output** | `type:research` issues closed | Per sprint | 1–2 spikes |
| **Ops Completion** | Monday Map checkbox rate | Weekly | > 90% |
| **Runway** | $5,000 − (total spend to date) | Per sprint | > 6 months |

### Sprint Health Dashboard

Generated by captain agent every Friday as part of `/sprint-review`:

```
Sprint 2 Health — April 15-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Velocity:     18 pts (prev: 15 pts) ▲
Completion:   4/5 stories (80%)     ✓
Deploys:      7 this sprint         ✓
Errors:       3 (prev: 8)          ▼ Good
Bug Cycle:    36 hrs avg            ✓
Pipeline:     2 leads, 1 pitch      →
Runway:       $4,250 (8.5 months)   ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Client-Facing Metrics (for Ahmed Baha)

Generated during Sprint Review for Ali to present:

- Features shipped this sprint (with screenshots)
- Open bug count (trending)
- Platform uptime percentage
- Next sprint preview (what's coming)

---

## 8. Communication Architecture

### Three Channels (Preserved)

| Channel | Tool | Direction | Purpose |
|---------|------|-----------|---------|
| **Dispatch** | Apple Notes (iCloud) | Captain ↔ Humans | Async ceremonies, plans, updates, Monday Maps |
| **Work Items** | GitHub Issues | All directions | All trackable work — the system of record |
| **Real-time** | Claude (Code / Cowork / Voice) | Human ↔ AI | During active work sessions |

### Communication Rules

1. **Work goes to GitHub Issues** — not WhatsApp, not Apple Notes, not DMs
2. **Status goes to Dispatch** — standups, plans, reviews auto-posted by captain agent
3. **Decisions go to Dispatch/Inbox** — Abdout's approval or direction changes
4. **Evidence goes to Issues** — screenshots, links, receipts attached to the relevant issue

### Who Reads What

| Person | Must Read | Must Write |
|--------|-----------|------------|
| Abdout | Dispatch/Captain (daily) | Dispatch/Inbox (when direction changes) |
| Ali | Dispatch/Captain (daily), assigned Issues | Issue comments (QA results, sales updates) |
| Samia | Dispatch/Captain (2x/week), research Issues | Issue comments (research findings) |
| Sedon | Monday Map in Dispatch (Monday), ops Issues | Issue comments (task confirmations) |

---

## 9. Bus Factor Mitigation

Abdout is the sole engineer. This is the biggest risk.

### Strategy 1: Agent-Executable Specs

Every feature goes through `/spec` before coding. The spec is detailed enough that a different person + AI could implement it. Specs are living documentation — they survive the original builder.

### Strategy 2: Samia as Kun Caretaker

Samia understands the agent system. If Abdout is unavailable, Samia can direct agents via Cowork for configuration changes, non-code adjustments, and agent tuning.

### Strategy 3: Ali as Quality Gate

Ali reviews every shipped feature visually. He cannot code, but he can verify "does this work as expected?" and report regression. The QA handover process works independently of who wrote the code.

### Strategy 4: Emergency Protocol

If Abdout is unavailable for 48+ hours:

1. **Captain agent activates maintenance mode**: no new features
2. **Bug fixes only**: `/report` pipeline handles user-reported issues automatically
3. **Ali triages incoming work**: labels issues, prioritizes, manages client expectations
4. **Samia directs Kun**: configuration and agent adjustments via Cowork
5. **Sedon continues ops**: physical tasks proceed from existing Monday Map
6. **Resume**: when Abdout returns, captain agent generates a "catch-up brief" summarizing what happened

---

## 10. Integration with Kun

### Ceremony Keywords

| Ceremony | Keyword | Type |
|----------|---------|------|
| Sprint Planning | `/sprint-plan` | New command |
| Async Standup | `/standup` | New command |
| Sprint Review + Retro | `/sprint-review` | New command |
| Backlog Refinement | `/refine` | New command |
| Retrospective | `/retro` | New command |

### How Ceremonies Map to Existing Systems

| Agile Element | Kun Implementation |
|---------------|-------------------|
| Sprint Planning | captain agent + product agent → Dispatch |
| Standup | captain agent reads git + issues + deploys → Dispatch |
| Sprint Review | captain agent generates demo + velocity → Dispatch |
| Backlog Refinement | product agent ICE scores → Dispatch |
| Retrospective | Template posted to Dispatch, responses collected |
| Burndown | captain agent tracks from issue close dates |
| Definition of Done | Encoded in existing `/check` + `/handover` |
| Monday Map | captain agent generates during `/sprint-plan` |
| Velocity | captain agent auto-calculates from GitHub |
| Business tracking | New `type:sales`, `type:research`, `type:ops` labels |

### Keyword Vocabulary Additions

Add to CLAUDE.md Tier 3 vocabulary:

```
sprint-plan, standup, sprint-review, refine, retro, velocity,
burndown, monday-map, capacity, pipeline, health-dashboard
```

---

## 11. Getting Started

### Immediate Actions (Sprint 1 — this week)

1. Create GitHub Projects board with 7 columns
2. Add new labels to hogwarts and kun repos
3. Run first `/sprint-review` on Friday April 11
4. Review S1 velocity and plan S2

### Sprint 2 Onward

Full ceremony cycle:
- Monday April 15: `/sprint-plan` for S2
- Wednesday/Friday: `/standup` async
- Wednesday April 23: `/refine` backlog
- Friday April 25: `/sprint-review` + `/retro`

### Success Criteria

After 3 sprints (by end of S3), the methodology is working if:

- [ ] Velocity is being measured and is trending up
- [ ] Ali's sales work is visible on the board
- [ ] Samia has completed at least 2 research spikes
- [ ] Sedon has received and completed 3+ Monday Maps
- [ ] At least 1 retro action item was implemented
- [ ] Sprint completion rate is above 80%
- [ ] Client demo has been delivered at least once

---

## 12. Principles to Remember

1. **Ceremonies serve humans, not process.** If a ceremony isn't adding clarity, skip it and investigate why.

2. **The system is the standup.** Git commits, issue closures, and deployment logs tell the truth. Self-reported status lies.

3. **Async is the default.** Synchronous meetings are for when async fails, not the other way around.

4. **AI facilitates, humans decide.** The captain agent generates proposals. Abdout approves. Never the reverse.

5. **Business work is real work.** Ali closing a sales lead is as valuable as Abdout shipping a feature. Both deserve tracking.

6. **One action item per retro.** Don't try to fix everything. Fix one thing well. Compound over sprints.

7. **Monday Map, Friday delivery.** Sedon's rhythm is the heartbeat of ops. Respect it.

8. **Quality over speed.** A shipped feature that works is worth more than three that don't. The pilot client sees our quality, not our velocity.

9. **The board is the truth.** If it's not on the board, it's not happening. If it's on the board and not moving, something is wrong.

10. **Iterate the process itself.** This methodology is v1.0. It will change. The retro is where it evolves.
