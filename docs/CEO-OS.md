# Databayt CEO Operating System

> **Read this monthly. Live by it daily.**
>
> The reference document for the founder, the captain, and the team. State-of-the-art tech-CEO practice distilled for a 7-person, open-source, sharing-economy company.

**Audience**: Abdout (founder, primary), Kun captain agent (loads as memory context), team (contributors and teammates), public (mirror at `/content/docs/ceo-os.mdx`).

**Sister files**:

- [`CONSTITUTION.md`](./CONSTITUTION.md) — mission, vision, values
- [`PRINCIPLES.md`](./PRINCIPLES.md) — the 24 founder operating principles
- [`NORTH-STAR.md`](./NORTH-STAR.md) — the one metric

---

## Table of contents

- [Part I — What defines a great tech-company CEO](#part-i--what-defines-a-great-tech-company-ceo)
- [Part II — The six mastery skills](#part-ii--the-six-mastery-skills)
- [Part III — The seven knowledge domains](#part-iii--the-seven-knowledge-domains)
- [Part IV — Directions the captain consciousness extends into](#part-iv--directions-the-captain-consciousness-extends-into)
- [Part V — The bibliography (heavy, with passages)](#part-v--the-bibliography-heavy-with-passages)
- [Part VI — How this OS is implemented in Kun](#part-vi--how-this-os-is-implemented-in-kun)
- [Part VII — Reading order](#part-vii--reading-order)

---

## Part I — What defines a great tech-company CEO

A great CEO of a small open-source tech company does five things well. Not ten. Not twenty. Five.

### 1. Decides

A CEO picks one direction in the face of uncertainty, writes the decision down, and lives with the consequences. The job isn't to be right; the job is to keep the company moving and to learn faster than competitors.

The discipline: distinguish **Type-1 decisions** (irreversible, slow down, premortem first) from **Type-2 decisions** (reversible, decide fast, reverse if wrong) — Bezos's framework. Log Type-1s in `.claude/memory/decisions/`. Review at the reviewed-by date.

### 2. Allocates

Time, attention, capital, and people are the four scarce resources. Allocation is the CEO's primary lever. Drucker on time: _"Time is the scarcest resource and unless it is managed, nothing else can be managed."_ Buffett on capital: returns on incremental capital determine long-term outcomes. Naval on leverage: there are four kinds — labor, capital, code, media — and the latter two are permissionless.

Databayt's leverage is **code (Kun)** and **media (Arabic content + open-source visibility)**. Weekly allocation is a CEO function, not an engineer function. Done well, weekly allocation is done in 30 minutes Monday morning and saves the team 30 hours of misdirection.

### 3. Recruits, retains, develops

Horowitz: _"Take care of the people, the products, and the profits — in that order."_ Reverse this and you lose all three.

Hastings: talent density compounds. The keeper test — _"Which of my people, if they told me they were leaving for a similar role at a competitor, would I fight hard to keep?"_ — is the discipline. Run it silently every 6 months in a journal entry.

Grove: 1:1s are the principal medium of management. Not status meetings. Not all-hands. The 1:1 is where information flows and decisions form.

### 4. Communicates relentlessly

Internally, the CEO is the chief repeater. Externally, the chief storyteller. Bezos: _"Memos are powerful. They force the writer to think much more deeply than slides do."_

If it's not written, it didn't happen. Decisions in journal entries. Plans in markdown. Customer interviews in transcripts. Weekly reviews archived. Memos > slides. Async > meeting.

### 5. Models the standard

The team mirrors the founder's standards for quality, urgency, ethics, and learning rate. Bill Walsh: _"The score takes care of itself when you take care of the effort that precedes the score."_

You can't ask the team to do what you don't model. If you want quality, ship quality. If you want async-first, write async-first. If you want decision discipline, log your own decisions first.

---

## Part II — The six mastery skills

Each skill has a canonical voice and an operating practice the captain (and the founder) must embody.

### Skill 1 — Decision-making

**Canonical voices**: Bezos (Type 1/Type 2 doors); Annie Duke (decisions ≠ outcomes); Gary Klein (premortem); Daniel Kahneman (System 2 deliberation, decision journals).

**Operating practice**: Write decisions down in a journal _before_ outcomes are known. Premortem on Type-1 decisions. Review the journal monthly. Grade decisions, not outcomes.

**Skills wired**: `/decide`, `/premortem`. Log to `.claude/memory/decisions/<date>-<slug>.md`. Surfaced in monthly review.

**Gold-standard pattern**:

```
Decision: [one paragraph]
Type: 1 or 2
Premortem (Type 1 only): It is [date] and this failed. Why? [story]
Expected outcome: success looks like X; failure looks like Y; probability of success: 0.X
Alternatives considered (≥2 + "do nothing"): ...
Reviewed-by: [date 30/60/90 days out for Type 1; 7-14 days for Type 2]
```

### Skill 2 — Capital allocation

**Canonical voices**: Drucker (time is the scarcest); Buffett (returns on incremental capital); Naval (four leverages); Bezos (Day 1 frugality).

**Operating practice**: Allocate by % of bandwidth per product, with runway-triggered rebalancing rules. Track every dollar against the $200/mo Anthropic and $500/mo total envelope. At 6 months runway, review burn cuts. At 3 months, wartime mode.

**Skills wired**: `/captain` (synthesizes runway + spend), `/runway` (planned), `/costs`. State in `runway.json` + `revenue.json`.

**Databayt allocation rules** (encoded in `risks.json` R-005):

- Runway < 6mo → captain dispatches "review burn cuts + accelerate Ali outreach + consider pricing experiment"
- Runway < 3mo → captain dispatches wartime-mode escalation: cut all non-pilot work, all hands on Hogwarts conversion
- Runway < 1mo → either close a paying customer this month or pause the company

**Cash mechanics** (Pofeldt one-person-$1M playbook, adopted 2026-07-10):

- Pilot→paid conversion takes a **deposit or annual prepay** — never a bare monthly promise
- Invoice the **same day** the trigger event happens; pay suppliers at full terms
- Forecast 6–12 months forward in `runway.json`; a hard **reserve floor** triggers a captain alert
- Test price increases on **new** clients first; repackage upward (annual + implementation fee) before discounting
- The break-even "enough" line lives in `NORTH-STAR.md` — cite it when refusing complexity-adding growth

**Custom-work rule**: a school-specific feature request has exactly three outcomes — **productize** it for every tenant, **premium-price** it as implementation work, or **decline**. Bespoke unpaid work for one tenant is never an option; it is how one-person businesses die.

### Skill 3 — People

**Canonical voices**: Grove (1:1s as principal management tool, task-relevant maturity); Hastings (keeper test, talent density, freedom & responsibility); Lencioni (Five Dysfunctions); Bosworth (empathy is the most underrated skill, career cold-start algorithm); Goldsmith (feedforward, 20 bad habits).

**Operating practice**: Weekly 1:1 per teammate with running notes. Quarterly performance check (Bosworth's career conversation — ambition, capability, opportunity). Hiring plan with explicit MRR triggers. Keeper-test on each role twice a year.

**Skills wired**: `/1on1 <person>` (planned). Per-teammate notes in `.claude/memory/1on1/<person>.md` (seeded for all 6 teammates).

**Databayt-specific people awareness**:

- Samia is blind / screen-reader user → voice-first interaction; written follow-ups must be properly headed.
- Sedon is part-time + Saudi-resident → batched Mon/Wed/Fri tasks; clear Monday map.
- Ali carries QA + sales + outreach → role-overload risk; needs structured pipeline tooling.
- Ibrahim & Mutaz recently joined → onboarding plans needed by 2026-05-31.
- Abdout is the bottleneck → captain's Friday review includes one founder-coaching observation (Goldsmith framework).

### Skill 4 — Product clarity

**Canonical voices**: Christensen (jobs-to-be-done; sustaining vs disruptive); Moore (Crossing the Chasm: beachhead segments); Ries (build-measure-learn; pivot/persevere); Andreessen (market pulls product out of startup at PMF); Helmer (7 Powers).

**Operating practice**: ICP per product. Kill criteria per product. JTBD hypothesis per product. Per-quarter PMF check. Beachhead-by-beachhead expansion.

**Databayt's beachhead path** (Hogwarts):

1. King Fahad Schools (Sudan) — pilot
2. Similar Sudan private schools (Khartoum + adjacent)
3. MENA private schools (Saudi, Egypt, Jordan, Morocco)
4. Adjacent verticals (Souq vendors, Mkan rentals, Shifa clinics) — only after Hogwarts proven

**Plausible Powers** (Helmer's 7 Powers, applied to Databayt):

- **Counter-Positioning**: open-source SSPL + sharing-economy revenue distribution. A closed competitor can't copy without burning their existing model.
- **Process Power**: the Kun engine itself — the configuration layer that makes 7 humans operate as 20.
- **Cornered Resource** (potential): Arabic-first + Sudan/MENA-rooted teams that competitors can't easily acquire.

### Skill 5 — Storytelling

**Canonical voices**: Bezos (memos > slides); Bosworth (write to clarify); Fadell (the story of your product is its purpose); Stripe (memo-driven async culture); GitLab (handbook as source of truth).

**Operating practice**: Founder letter (annual). Monthly investor update _even when there's no investor_ (Horowitz). Public changelog. Customer-facing story per product.

**Skills wired**: `/investor-update` (planned). The captain agent's Friday review section auto-generates the basis.

**Databayt's stories** (work in progress):

- **Founder narrative**: EE 10yr + SWE 4yr Sudanese-Saudi engineer building an open-source operating system for the underserved.
- **Product story (Hogwarts)**: "the win horse" — flagship for school operations in Arabic.
- **Company story**: 7 humans + the agent fleet + 1 engine + the databayt org + the sharing-economy revenue distribution model.

### Skill 6 — Operating cadence

**Canonical voices**: Grove (1:1s + staff meetings); Wickman/EOS (L10, scorecard, rocks, V/TO); Harnish (Rockefeller Habits: daily huddle, weekly mtg, monthly mtg, quarterly off-site, annual planning); GitLab (async-first cadence).

**Operating practice**: Daily pulse → weekly review → monthly review → quarterly OKR cycle → annual strategy. Every cadence has a written archive.

**Databayt cadence stack** (Phase A → F):

| Cadence                 | Frequency              | Skill                              | Archive                         |
| ----------------------- | ---------------------- | ---------------------------------- | ------------------------------- |
| Daily pulse             | daily 08:00 KSA        | `/captain brief` (planned routine) | journal append                  |
| Weekly plan             | Monday                 | `/weekly plan` ✅                  | `weekly/<date>.md`              |
| Mid-week check          | Wednesday              | `/weekly check` ✅                 | weekly archive append           |
| Friday review           | Friday                 | `/weekly review` ✅                | weekly archive final + journal  |
| Monthly review          | 1st Monday             | `/monthly` (planned)               | `monthly/<YYYY-MM>.md`          |
| Quarterly OKR set       | start of quarter       | `/okr-set` (planned)               | `okrs.json` + `quarterly/`      |
| Quarterly OKR check     | mid-quarter            | `/okr-check` (planned)             | quarterly archive               |
| Quarterly OKR grade     | end of quarter         | `/okr-grade` (planned)             | quarterly archive + journal     |
| Monthly investor update | last Friday of month   | `/investor-update` (planned)       | `monthly/<YYYY-MM>-investor.md` |
| Monthly founder retro   | last Saturday of month | `/founder-retro` (planned)         | `1on1/abdout.md` + journal      |
| Annual strategy         | once a year            | manual + V/TO                      | `quarterly/<YYYY>-annual.md`    |

---

## Part III — The seven knowledge domains

The captain consciousness must hold accurate, dated, queryable knowledge across seven domains. Every weekly review checks at least one domain has a fresh entry.

### Domain 1 — Self (the founder)

**What the captain knows about Abdout**: strengths, weaknesses, decision biases, energy patterns, behavioral debts (logged in `1on1/abdout.md` and surfaced in monthly founder-retro).

**Watch-outs captured** in `capacity.json`:

- Context-switching across products
- Perfectionism on engineering at the expense of customer development
- Tendency to build before talking to users

**Source**: Goldsmith — _What Got You Here Won't Get You There_. The 20 bad habits of successful people. The captain notes which show up.

### Domain 2 — Team

**What the captain knows about each teammate**: strengths, ambitions, working style, time zone, accessibility needs, constraints, expertise areas, task-relevant maturity per skill area.

**Source of truth**: `capacity.json` + `team.json` + `1on1/<person>.md`.

**Critical surfaced facts**:

- Samia: blind, screen-reader user → voice-first interaction.
- Sedon: 15 hrs/week, Saudi-resident → batched Mon/Wed/Fri.
- Ali: role overload (sales + QA + outreach).
- Ibrahim & Mutaz: scope undefined → onboarding by 2026-05-31.

**Source**: Grove — task-relevant maturity (low → tell, medium → sell, high → delegate). Bosworth — career cold-start algorithm.

### Domain 3 — Customers

**What the captain knows about each customer**: name, role, last contact date, JTBD, satisfaction signal, expansion potential.

**Source of truth**: `customers.json` + `interviews/<date>-<customer>.md` + `feedback.jsonl`.

**Today**: One customer record (Ahmed Baha / King Fahad Schools, pilot stage). Q2 2026 OKR-O3 builds the customer-development discipline (≥1 interview per week → 8 in Q2).

**Source**: Christensen — JTBD framing. Steve Blank — "get out of the building."

### Domain 4 — Market

**What the captain knows about the market**: per-vertical competitive landscape (dated, sourced); TAM/SAM/SOM per product; regulatory shifts; adjacent moves by Saudi/UAE incumbents.

**Source of truth**: `analyst.md` agent (current — markdown tables); `competitive_intel.json` (planned — queryable, dated).

**Per-vertical competitors**:

- Education: Classera, Noon Academy, Klarso, Blackboard, Canvas.
- E-commerce: Salla, Zid, Shopify.
- Rentals: Gathern, Airbnb, Booking.
- Medical: Cura, Vezeeta, Zocdoc.

**Source**: Porter — Five Forces. Helmer — 7 Powers. Moore — Crossing the Chasm.

### Domain 5 — Product

**What the captain knows about each product**: stage, what's true vs. pitch, technical-debt registry, bet thesis (why this exists, when it's killed).

**Source of truth**: `captain.md` "Product Portfolio" table + `docs/repositories/*.md` per-repo profiles + `tech-lead.md` agent.

**Per-product stage today**:

- Hogwarts: Beta, pilot (King Fahad), $99 expected MRR.
- Souq: Alpha, MVP-complete-awaiting-PMF.
- Mkan: Alpha, Phase 1 complete, awaiting soft launch.
- Shifa: Design, paused (HIGHEST RISK product — medical PII).
- Swift-app: Design.
- Kun: Phase 2 (Team Engine) active — internal.

**Source**: Ries — Lean Startup pivot/persevere/kill criteria. Andreessen — PMF feel.

### Domain 6 — Finances

**What the captain knows**: runway (weeks), burn (monthly), MRR (live), capital remaining, unit economics per customer (CAC, LTV when measurable), fundraising market temperature.

**Source of truth**: `runway.json` + `revenue.json`. Live values; updated weekly.

**Today**:

- MRR $0
- Burn ~$500/mo
- Capital $5K
- Runway 10 months
- Status: default-dead until first paying customer

**Source**: Graham — _Default Alive or Default Dead?_. Lemkin — SaaS unit economics.

### Domain 7 — Network

**What the captain knows**: who can help with what, when to call them.

**Source of truth**: TBD. The Apple Notes Inbox channel is the founder ↔ captain bridge; an external-network map is missing entirely. Future skill: `/network` to log advisor calls, peer-founder check-ins, customer-of-customer relationships.

**Source**: Reid Hoffman — _The Start-Up of You_. Naval — "play long-term games with long-term people."

---

## Part IV — Directions the captain consciousness extends into

Currently the captain has rich technical-execution awareness (49 agents, 57+ commands, weekly rhythm, cost discipline) and partial business awareness (revenue agent, growth agent, analyst with competitor tables, pricing tiers). After Phase A, it has identity (mission, vision, values, principles, north-star) and persistent state (10 memory files, decision journal, weekly archive structure). It is missing structural extension in seven directions — Phase B–F builds them.

### Direction 1 — Persistent memory across sessions

**Today** (post-Phase A): captain has identity files + state files + journal + weekly directory + 1on1 directory.

**Next**: routines wake the captain weekly (Monday 08:00 Asia/Riyadh — `weekly-captain-cycle`), monthly (`monthly-captain-review`), quarterly (`quarterly-okr-set/check/grade`).

### Direction 2 — Cadence above the sprint

**Today**: Weekly + 2-week sprint exist.

**Next**: Phase D adds monthly + quarterly OKR + annual strategy. Each has a written archive.

### Direction 3 — Customer development discipline

**Today**: One customer (Ahmed Baha) tracked.

**Next**: Phase B builds CRM (`customers.json` + `pipeline.json`), interview cadence (1/week target), win-loss log, feedback voice file.

### Direction 4 — Founder coaching loop

**Today**: Friday review includes a founder-coaching observation block (captain.md, encoded).

**Next**: Phase E adds `/founder-retro` (monthly behavioral retrospective), `/principle add` (log new founder principles when learned), advisor-call cadence.

### Direction 5 — External communication infrastructure

**Today**: Internal communication via Apple Notes + Slack + GitHub.

**Next**: Phase D adds `/investor-update` (write monthly even with no investors — Horowitz), public changelog, founder letter (annual narrative).

### Direction 6 — Risk awareness

**Today** (post-Phase A): `risks.json` register with 8 starter risks, scoring rubric, monthly review cadence.

**Next**: Phase C adds `/risk add | list | review | retire` skill, decision integration (every Type-1 decision premortem feeds risks.json), monthly risk-delta review.

### Direction 7 — Learning compounding

**Today** (post-Phase A): `learnings.md` seeded with 5 founding learnings.

**Next**: Phase E adds `/founder-retro` (monthly), quarterly auto-extraction of patterns from journal + decisions + retros into `learnings.md`, promotion path from learnings → PRINCIPLES.md when patterns prove over multiple cycles.

### Direction 8 — Solo leverage (adopted 2026-07-10)

The one-person-$1M discipline (Pofeldt, Jarvis) fused with the second-brain method (Forte) and Anthropic's harness engineering — the doctrine for a founder running an agent fleet:

- **Eliminate → Automate (agent) → Delegate (human) → defer** — triage every recurring task in that order, never skipping a step leftward. The captain applies it in the Monday allocation.
- **Technology before headcount** — before any hire or contractor, write down why an agent + skill cannot do the job.
- **Outsource only non-core spikes** (design bursts, bookkeeping); never the product, never the customer relationship. Hand-hold the first five schools personally — automate everything _behind_ that relationship, not the relationship.
- **Memory is a second brain, not an archive** — capture what surprises (expectation violations → `feedback_*`), compress on touch, archive what's done. Any artifact produced twice becomes a card/template/skill ("intermediate packets").
- **The engine is a harness** — separate generator from evaluator (qa's adversarial verify), verify like a human through a browser, keep state in JSON not prose, and on every model upgrade ask which guardrails stopped load-bearing (`/sync` harness audit). Guardrails get retired, not just added.

---

## Part V — The bibliography (heavy, with passages)

The captain's reading list. Each entry includes the canonical passage that captures the operating practice the captain should embody. These are the references `PRINCIPLES.md` cites and the captain's frontmatter loads as memory context.

### A. Founder-CEO operating manuals

**Andy Grove — _High Output Management_ (1983)**

> _"The output of a manager is the output of the organizational units under his or her supervision or influence."_

> Output = Activity × Leverage. Captain's mantra: maximize leverage, not activity.

> _"Just as you would not permit a fellow employee to steal a piece of office equipment worth $2,000, you shouldn't let anyone walk away with the time of his fellow managers."_

On 1:1s: _"The one-on-one is, in my view, the meeting between a manager and his subordinate, and is the principal way their business relationship is maintained… the principal medium of organizational life."_

Task-relevant maturity: _"The right management style depends on the maturity of the subordinate."_ Apply per-teammate.

OKRs (originated by Grove at Intel, popularized later by Doerr at Google): _"I will __ as measured by \__."_

**Ben Horowitz — _The Hard Thing About Hard Things_ (2014)**

> _"The hard thing isn't dreaming big. The hard thing is waking up in the middle of the night in a cold sweat when the dream turns into a nightmare."_

> _"Peacetime CEO knows that proper protocol leads to winning. Wartime CEO violates protocol in order to win."_

> _"Take care of the people, the products, and the profits — in that order."_

> _"By far the most difficult skill I learned as CEO was the ability to manage my own psychology."_

> _"Founders have an inherent advantage… they know why the company exists."_

**Jeff Bezos — _Shareholder Letters_ (1997–2020)**

> _"Some decisions are consequential and irreversible or nearly irreversible — one-way doors — and these decisions must be made methodically, carefully, slowly, with great deliberation and consultation. Other decisions are changeable, reversible — they're two-way doors. These Type-2 decisions can and should be made quickly by high judgment individuals or small groups."_ (1997 letter, re-emphasized 2015).

> _"Day 1 stays Day 1 only with vigilance."_

> _"Memos are powerful. They force the writer to think much more deeply than slides do."_

> _"Customers are always beautifully, wonderfully dissatisfied."_

> Regret-minimization: _"Project yourself forward to age 80 and look back on your life. Choose the path that minimizes the number of regrets."_

**Paul Graham — _Y Combinator essays_**

> _"Make something people want."_

> _"Default alive or default dead?"_ (2015) — _"At your current rate of growth, can you make it to profitability before you run out of money?"_ Databayt today: ~10 months runway with $0 MRR → **default dead** until first paying customer.

> _"Do things that don't scale."_ — Hand-curate the first 10 customers.

> _"The biggest startup ideas are terrifying… If you choose an idea that doesn't terrify you, it's not big enough."_

**Sam Altman — _Startup Playbook_ (2015)**

> _"Most founders spend too much time on stuff that doesn't matter and too little time on what does."_

> _"It's much better to make a few users really love you than a lot of users sort of like you."_

> _"The most important thing for a CEO to do is to set the vision and direction of the company."_

> _"A great team can't make a bad market into a good market, but a bad team can certainly screw up a good one."_

**Andrew Bosworth — _Boz Bites_ (Facebook/Meta CTO essays)**

> _"Empathy is the most important and underrated leadership skill."_

> _"If it doesn't have a deadline, it doesn't have a chance."_

> _"Cold start algorithm: spend the first 30 days learning. Don't try to be productive; try to understand."_

> _"Career conversations: ambition, capability, opportunity. Your job as a manager is to find the intersection."_

**Tony Fadell — _Build_ (2022)**

> _"The story of your product is its purpose. Why it exists. Why it matters."_

> _"The first version of anything is a story."_

> First-principles: _"Don't ask why something is the way it is. Ask why it isn't another way."_

> _"Mentors give you the framework. Mentees do the work."_

### B. Goal-setting + accountability

**John Doerr — _Measure What Matters_ (2018)**

> Template: _"I will (Objective) as measured by (this set of Key Results)."_

> _"OKRs surface our primary goals. They channel efforts and coordination. They link diverse operations, lending purpose and unity to the entire organization."_

Grading: 0.0–1.0 per KR; aim for 0.7 (stretch); 1.0 means you sandbagged.

**Verne Harnish — _Scaling Up_ (2014); Rockefeller Habits**

- BHAG (Big Hairy Audacious Goal) — 10–25 year horizon.
- One-Page Strategic Plan (OPSP).
- 10 Rockefeller Habits: priorities, data, rhythm, team alignment, customer feedback weekly, employee feedback weekly, core values reinforced, BHAG visible, brand promise tracked, plan accessible.

**Gino Wickman — _Traction_ / EOS (Entrepreneurial Operating System)**

- Six components: Vision, People, Data, Issues, Process, Traction.
- Rocks: 3–7 quarterly priorities per person.
- L10 weekly meeting (90 min, agenda: Scorecard → Rocks → Customer/Employee Headlines → To-dos → IDS).
- Scorecard: weekly numbers per role (5–15 metrics, each owned by one person).
- IDS: Identify, Discuss, Solve.

**Jim Collins — _Good to Great_ (2001)**

> _"Level 5 leaders embody a paradoxical mix of personal humility and professional will."_

> The Hedgehog Concept: intersection of (1) what you can be best in the world at, (2) what you're deeply passionate about, (3) what drives your economic engine.

> _"Good is the enemy of great."_

> The Flywheel: small consistent pushes compound; no single decisive turn.

**Peter Drucker — _The Effective Executive_ (1967)**

> _"What gets measured gets managed."_

> _"Effective executives focus on contribution. They look up from their work and outward toward goals."_

> _"Time is the scarcest resource and unless it is managed, nothing else can be managed."_

Five habits: manage time, focus on contribution, build on strengths, set priorities, make effective decisions.

### C. Decision-making

**Daniel Kahneman — _Thinking, Fast and Slow_ (2011)**

System 1 (fast, intuitive) vs System 2 (slow, deliberate). Planning fallacy: people systematically underestimate task durations.

Decision-journal practice: write the prediction (probability + expected outcome) **before** acting. Review later. Distinguishes good decisions from good outcomes.

**Gary Klein — _Premortem_ (Harvard Business Review, 2007)**

> _"Imagine the project has failed catastrophically. Now write a story explaining why."_ — Reverses optimism bias. Surfaces risks teams hesitate to voice.

**Annie Duke — _Thinking in Bets_ (2018)**

> _"Decisions and outcomes are two different things. Good decisions can have bad outcomes. Bad decisions can have good outcomes."_

> _"Make better predictions by sharpening your beliefs."_

> _"Decision journaling makes you a better forecaster because it forces you to confront the difference between what you predicted and what happened."_

**Charlie Munger — _Poor Charlie's Almanack_**

> _"Latticework of mental models from multiple disciplines."_

> _"Invert, always invert."_ — To know what to do, first know what to avoid.

> _"It is remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid, instead of trying to be very intelligent."_

### D. People

**Reed Hastings — _No Rules Rules_ (2020)**

> Talent density: _"Get rid of the people who aren't great; pay the rest top of market."_

> Freedom and responsibility: _"As you grow, the rules and chaos that come with bureaucracy will multiply. To avoid that, you need to remove controls."_

> Context, not control.

> Keeper test: _"Which of my people, if they told me they were leaving for a similar job at a competitor, would I fight hard to keep?"_

**Patrick Lencioni — _The Five Dysfunctions of a Team_ (2002)**

1. Absence of trust → fear of being vulnerable.
2. Fear of conflict → artificial harmony.
3. Lack of commitment → ambiguity.
4. Avoidance of accountability → low standards.
5. Inattention to results → status & ego.

> _"Trust is the foundation. Without it, teams can't engage in productive conflict, which means they can't commit, hold each other accountable, or get results."_

**Marshall Goldsmith — _What Got You Here Won't Get You There_ (2007)**

The 20 bad habits of successful people: winning too much, adding too much value, passing judgment, making destructive comments, starting with "no/but/however", telling the world how smart we are, speaking when angry, negativity, withholding information, failing to give recognition, claiming credit we don't deserve, making excuses, clinging to the past, playing favorites, refusing to express regret, not listening, failing to express gratitude, punishing the messenger, passing the buck, an excessive need to be "me".

**Feedforward** (not feedback): ask people for _future_ suggestions, not past critique.

> _"Try to remove judgmental language ('no/but/however') from your vocabulary. It immediately disqualifies the other person's idea."_

### E. Product + market

**Eric Ries — _The Lean Startup_ (2011)**

Build-Measure-Learn loop. _"The only way to win is to learn faster than anyone else."_

Innovation Accounting. Pivot types: zoom-in, zoom-out, customer segment, customer need, platform, business architecture, value capture, engine of growth, channel, technology.

Validated learning: each experiment yields a falsifiable claim.

**Geoffrey Moore — _Crossing the Chasm_ (1991)**

Technology adoption lifecycle: Innovators → Early Adopters → **CHASM** → Early Majority → Late Majority → Laggards.

> _"Pick a bowling pin — the first segment to target — and topple it before the next."_

**Hogwarts beachhead**: King Fahad Schools → similar Sudan private schools (Khartoum) → MENA private schools → adjacent verticals.

**Clay Christensen — _The Innovator's Dilemma_ (1997); _Competing Against Luck_ (2016)**

> _"Customers don't buy products; they hire them to do a job."_ (Jobs-to-be-Done).

Sustaining vs disruptive innovation: incumbents win sustaining; entrants win disruptive (lower-end, then up-market).

**Marc Andreessen — _The Only Thing That Matters_ (2007)**

Three things that matter for a startup: team, product, market — and _"in a great market — a market with lots of real potential customers — the market pulls product out of the startup."_

Product/market fit (term originated by Andy Rachleff): _"You can always feel when product/market fit isn't happening… and you can always feel product/market fit when it's happening."_

**Hamilton Helmer — _7 Powers_ (2016)**

The 7 strategic powers that create persistent differential returns above cost of capital:

1. Scale Economies — bigger is cheaper.
2. Network Economies — value grows with users.
3. Counter-Positioning — new business model the incumbent can't copy without harming itself.
4. Switching Costs — locked-in customers.
5. Branding — durable preference.
6. Cornered Resource — preferential access (talent, IP, contract).
7. Process Power — embedded organizational capability.

> _"A business is a Power if it can sustain above-cost returns."_

**Databayt's plausible powers**: Counter-Positioning (open-source / SSPL / sharing-economy revenue distribution) + Process Power (the Kun engine itself).

**Peter Thiel — _Zero to One_ (2014)**

> _"Competition is for losers."_

Monopoly traits: proprietary technology (10× better), network effects, economies of scale, branding.

> _"What important truth do very few people agree with you on?"_

The four kinds of progress: globalization (1 → n), technology (0 → 1). Startups should do 0 → 1.

### F. Strategy

**Michael Porter — _Competitive Strategy_ (1980)**

Five forces: rivalry, suppliers, buyers, substitutes, new entrants.

Three generic strategies: cost leadership, differentiation, focus.

Value chain analysis.

**Roger Martin — _Playing to Win_ (2013)**

Five strategy choices: Winning Aspiration, Where to Play, How to Win, Core Capabilities, Management Systems.

### G. Founder-of-small-team / lean / async / open source

**GitLab Handbook** (publicly readable)

- Async-first. The handbook IS the source of truth. Iteration via merge requests.
- Direction → tone → MR.
- Public by default.

**Stripe Operating Manual / Memo-driven culture**

- Pre-reads before meetings.
- Written communication compounds; spoken communication evaporates.
- "If it's not written down, it didn't happen."

**Basecamp / 37signals — _Shape Up_ (2019)** by Ryan Singer

- 6-week cycles + 2-week cooldown.
- Shaped work, hill chart.
- Bet, don't plan.

**Jason Lemkin — _SaaStr_ (ongoing)**

> _"Sell something they can't live without."_

- CAC payback < 12 months. NRR > 120%.
- Founders should personally do customer onboarding for the first 10–20 customers.

**Mike Volpi — _The 5 Mistakes Open-Source CEOs Make_ + Index Ventures essays**

- Open-source moat ≠ commercial moat.
- Commercial OSS revenue models: hosted, enterprise feature, support, embedded license, open core, services.
- SSPL implications: trades cloud-provider-as-distributor revenue path for stronger commercial control.

### H. Operating + behavioral

**Bill Walsh — _The Score Takes Care of Itself_ (2009)**

Standard of Performance: written, lived, enforced.

> _"The score takes care of itself when you take care of the effort that precedes the score."_

**Naval Ravikant — _The Almanack of Naval Ravikant_ (2020)**

> _"Specific knowledge is found by pursuing your genuine curiosity and passion rather than whatever is hot right now."_

> _"There are four kinds of leverage: labor, capital, code, media. The latter two are permissionless."_

> _"Play long-term games with long-term people."_

**Reid Hoffman — _Blitzscaling_ (2018)**

> _"If you're not embarrassed by the first version of your product, you've launched too late."_

Plans A / B / Z — Plan Z is "what happens if everything fails."

**Peter Senge — _The Fifth Discipline_ (1990)**

Personal mastery, mental models, shared vision, team learning, systems thinking.

### I. Islamic & Sudanese economy references (the share-economy lineage)

The four references below ground the company's "Open source, sharing economy" posture in a tradition broader than Silicon Valley operator canon. They are _complementary_ to the Western canon above, not substitutes — the Western canon answers "how do we operate well?", this canon answers "in service of what?". Full doctrine: [`docs/SHARE-ECONOMY-MODEL.md`](./SHARE-ECONOMY-MODEL.md).

**Khedr — _رائد الأعمال Inside Out_ (2019)**

> Discuss and document partnership equity before the company starts operating, not after.

د. محمد حسام خضر (Egyptian engineer & practitioner, ~28 years; MBA Universitat Autònoma de Barcelona 2017; DBA 2025; founder of Internet Plus, Sun Games (acquired), Managing Partner at Endure Capital). Dar Don, 239pp, 30+ chapters, ISBN 9789778061598. The Equity Split chapter is the book's most-cited section. **Five Databayt-applicable contributions:** (1) two distinct equity methodologies — traditional vs startup; (2) **Khedr Helicopter** — staged-commitment expansion where stage-N commitment scales with stage-(N–1) traction (MENA-10 cohort = stage 1); (3) **pre-launch equity contract** for every partnership before first commit; (4) **partner-departure protocols** — bought-out vested CU, unvested returns to pool, structured cooling-off; (5) **Sharia-compliant non-compete templates** for MENA legal context. Reference: [إضاءات review](https://www.ida2at.com/entrepreneur-inside-out-book-overview/); YouTube **خضر و بزنس**.

**Akbar — _قص الحق_ (2014, 2nd ed. 2022, 1800pp) + the operational framework**

> Islamic legal tradition organizes economic life around حقوق (Ḥuquq, "rights") rather than around property as exclusion. Western property → rules → bureaucracy → monopoly → stratification. Ḥuquq → access for all.

جميل عبد القادر أكبر (Saudi architect, MIT PhD 1984 under Habraken, currently Fatih Sultan Mehmet Vakıf University Istanbul). The doctrine cites Akbar for the philosophical posture (rights > property) AND for three portable concepts from his operational framework: (1) **three claims (ownership / control / use) + five forms of submission (Unified / Dispersed / Permissive / Possessive / Trusteeship)** — Akbar's 1984 MIT thesis framework, directly portable to software (all five forms exist in Databayt today); (2) **three mechanisms** (collective solution-seeking, action precedes permission, refinement through conflict — Akbar 1999) — names what OSS practices already do; (3) **darar / dirar** — the Prophetic distinction between extractive harm (SSPL prevents) and gratuitous harm (trademark policy prevents). Most accessible English entry: Akbar's 2023 keynote _Property Rights (Ḥuquq) and Civilizations_ (37pp, Ankara) and the 2024 Ummatics colloquium parts I & II.

**NMBD — _ورقة الاقتصاد التشاركي_**

> _"التضامن في الإنتاج، لا في الاستهلاك فقط."_
> Solidarity in production, not in consumption alone.

الحركة الوطنية للبناء والتنمية (Sudanese reform movement). The single principle worth keeping: move solidarity from the consumption side of the economy to the production side. This is already the operative posture of the company (Ahmed Baha as partner-not-customer, MENA-10 cohort, contributors-as-owners); NMBD gives it a precise name. Doctrine cites the _paper_ and the production-solidarity principle; lineage scope limited to safe civilizational figures (Bennabi, Hajj Hammad).

**Islamic economy primitives — the operational vocabulary**

Four primitives, each scoped narrowly:

- **مضاربة (Mudaraba)** — silent partnership: capital + working partner, profit by ratio, loss to capital provider. Applies _only_ to sponsored custom-build contracts.
- **شِركة الأعمال (Shirkat al-A'mal)** — partnership of labor: contributors as owners by contribution. The CU spec is its operational expression. Honest divergence: we cap contributor downside.
- **وقف (Waqf-track)** — perpetual community pool. Pledged 5% of revenue today, formal _waqf_ instrument when activation triggers fire.
- **زكاة (Zakat-aligned Needs Fund)** — 2.5% on net profits to a separately-named "Needs Fund / صندوق العون" for contributors in genuine need.

Reference textbook: Iqbal & Mirakhor, _An Introduction to Islamic Finance: Theory and Practice_ (2nd ed., Wiley, 2011). Standards: AAOIFI ([aaoifi.com](https://aaoifi.com/)).

---

## Part VI — How this OS is implemented in Kun

The principles above are encoded into Kun (the captain operating system) via files, agents, and skills. Here's the map.

### Files (read by every captain session)

| File                                             | Contains                                          | Read by                  |
| ------------------------------------------------ | ------------------------------------------------- | ------------------------ |
| [`docs/CONSTITUTION.md`](./CONSTITUTION.md)      | Mission, vision, values                           | every session            |
| [`docs/PRINCIPLES.md`](./PRINCIPLES.md)          | 24 founder operating principles                   | every session            |
| [`docs/NORTH-STAR.md`](./NORTH-STAR.md)          | The one metric                                    | every session            |
| [`docs/CEO-OS.md`](./CEO-OS.md)                  | This document                                     | quarterly + on confusion |
| `docs/AGILE.md`                                  | Sprint cadence, ICE, T-shirt sizes, DoD, velocity | weekly + sprint planning |
| `.claude/memory/captain_journal.md`              | Decision/observation log                          | every session            |
| `.claude/memory/runway.json`                     | Live runway state                                 | weekly                   |
| `.claude/memory/north_star.json`                 | Current value + delta                             | weekly                   |
| `.claude/memory/okrs.json`                       | Quarterly OKRs                                    | weekly check             |
| `.claude/memory/risks.json`                      | Risk register                                     | monthly review           |
| `.claude/memory/customers.json`                  | Customer roster                                   | weekly                   |
| `.claude/memory/pipeline.json`                   | Deal pipeline                                     | weekly                   |
| `.claude/memory/capacity.json`                   | Per-person bandwidth                              | Monday plan              |
| `.claude/memory/team.json`                       | Canonical team list                               | every session            |
| `.claude/memory/learnings.md`                    | Cross-session patterns                            | quarterly retro          |
| `.claude/memory/hiring.md`                       | Hire triggers + plan                              | quarterly                |
| `.claude/memory/feedback.jsonl`                  | Customer voice log                                | weekly                   |
| `.claude/memory/decisions/`                      | ADR-style decision archive                        | as referenced            |
| `.claude/memory/weekly/`                         | Weekly review archive                             | monthly aggregation      |
| `.claude/memory/monthly/`                        | Monthly review archive                            | quarterly aggregation    |
| `.claude/memory/quarterly/`                      | Quarterly review archive                          | annual aggregation       |
| `.claude/memory/1on1/<person>.md`                | Running 1:1 notes                                 | per 1:1                  |
| `.claude/memory/interviews/<date>-<customer>.md` | Customer interview notes                          | weekly review            |

### Agents

| Agent            | Scope                                 |
| ---------------- | ------------------------------------- |
| `captain`        | CEO brain — strategic, never executes |
| `revenue`        | Pricing, deals, contracts, MRR        |
| `growth`         | Content, SEO, social, dev relations   |
| `support`        | Onboarding, customer success, SLAs    |
| `product`        | Roadmap, ICE, releases                |
| `analyst`        | Market intel, competitor analysis     |
| `tech-lead`      | Cross-repo architecture               |
| `ops`            | CI/CD, costs, infrastructure          |
| `guardian`       | Security, performance, compliance     |
| (31 specialists) | Engineering execution                 |

### Skills (after Phase A)

**Wired**:

- `/captain` — synthesize state + next action ✅
- `/weekly` — Monday plan / Wed check / Fri review ✅
- `/decide` — write decision journal entry ✅
- `/premortem` — Klein-style premortem ✅

**Planned (Phases B–F)**:

- `/risk add | list | review | retire` — risk register hygiene
- `/customer-interview` — JTBD-framed interview note
- `/win-loss` — log closed deal
- `/1on1 <person>` — prep + log
- `/hiring` — review hire triggers
- `/principle add` — log new founder principle
- `/monthly` — monthly review
- `/quarterly` — quarterly OKR cycle
- `/okr-set | check | grade` — OKR mechanics
- `/investor-update` — monthly investor update
- `/founder-retro` — behavioral retrospective on Abdout

### Routines (cron-scheduled — planned)

| Routine                 | Schedule                | Skill                          |
| ----------------------- | ----------------------- | ------------------------------ |
| daily-pulse             | daily 08:00 KSA         | `/captain brief`               |
| weekly-captain-cycle    | Monday 08:00 KSA        | `/weekly plan`                 |
| mid-week-check          | Wednesday 14:00 KSA     | `/weekly check`                |
| friday-review           | Friday 16:00 KSA        | `/weekly review`               |
| monthly-captain-review  | First Monday 09:00      | `/monthly`                     |
| quarterly-okr-set       | First Monday of quarter | `/okr-set`                     |
| quarterly-okr-grade     | Last Friday of quarter  | `/okr-grade`                   |
| monthly-investor-update | Last Friday of month    | `/investor-update`             |
| monthly-founder-retro   | Last Saturday of month  | `/founder-retro`               |
| runway-watch            | daily 23:00             | runway alert if status changes |

---

## Part VII — Reading order

For Abdout personally — read in this order, one per week (12 weeks):

1. **Andy Grove — _High Output Management_** (operating fundamentals; OKRs origin)
2. **Ben Horowitz — _The Hard Thing About Hard Things_** (founder-CEO; psychology)
3. **Paul Graham — _Default Alive or Default Dead_** (essay; runway clarity)
4. **Jeff Bezos — 1997 Shareholder Letter + Day 1 letter** (memos, Type-1/2)
5. **Sam Altman — _Startup Playbook_** (compressed YC wisdom)
6. **Eric Ries — _The Lean Startup_** (validated learning; build-measure-learn)
7. **Geoffrey Moore — _Crossing the Chasm_** (beachhead strategy)
8. **John Doerr — _Measure What Matters_** (OKR mechanics)
9. **Patrick Lencioni — _The Five Dysfunctions of a Team_** (team health)
10. **Jim Collins — _Good to Great_** (Level-5; hedgehog; flywheel)
11. **Hamilton Helmer — _7 Powers_** (strategic moats)
12. **Marshall Goldsmith — _What Got You Here Won't Get You There_** (founder behavioral self-improvement)
13. **محمد حسام خضر — _رائد الأعمال Inside Out_** (MENA-Arab equity-allocation methodology; bridge from the Western canon into the share-economy doctrine — see Part V Section I and `docs/SHARE-ECONOMY-MODEL.md`)

For Kun captain (loaded as memory context): the captain agent's frontmatter loads `CONSTITUTION.md`, `PRINCIPLES.md`, `NORTH-STAR.md`, and the state files. This document is read on demand at quarterly review or when the captain needs to ground a recommendation in canonical practice. The share-economy doctrine (`docs/SHARE-ECONOMY-MODEL.md`) is reached via the `CONSTITUTION.md` §7 / `PRINCIPLES.md` #22 / Part V Section I cross-links — not auto-loaded.

---

## Closing

> **Mission first. Speed last. Truth always.**
>
> Quality over speed. Mission over survival. Community is the moat.
>
> Take care of the people, the products, and the profits — in that order.
>
> The score takes care of itself when you take care of the effort that precedes the score.

---

**Last reviewed**: 2026-05-12 — Phase A founding edition.

**Next review**: 2026-08-12 (Q3 2026 quarterly).

**Maintainer**: Abdout (founder). Captain references; team contributes via PRs against this file.
