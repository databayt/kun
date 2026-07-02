# Share Economy Model

> The doctrine behind "Open source, sharing economy." This document gives the existing posture its intellectual lineage, names the references precisely, and translates each reference to a concrete mechanism that already exists in the company. It does **NOT** set operational numbers — those live in the existing CU spec at `hogwarts/content/docs-en/shared-economy.mdx` today, and in Samia's Q3 2026 framework tomorrow.

---

## At a glance

|                             |                                                                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What this is**            | The constitutional doctrine for Databayt's share-economy posture.                                                                                                                                                                                           |
| **Audience**                | Founders, contributors, sponsors, investors, future hires, Arabic-speaking partners.                                                                                                                                                                        |
| **Companion docs**          | [`CONSTITUTION.md`](./CONSTITUTION.md) §7 · [`PRINCIPLES.md`](./PRINCIPLES.md) #22 · [`CEO-OS.md`](./CEO-OS.md) Part V · [`hogwarts/content/docs-en/shared-economy.mdx`](https://github.com/databayt/hogwarts/blob/main/content/docs-en/shared-economy.mdx) |
| **What it does NOT change** | CU formulas, contribution matrix, $45/hr floor, governance rules, pool sizing, founder reserve %. Those live in the CU spec and will be formalized by Samia's Q3 2026 framework.                                                                            |
| **Amendment cadence**       | Constitution-level. Written decision in `.claude/memory/decisions/` per Principle #5. Quarterly review.                                                                                                                                                     |
| **Last reviewed**           | 2026-05-13 (founding draft)                                                                                                                                                                                                                                 |
| **Next review**             | 2026-08-13                                                                                                                                                                                                                                                  |

---

## The contract page (the operational artifact)

This document is the **doctrine** — lineage, references, intellectual posture. The operational artifact of the doctrine — the public-facing agreement between Databayt and its parties — is the **contract page** at [`kun/content/docs/share-economy.mdx`](../content/docs/share-economy.mdx) (Arabic mirror: [`share-economy.ar.mdx`](../content/docs/share-economy.ar.mdx)).

The contract page is framed as a **smart contract in the structural sense** (public rules, self-execution, code enforcement — _not_ on-chain, _not_ a token, _not_ a Turing-complete VM). It names five Islamic-primitive clauses (Shirkat al-A'mal, Mudaraba, Waqf, Needs Fund, Darar/dirar), five Khedr partnership-formation clauses (two equity methodologies, Khedr Helicopter, pre-launch equity contract, partner departure protocol, Sharia-compliant non-compete), and the enforcement matrix that ties each clause to a specific mechanism.

Read the three layers in order when you join Databayt:

1. **Doctrine** (this document) — _in service of what?_ The intellectual lineage (Akbar, NMBD, Khedr, Islamic primitives) that makes the posture defensible.
2. **Contract** ([`share-economy.mdx`](../content/docs/share-economy.mdx)) — _what is enforced?_ The public agreement between Databayt and its parties.
3. **Measurement spec** ([`hogwarts/.../shared-economy.mdx`](https://github.com/databayt/hogwarts/blob/main/content/docs-en/shared-economy.mdx)) — _how is contribution valued?_ The CU formula, contribution matrix, anti-gaming controls, governance rules.

The doctrine does not change CU formulas; the contract does not change operational specs; both defer numerical parameters to Samia's Q3 2026 framework in `databayt/revenue`.

---

## Part I — What we mean by share economy

> **التضامن في الإنتاج، لا في الاستهلاك فقط.**
> _Solidarity in production, not in consumption alone._
>
> — الحركة الوطنية للبناء والتنمية (NMBD), _ورقة الاقتصاد التشاركي_

### The definition

Share economy at Databayt is one sentence:

> Every form of contribution is measurable, owned, and compensated; the value of the company is the sum of those contributions — never extracted from them.

That sentence is the entire posture. The rest of this document is the lineage that makes it defensible and the vocabulary that makes it precise.

### What share economy is NOT at Databayt

- **Not socialism.** Contributors are owners by measured contribution, not by membership.
- **Not charity.** The community fund is funded by revenue, not by donation; recipients earn it through evidence of contribution.
- **Not crypto tokenomics.** No blockchain, no NFTs, no on-chain treasury. Contribution Units are an accounting unit kept in a ledger, not a tradable asset. (See `docs/repositories/distributed-computer.md` for the R&D-only Hogwarts Coin track, explicitly out of scope for the production posture.)
- **Not customer-as-revenue-source.** Schools, vendors, clinics are partners we share value with. The relationship is two-way.
- **Not VC velocity.** We bootstrap to profitability. Optional partnerships, no dilutive funding except on strict terms. (See `CONSTITUTION.md` §3 Mission > Survival, §4 Long games with long people.)
- **Not a license to fork-and-extract.** SSPL prevents closed competitors from absorbing the work without contributing back. The license enforces the doctrine.

### Where this posture already lives

The doctrine you are reading does not invent anything new. It names what already exists:

| Existing artifact                                                                                                                                                      | Where the doctrine lives in it                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`CONSTITUTION.md`](./CONSTITUTION.md) §7 "Community is the moat"                                                                                                      | The values statement.                                         |
| [`PRINCIPLES.md`](./PRINCIPLES.md) #22                                                                                                                                 | The operating principle.                                      |
| [`PRINCIPLES.md`](./PRINCIPLES.md) #14 "Make a few users love you"                                                                                                     | The MENA-10 cohort as partners-not-customers.                 |
| [`CEO-OS.md`](./CEO-OS.md) Part III Helmer 7 Powers                                                                                                                    | Counter-Positioning argument: closed competitors cannot copy. |
| [`hogwarts/content/docs-en/shared-economy.mdx`](https://github.com/databayt/hogwarts/blob/main/content/docs-en/shared-economy.mdx)                                     | Operational CU spec — measurement, anti-gaming, governance.   |
| [`hogwarts/LICENSE`](https://github.com/databayt/hogwarts/blob/main/LICENSE) + [`docs/LICENSING.md`](https://github.com/databayt/hogwarts/blob/main/docs/LICENSING.md) | SSPL dual-license — the structural enforcement.               |
| `.claude/memory/hiring.md` line 6                                                                                                                                      | Current compensation: $0 cash / all equity / sweat / CU.      |
| `.claude/memory/1on1/samia.md`                                                                                                                                         | Samia owns the Q3 2026 operational framework.                 |

### The bridge to the references

This document takes the existing posture and gives it the four references that ground it in a tradition broader than Silicon Valley operator canon:

1. **Akbar** — _why_ rights-based access beats property-based exclusion (the philosophical frame for SSPL + community ownership).
2. **NMBD** — _what_ production-solidarity means in practice (the operative principle).
3. **Khedr** — _how_ MENA-Islamic-compatible equity mechanics actually work (the practical vocabulary for partnership structures).
4. **Islamic economy primitives** — the precise _Arabic terms_ that describe what we are doing (Mudaraba, Shirkat al-a'mal, Waqf, Zakat).

Each reference contributes one specific thing. None of them is the whole model. Read all four; do not collapse them.

---

## Part II — The four references

### §A — Akbar: Huquq (rights > property)

> _"The Western mode of property rights leads to rules and regulations, which results in intervention, bureaucracy, monopoly, and stratification, while the Islamic Sharia achieves the opposite through rights — Ḥuquq."_
>
> — Jamel Akbar, summary of _Qas al-Haq_ (Ummatics colloquium 2024)

#### The author

Jamel Akbar (جميل عبد القادر أكبر, b. 1954, Taif, Saudi Arabia) is a Saudi architect and theorist of the built environment. King Saud University (B.Arch, 1977); MIT (M.Arch.A.S. and Ph.D., 1978–1984, under N. John Habraken and Stanford Anderson). Taught at University of Dammam 1984–2016. Headed the Scientific Editing Team for the King Abdullah Project for the Holy Mosque expansion in Mecca. Chairman of the Saudi Umran Society. Visiting associate professor at MIT (1990). Three principal books:

- _Crisis in the Built Environment: The Case of the Muslim City_ (1988, Concept Media; distributed by E. J. Brill).
- _إمارة الأرض في الإسلام_ (_Imarat al-Ard fi al-Islam_ / _Building the Earth in Islam_) (1992, 2nd ed. 1995, 3rd ed. Beirut). Arabic expansion of _Crisis_.
- _قص الحق_ (_Qas al-Haq_) — 1st edition 2014 (Aalam al-Kutub al-Hadith), 2nd edition 2022 (Daretamkin, 1,800 pages covering 12 of 18 planned chapters, ISBN 978-625-7489-13-3). Over 20 years of development; the central project of his career. Discussed in the May 2024 Ummatics colloquium "Qas Al-Haq: An Alternative to Capitalism, Nation-State" (parts I & II). Bibliography at [en.jamelakbar.com](https://en.jamelakbar.com/).
- _Property Rights (Ḥuquq) and Civilizations_ (2023, 37pp, keynote at "City and Civilization Congress" Ankara) — the most accessible English summary of the _Qas al-Haq_ argument.
- _Rights and Civilizations_ (2019, 21pp) — Lakatosian framing of Huquq as the research-program hard-core.
- _Responsibility and the Traditional Muslim Built Environment_ (1984, 473pp, MIT PhD dissertation under N. John Habraken) — the source of the three claims + five forms of submission framework.

#### The single core idea we take

Akbar's central move in _Qas al-Haq_ is to argue that the **Islamic legal tradition organizes economic life around حقوق (Ḥuquq, "rights") rather than around property as exclusion.** The framing matters:

- Western property rights → rules → bureaucracy → monopoly → stratification. Resources become inaccessible to those without the right permissions; production concentrates; outcomes stratify.
- Ḥuquq → rights-based access → individuals can start businesses, factories, productive activities **without permission from authorities**, as long as they do not harm others or the environment. The "access" rather than "ownership" framing changes who can produce.

Whether or not one accepts Akbar's full critique of capitalism, his structural distinction is useful: **a system organized around access rights to productive activity behaves differently from one organized around exclusionary property rights to assets.**

#### Where it lives in Databayt

The license is the structural analog:

- **SSPL is the access-rights expression.** Anyone can read the code, fork it, run it, modify it, build on it. Commercial SaaS resale requires either open-sourcing your stack or buying a commercial license. The license does not exclude — it conditions extraction on contribution.
- **Open-by-default is the access-rights expression at the docs layer.** Public repos, public docs, public roadmap, public failures (per Principle #21).
- **Contribution Units are the access-rights expression at the value layer.** Every contributor accrues CU; CU does not require permission to acquire — only evidence of contribution.

A closed proprietary competitor cannot replicate this without burning their existing business model. That is the Counter-Positioning argument from Helmer's _7 Powers_. Akbar gives that argument an older, deeper grounding than Silicon Valley strategy literature.

#### The three claims and the five forms of submission

Akbar's operational framework, developed first in his 1984 MIT thesis and extended through every later book and paper, rests on **three claims** any party can hold over a property (or, by extension, any productive resource):

> _"Three claims will affect the physical state of a property: the claim of ownership, the claim of control and the claim of use."_ — Akbar, 1984 MIT thesis (abstract verbatim)

These three claims combine to produce **five Forms of Submission of Property**:

| Form                    | Structure                                                              | Software example                                                                                    |
| ----------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Unified (موحَّد)**    | One party holds all three (owns, controls, uses)                       | Solo developer on their own tool                                                                    |
| **Dispersed (موزَّع)**  | Three different parties — one owns, one controls, one uses             | Employee writes code (uses), employer owns IP, GitHub hosts/controls infra                          |
| **Permissive (إذني)**   | User deals with a single party that owns AND controls                  | SaaS subscription — customer uses what the vendor owns and controls                                 |
| **Possessive (حيازي)**  | User and controller are one party; they deal separately with the owner | Self-hosted OSS — user uses and controls a deployment of code owned by an upstream project          |
| **Trusteeship (وصاية)** | Custodian (_nazir_) controls and stewards on behalf of beneficiaries   | Foundation-stewarded code (Linux Foundation, Apache); the future Databayt waqf-track Community Pool |

This is the framework's portability: **software exhibits all five forms.** Databayt today operates in all five — Hogwarts at King Fahad as Permissive; a school running self-hosted Hogwarts as Possessive; a solo contributor on their own fork as Unified; a contractor working for a sponsor on Mkan as Dispersed; the waqf-track Community Pool (when activated) as Trusteeship. The framework gives us a precise Arabic-rooted vocabulary for what kind of relationship a customer, contributor, sponsor, or partner is actually in — replacing the looser SaaS/OSS/license-tier language we currently use.

The framework is more useful than we previously credited. An earlier version of this doctrine dismissed Akbar's taxonomy as "about land, not codebases." That dismissal was based on a mis-citation; once Akbar's actual three-claims + five-forms framework is read closely, the software portability is direct.

#### The three mechanisms (how Huquq actually operates)

Akbar names the operational practices through which Huquq-based systems produce sustainable, just outcomes — and these practices map 1-to-1 onto how good open-source software development already works:

> _"In traditional environments, these three factors flourished through several mechanisms: First, collective solution seeking… Second, action precedes permission… Third, refinement through conflict."_ — Akbar, _Rationality_ (1999)

| Akbar's mechanism               | The OSS practice it names                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Collective solution-seeking** | Pull requests, issue discussions, RFCs — many brains converge on a problem; the best solution emerges from the convergence |
| **Action precedes permission**  | Fork-then-PR culture; the OSS norm of "show, don't ask"; experimentation does not require central approval                 |
| **Refinement through conflict** | Code review iterations as productive friction; conflicting interests sharpen the diff                                      |

Akbar frames the built environment as _"an open laboratory in which all users' brains, given the chance to experiment with an element, will find the best solution to a given problem."_ The same is true of the codebase: every fork is an experiment, every PR is a proposal, every review is refinement. The CU contribution-as-evidence principle expresses the same idea — measurement of what works, not approval of what's proposed.

Akbar's broader epistemic framing (via Imre Lakatos in his 2019 _Rights and Civilizations_) treats Huquq as a research-program **hard-core** with a **protective belt** of three elements: access to resources/knowledge, freedom of action without damaging others, and accommodation of basic human tendencies. Our CU spec maps the same shape: a hard-core (justice = fair access by evidence of contribution, line 6 of `hogwarts/content/docs-en/shared-economy.mdx`) with a protective belt (anti-gaming controls, $45/hr floor, contestable valuations, supermajority governance). The governance layer specifically — Akbar's "individual-and-State" relationship, the one most OSS communities under-specify — is the load-bearing operational expression of this in Databayt: vote caps, founder-power decay, emergency brake, external arbitration, all in the hogwarts CU spec.

#### Darar and dirar (the harm distinction)

The "no harm to commons" constraint we named in Part II §D is grounded in a Prophetic tradition that distinguishes two kinds of harm:

> _"لا ضرر ولا ضرار"_ — _"There should be neither harming nor reciprocating harm."_

Akbar (1999) parses this carefully:

> _"Darar is what an individual benefits from at the expense of others, such as, for example, changing a residential property to a factory whose noise or effluent will harm neighbors; dirar means an action which harms others without benefiting the acting individual, such as opening an unneeded window to look at the neighbor's yard."_

The distinction matters because it names two different harm patterns and points to two different policies:

- **Darar (ضرر) = extractive harm.** The actor benefits at others' expense. **This is the harm SSPL is structured to prevent.** A closed competitor reselling our code commercially (benefit) without contributing back to the contributor pool (harm) is the textbook _darar_ case. SSPL conditions the benefit on the contribution.
- **Dirar (ضرار) = gratuitous harm.** The actor harms others without even benefiting themselves. **This is the harm trademark policy is structured to prevent.** A bad-faith fork that misuses the "Hogwarts" or "Databayt" name to mislead users (harm) without commercial benefit to the actor (no upside) is the textbook _dirar_ case. The trademark policy in `hogwarts/TRADEMARKS.md` exists for this category specifically.

Two harm categories, two policies, two mechanisms — Akbar's vocabulary names them precisely.

#### Codebase-as-laboratory

> _"The built environment can be viewed as an open laboratory in which all users' brains, given the chance to experiment with an element, will find the best solution to a given problem."_ — Akbar, _Rationality_ (1999)

And: _"Conventions cannot be made, they evolve."_

The codebase is the same kind of laboratory. The CU spec's principle of contestable valuations, the public ledger, the formula-as-source-of-truth, and the explicit deferral of operational mechanics to Samia's Q3 2026 framework are all expressions of this: we are not designing the optimal share-economy formula in one shot. The formula evolves through use, contested by contributors, refined through conflict. Premature standardization is destructive; lived practice produces the convention.

#### Akbar's framing of what Huquq is for (Ummatics 2024)

In the May 2024 Ummatics colloquium parts I and II, Akbar sharpens _Qas al-Haq_'s thesis along four lines worth absorbing into the doctrine:

**1. The Umma is created through Huquq, not through identity.** Akbar (paraphrased from the Part I summary): _"The Umma can only be created through ḥuqūq: revival requires that its members understand and exercise their rights as defined by Sharīʿa."_ Translation for Databayt: the community is not created by branding, marketing, or even shared affinity — it is created by a working rights structure that lets contributors actually exercise ownership over what they produce. The community is downstream of the structure, not upstream.

**2. Huquq fills the vacuum neoliberalism opens.** Akbar (paraphrased): _"Whereas neoliberalism centers economy, leading to debates over the role of government, creating a vacuum, Qaṣ al-Ḥaq fills that vacuum with its centerpiece: ḥuqūq."_ For Databayt: the open-source / SaaS / hybrid space is exactly the neoliberalism-meets-public-good vacuum. Our doctrine fills the vacuum not with a stronger state (regulator) or a stronger market (proprietary licensing) but with a rights structure (SSPL + CU + Community Pool).

**3. Three concrete failures of capitalism Akbar names.** The Ummatics recap identifies Akbar's three concrete capitalism critiques: **exploitation**, **separation of worker from owner**, and **supply-chain pollution**. The doctrine should note where its own structure addresses each: SSPL prevents extractive reselling (anti-exploitation); CU makes the contributor the owner (anti-separation); the no-harm-to-commons constraint is the structural equivalent of anti-supply-chain-harm.

**4. Distinguishes ḥuqūq from "empowerment."** Akbar (paraphrased from Part I): _"Ḥuqūq are distinct from 'empowerment' or 'enablement' achieved through grassroots movements. The latter only exist in systems that encourage competing interest groups to struggle and take their rights from central authorities, often leading to societal unrest and instability, whereas the stability of Islamic society comes from clear and well-defined rights and responsibilities that have persisted over centuries."_ For Databayt: contributor ownership is a _right structure_, not an empowerment program. We do not grant contributors a share of the company; the share is theirs by the structure, not a gift. This is the structural reason the model is Counter-Positioning — a closed competitor cannot replicate it without changing the rights structure, which is itself the business model.

#### Akbar's Quranic anchors (Ummatics 2024)

Akbar cites three specific Quranic verses to anchor the rights-based-economy frame. Briefly:

- **al-Hashr 59:7** — _"كَيْ لَا يَكُونَ دُولَةً بَيْنَ الْأَغْنِيَاءِ مِنكُمْ"_ — wealth must not circulate only among the wealthy. The verse is the Qur'anic grounding for redistributive structures (zakat-aligned needs fund; waqf-track Community Pool).
- **at-Tawbah 9:60** — the eight categories of zakat recipients. Akbar reads this as defining the legitimate scope of redistributive obligation, not as exhausting the categories — our Needs Fund's beneficiary list draws from these eight but adapts them to a digital-knowledge-economy context.
- **al-Anfal 8:41** — the rules for distributing earned wealth (originally framed for spoils-of-war but read by Akbar and others as a general principle of structured redistribution). The verse establishes that wealth distribution is a _defined-rules_ matter, not a discretionary one — a contributor's share is structural, not given.

These verses are anchors for the constraint that **the model is not a kindness from the founder to the contributors; it is a structural commitment that the rights structure enforces.**

#### What we still do NOT import from Akbar

We integrate the framework, the mechanisms, the harm distinction, and the laboratory frame. We do **not**:

- Claim Databayt implements full Akbarian Huquq. We use the framework as a lens; we do not claim conformance to classical Islamic-legal Huquq.
- Import Akbar's broader critique of the nation-state into company doctrine. He is making a civilizational argument; we are a six-person SaaS company.
- Adopt his pre-modern Muslim-city historical claims as evidence for business decisions. They are his analytical examples, not our operational data.
- Use his harshest critiques of Western thinkers (Harvey, Mason, Rifkin). Those are scholar-to-scholar disagreements, not company doctrine.

The framework is a vocabulary and a lens. It is not a manifesto or a fatwa.

#### Further reading

- Akbar, J. (1984). _Responsibility and the Traditional Muslim Built Environment._ PhD dissertation, MIT Department of Architecture (advisor: N. John Habraken). 473pp. — source of the three-claims framework.
- Akbar, J. (1988, 2nd ed. 2021). _Crisis in the Built Environment: The Case of the Muslim City._ — source of the five forms of submission.
- Akbar, J. (1992/1995, Beirut). _إمارة الأرض في الإسلام._
- Akbar, J. (1999). _Rationality: Blight of the Muslim Built Environment._ — source of the three mechanisms and the darar/dirar distinction.
- Akbar, J. (2014, 2nd ed. 2022). _قص الحق_ (_Qas al-Haq_). 1,800pp. ISBN 978-625-7489-133.
- Akbar, J. (2019). _Rights and Civilizations._ — Lakatosian framing of Huquq.
- Akbar, J. (2023). _Property Rights (Ḥuquq) and Civilizations._ Keynote, "City and Civilization Congress," Ankara. 37pp. — most accessible English summary.
- Ummatics colloquium (2024). "Qas Al-Haq: An Alternative to Capitalism, Nation-State, Parts I & II." [ummatics.org](https://ummatics.org/colloquium-qas-al-haq-an-alternative-to-capitalism-nation-state-parts-i-ii/).
- Bibliography at [en.jamelakbar.com](https://en.jamelakbar.com/).

---

### §B — NMBD: production-solidarity

> _"في السودان، يوجد قيمة التضامن — ولكن بدلاً من التضامن في الاستهلاك فقط، دعونا نتضامن في الإنتاج."_
>
> _In Sudan, the value of solidarity already exists — but instead of solidarity only in consumption, let us be in solidarity in production._
>
> — الحركة الوطنية للبناء والتنمية (NMBD), _ورقة الاقتصاد التشاركي_ (Participatory Economy Paper)

#### The movement

الحركة الوطنية للبناء والتنمية (al-Ḥarakah al-Waṭaniyyah lil-Binā' wa-l-Tanmiyah, the National Movement for Construction and Development, "NMBD") is a Sudanese comprehensive social and political reform movement. Its founding posture: comprehensive reform across Sudanese society, drawing on Islamic ethical heritage and on universal principles of freedom and justice. Published papers include the Foundational Declaration (البيان التأسيسي), the Comprehensive Sudanese Social Contract (الميثاق الاجتماعي السوداني الشامل), and the references-and-objectives document. The movement's economic-policy paper, _ورقة الاقتصاد التشاركي_ (the Participatory Economy Paper), was named in a 2024 initiative to be operationalized by launching a real-world participatory economic activity. The movement's economic vision is championed by **Qasim al-Zafer** (قاسم الظافر) — Abdout names him alongside Akbar and Khedr as one of the three foundational anchors of this doctrine (the entrepreneurial spirit of Khedr's _Raed A'mal_, the justice-driven narrative of Akbar's _Qas al-Haq_, and the national movement's economic vision championed by al-Zafer). Movement site: [nmbdsd.org](https://www.nmbdsd.org/); vision page: [binaa-sudan.org/afkar/alahdaf](https://www.binaa-sudan.org/afkar/alahdaf).

We engage with NMBD as a source of **economic-philosophical material**, not political doctrine. The movement is one of several intellectual traditions that has thought clearly about Sudanese production and economic life; we draw a specific principle from a specific paper. (See "Lineage scope" below for the discipline we apply to citations.)

#### The single core idea we take

The principle worth keeping is one sentence — already quoted at the top of this section — and one move:

**Move solidarity from the consumption side of the economy to the production side.**

Most contemporary frameworks for "community" or "solidarity" in business operate on the consumption side: discounts, group-buying, mutual aid, charity. Those are real. They are also downstream. They redistribute what production has already created. They do not change who produces or how production is organized.

NMBD's move is to ask the question one layer earlier: **who participates in production, and how is the value of their participation valued?** Production-solidarity, in this frame, is not a slogan about cooperation; it is a structural commitment that production decisions and production rewards are shared among the people doing the producing.

#### Where it lives in Databayt

This principle is already the operating reality of how the company describes its relationships. The doctrine names what is already practiced:

- **Ahmed Baha at King Fahad Schools is a partner, not a customer.** (`CONSTITUTION.md` line 17; `PRINCIPLES.md` #14.) His feedback, case studies, roadmap input are contributions; he is part of production, not only consumption.
- **The MENA-10 pilot cohort is a partnership cohort, not a sales pipeline.** (`hogwarts/content/docs-en/shared-economy.mdx` line 6; `hogwarts/content/docs-en/pilot.mdx`.) Pilot schools receive founder-level attention; their participation shapes the platform.
- **Contributors are owners, not labor.** (`PRINCIPLES.md` #22.) The CU spec measures contribution; ownership accrues to the people doing the producing.
- **Sponsors-as-partners is the right framing for any future sponsorship.** Not "donors" or "customers" — co-producers whose capital participates in the same production model as code, design, and content.

NMBD gives that recurring posture a precise name. **التضامن في الإنتاج / production-solidarity** is the operative principle of the company; we should use the term internally and in pitch materials.

#### Lineage scope (intentional)

NMBD's published intellectual influences include a wide range of Islamic and civilizational thinkers. Of the figures listed in the movement's public material, we name only two as references in this doctrine:

- **مالك بن نبي (Malek Bennabi, 1905–1973)** — Algerian Islamic civilizational thinker. _Vocation of Islam_, _Conditions of the Renaissance_, _The Problem of Ideas in the Muslim World_. Civilizational, not partisan.
- **ابو القاسم حاج حمد (Abu al-Qasim Hajj Hammad, 1942–2004)** — Sudanese thinker on Qur'anic methodology and contemporary thought. _المنهجية القرآنية_ (Qur'anic Methodology). Sudanese-rooted, philosophically focused.

We **do not** name in this doctrine the other figures sometimes associated with the movement's intellectual lineage. The reason is discipline, not disagreement: this is a company doctrine, not a survey of Islamic thought, and the doctrine is read by sponsors, investors, contributors, and partners across very different political contexts. Citing the _principle_ and citing the safe-civilizational _lineage_ is sufficient; naming politically charged figures risks turning the doctrine into a political document, which is not its purpose.

#### Further reading

- الحركة الوطنية للبناء والتنمية. _ورقة الاقتصاد التشاركي._ [nmbdsd.org](https://www.nmbdsd.org/).
- _البيان التأسيسي_ (Foundational Declaration). NMBD.
- _الميثاق الاجتماعي السوداني الشامل_ (Comprehensive Sudanese Social Contract). NMBD.
- Bennabi, Malek. _شروط النهضة_ (Conditions of the Renaissance, 1949). Available in multiple Arabic and French editions; English translation under _Conditions of the Islamic Renaissance_.
- Bennabi, Malek. _وجهة العالم الإسلامي_ (Vocation of Islam, 1954).
- Hajj Hammad, Abu al-Qasim. _المنهجية القرآنية_ (Qur'anic Methodology).

---

### §C — Khedr: MENA-context equity methodology

#### The author

د. محمد حسام خضر (Dr. Mohammed Hossam Khedr) is an Egyptian engineer and entrepreneur. Cairo University Faculty of Engineering (1997). Marketing Management diploma, British Institute (1999). MBA, Universitat Autònoma de Barcelona (2017). DBA, Business Administration (2025). Founder and seller of multiple ventures, including the Egyptian women's online forum **Fatakat** (one of the largest Arabic-language community platforms of its era). Investor (angel and venture) in companies including CowBuy, Dukkan Tech, Glamira, and Villa, and managing-partner work at Endure Capital. Speaker and trainer at ArabNet, RiseUp, TechneSummit, and other regional conferences since 2017. Public brand **خضر و بزنس** (Khedr & Business) on YouTube and Facebook; consulting via personal site.

Published book: _**رائد الأعمال Inside Out**_ (Dar Don, 2019, 239 pages, ISBN 9789778061598). The book is a collection of essays on entrepreneurship and business management blending technical-practical material with psychological-spiritual perspectives. Reviewer consensus on the book emphasizes the chapters on partner equity allocation and partnership disagreement / exit structures as particularly valuable. Average rating ~4.30 / 5 on Goodreads across 229 ratings (as of crawl date 2026-05).

#### The core argument

Khedr's central practical claim, repeated across the book and his "خضر و بزنس" channel, is that **the partnership structure must be agreed and documented before the company starts operating — never delayed.** A reviewer summary of the book's most-praised chapter (Equity Split / تقسيم حصص الملكية في المشروع) captures it:

> _"The engineer Khedr emphasizes the importance of discussing ownership equity shares in the project and how to distribute them, and not delaying this to after the company starts operating. He notes that delaying this leads to many problems that could be the reason for the company's failure."_

This is the equivalent for partnerships of "premortem before launch" — the structure of how value will be split must be decided when the partners are aligned and unattached to outcomes, not when stakes are high and trust has eroded.

#### The five specific Khedr contributions Databayt borrows

**1. Two equity-allocation methodologies, scoped to company type.**

Khedr explicitly distinguishes two methodologies: one for **traditional companies** (small/medium business, established cash flow, contributions roughly proportional to investment) and one for **startups** (uncertain outcome, contributions more weighted toward execution and risk). The methodologies differ in how they handle vesting, dilution, and exit. For Databayt, this distinction matters: a custom-build Mudaraba contract with King Fahad Schools (traditional shape, defined deliverable, known revenue) follows the traditional methodology; the broader CU framework for ongoing contribution to Hogwarts or Souq (uncertain trajectory, contributions across years, future value unknown) follows the startup methodology.

**2. "Khedr Helicopter" — staged-commitment expansion.**

Khedr's named expansion framework treats company growth as a sequence of stages where each stage's commitment depends on the previous stage's demonstrated traction. The metaphor: a helicopter ascends in controlled stages rather than launching like a rocket. For Databayt: the pilot → paid → scale progression should follow this shape. The MENA-10 free pilot cohort (`hogwarts/content/docs-en/pilot.mdx`) is the first stage; conversion to paid is the second; multi-school expansion is the third. Each stage's commitment (founder time, contributor allocation, partnership exclusivity) should scale to that stage's traction, not be promised at the start.

**3. Pre-launch equity contract.**

Khedr's "discuss equity before operations begin" principle implies a specific operational rule: every Databayt partnership — sponsored build, multi-contributor block, joint product effort — should have a written equity/CU allocation agreement before the first commit. The agreement specifies: contributor shares, vesting schedule, exit conditions, dispute resolution. The CU spec in `hogwarts/content/docs-en/shared-economy.mdx` covers measurement; what Khedr adds is the **pre-commitment contract layer**.

**4. Partner departure protocols.**

Khedr's book devotes substantial attention to **what happens when a partner leaves** (voluntarily, involuntarily, or by death). The patterns: bought-out vested CU at fair valuation; unvested CU returns to the pool; non-compete cooling-off period proportional to contribution depth; IP and customer-relationship transfer documented in advance. For Databayt, this maps directly to the contributor lifecycle — a contributor who has accrued CU for two years and then leaves should have a defined departure path that doesn't require negotiation under stress.

**5. Sharia-compliant non-compete templates.**

Khedr's published frameworks include non-compete clauses calibrated to the Islamic-legal context — limited in geographic scope, limited in duration, compensated where they restrict legitimate livelihood, and structured to avoid the _gharar_ (excessive uncertainty) that classical fiqh treats as invalidating. Databayt's future contributor agreements (when MRR triggers paid hires per `hiring.md`) should follow this shape, not the Silicon Valley default of broad, long, uncompensated non-competes that wouldn't survive MENA-context review anyway.

#### Where each Khedr contribution lives in Databayt

| Contribution                                     | Where it operates today                                                      | Where it operates as we scale                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Two equity methodologies (traditional / startup) | (gap — implicit; CU is one-size-fits-all)                                    | Multi-class CU schema (CU-Cap / CU-Lab / CU-Strat); separate Mudaraba template for sponsored builds                        |
| Khedr Helicopter (staged expansion)              | MENA-10 pilot cohort = stage 1                                               | Conversion-to-paid = stage 2; multi-school scale = stage 3; partnership commitments scale with traction                    |
| Pre-launch equity contract                       | (gap — partnerships are presently informal)                                  | Standard pre-commit equity agreement template for every multi-party project, including custom builds                       |
| Partner departure protocols                      | (gap — never tested at Databayt)                                             | Departure handbook in `databayt/revenue` repo (Samia Q3); bought-out vested CU at fair valuation; unvested returns to pool |
| Sharia-compliant non-compete                     | (no contributor agreements yet — $0 cash compensation phase per `hiring.md`) | First contributor agreements at MRR ≥ $3K trigger (per hiring.md); non-compete templates follow Khedr's pattern            |

#### Khedr's broader career context

Khedr (b. ~1974) is not an academic theorist; he is a practitioner who has run companies for ~28 years. He founded **Internet Plus** (one of his early companies, still operating), founded multiple ventures including **ألعاب شمس** (Sun Games) which was acquired by a larger firm, was a Managing Partner at **Endure Capital** (Egyptian VC), and is an active angel investor in MENA startups (CowBuy, Dukkan Tech, Glamira, Villa, and others). His credibility for the doctrine comes from this practitioner pedigree: he has been on every side of the table (entrepreneur, investor, mentor, consultant) and has seen the partnership failures that his frameworks are designed to prevent.

This is also why his frameworks are MENA-shaped rather than imported: he built his playbook in Cairo and Riyadh, not Silicon Valley, and his Sharia-compliance work is grounded in the legal and cultural context his contracts actually operate in.

#### Further reading

- Khedr, M.H. (2019). _رائد الأعمال Inside Out._ Dar Don. ISBN 9789778061598. 239pp. — 30+ chapters; the Equity Split chapter is the most-cited by reviewers.
- إضاءات review of _رائد الأعمال Inside Out_: [ida2at.com/entrepreneur-inside-out-book-overview](https://www.ida2at.com/entrepreneur-inside-out-book-overview/) — accessible Arabic summary covering the partnership, startup-vs-traditional, and product-development chapters.
- Khedr's YouTube channel: **خضر و بزنس** (Khedr & Business) — practical episodes on equity, investor pitching, partnership disputes, exit strategies.
- Khedr's site: [ratteb.com/mohamed-hossam-khedr-2](https://ratteb.com/mohamed-hossam-khedr-2).
- "خضر و بزنس" podcast: [Apple Podcasts](https://podcasts.apple.com/us/podcast/خضر-و-بزنس-khedr-w-business/id1487593681).
- 3-hour interview on **خمسة بيزنس** podcast: [Apple Podcasts](https://podcasts.apple.com/us/podcast/٣-ساعات-مع-د-محمد-حسام-خضر/id1501074558?i=1000495560552) — deep on his methodologies.
- "Ask an Expert" with Dr. Khedr on investment and entrepreneurship: [Egypt Innovate](https://egyptinnovate.com/ar/فيديوهات-الخبير/اسأل-خبير-مع-د-محمد-حسام-خضر-عن-الاستثمار-وريادة-الأعمال).
- Khedr's Goodreads page: [goodreads.com/author/show/19826615](https://www.goodreads.com/author/show/19826615._).

---

### §D — Islamic economic primitives (the vocabulary)

The four primitives in this section give Databayt a precise Arabic-rooted vocabulary for what is otherwise described in mixed English-language terms. We use these terms with discipline — each one names a specific operational mechanism, scoped narrowly. We do **not** claim full classical-fiqh conformance; we cite each primitive for the principle it expresses, name where we follow it precisely, and name where we honestly diverge.

#### مضاربة (Mudaraba) — silent partnership for sponsored builds

**Classical structure.** A two-party contract: a capital provider (رب المال, _rabb al-mal_) and a working partner (مضارب, _mudarib_). Profit is shared by a pre-agreed ratio; loss is borne by the capital provider unless the _mudarib_ acted in negligence. The activity, the capital amount, the profit-sharing ratio, and the termination conditions must be defined in advance.

**Where Mudaraba applies in Databayt.** **Sponsored custom-build contracts only.** Examples:

- A school network commissions a custom Hogwarts customization (e.g., a specific reporting module): the sponsor is _rabb al-mal_, the Databayt team is _mudarib_, profit on the custom-build revenue is shared per the contract.
- A foundation funds a specific feature build (e.g., an offline-mode tier for low-bandwidth rural schools): same structure.

**Where Mudaraba does NOT apply.**

- SaaS subscriptions: not Mudaraba (no defined capital from customer; just a recurring usage fee).
- Per-student pricing: not Mudaraba (no defined project; just access to ongoing product).
- Free MENA-10 pilots: not Mudaraba (no capital contribution).
- Any future investor relationship: investors are not _rabb al-mal_ under Mudaraba unless the structure explicitly matches (defined project, defined termination, asymmetric loss-bearing). Most investor relationships will be musharaka-shaped instead.

**Operational implication.** When Databayt accepts a sponsored custom-build, the contract template should follow Mudaraba structure. The future Spec doc (Samia, Q3 2026) will codify the standard Mudaraba contract template Databayt uses.

#### شِركة الأعمال (Shirkat al-A'mal) — partnership of labor

**Classical structure.** A partnership where the substance contributed is _work_ rather than _capital_. Partners contribute services or labor toward a shared activity, and profit is divided by an agreed ratio — which need not be equal and can be re-negotiated as the partnership matures. (This is a recognized variant in Islamic commercial-fiqh literature, alongside the more capital-centric _musharaka_ and the diminishing variant _musharaka mutanaqisa_.)

**Where Shirkat al-A'mal applies in Databayt.** **The contributor-as-owner model.** Code contributors, designers, content writers, sales-and-outreach workers, translators — all of them contribute work, not capital, and earn share by contribution. The Contribution Units framework in `hogwarts/content/docs-en/shared-economy.mdx` is the operational expression of _shirkat al-a'mal_.

This is the **precise Arabic-rooted term for what the CU spec measures.** We adopt the term in internal vocabulary, in pitch materials when speaking to MENA partners, and in the Arabic version of the public-facing docs.

**Honest divergence.** Classical _shirkat al-a'mal_ would distribute **both profit AND loss** pro-rata to partners' contribution share. The Databayt CU model **caps contributor downside**: operational losses are absorbed by the operating reserve and ultimately by the founder, not redistributed back to contributors. This is the right design choice for an early-stage company where most contributors are not in a position to underwrite operational risk — but it is a divergence from the classical structure, and the doctrine names it honestly rather than papering over it. A contributor who reads Islamic-commercial-fiqh material and then reads the CU spec should not be surprised; this section is the bridge.

#### وقف (Waqf-track) — perpetual community pool

**Classical structure.** A _waqf_ is a perpetual, irrevocable endowment dedicated to a specified beneficial purpose, administered by a custodian (_nazir_) under defined rules. Once declared, a _waqf_ cannot be revoked or repurposed; the property is locked.

**Where Waqf applies in Databayt — today and tomorrow.** We pledge that a defined percentage of Databayt revenue (target: 5%) will be **administratively segregated into a Community Pool the moment MRR exists.** The pool is intended to mature into a formal _waqf_ instrument when three activation triggers all fire:

1. MRR ≥ $10K/month sustained for 12 consecutive months.
2. Databayt is registered as a legal entity in a jurisdiction (likely Sudan, Saudi Arabia, or the UAE) with a structure compatible with hosting a _waqf_.
3. External counsel — Sharia-compliance and corporate-law together — advises on the correct _nazir_ (custodian) arrangement, beneficiary classes, and amendment rules.

**Until those triggers fire**, the pool exists as a **pledged percentage** with administrative segregation. We call it the **"Community Pool (waqf-track)"** rather than "the waqf" in the meantime, because a _waqf_ without an instrument, without a _nazir_, and without enforceable rules is a vow, not a contract — and the _gharar_ (excessive uncertainty) concern in Islamic commercial fiqh would itself disqualify it.

**Purposes the Community Pool serves.** When activated, the pool funds: open infrastructure (CDN, hosting, build, monitoring); contributor scholarships; emergency support for contributors in distress; community events and education in Arabic-speaking regions. The exact beneficiary policy is part of Samia's Q3 framework, not this doctrine.

#### زكاة (Zakat-aligned needs fund)

**Classical structure.** _Zakat_ is a religious obligation, not a corporate commitment. It is owed on accumulated wealth held for a full lunar year (_hawl_) above a specified minimum (_nisab_), at a rate of 2.5%. It has eight named recipient categories (Surah at-Tawbah 9:60) and is, in Islamic-legal terms, a duty of individual Muslims, not corporations.

**What we mean when we say "Zakat-aligned" at Databayt.** We adopt **the 2.5% rate, the redistribution intent, and the principle of structural obligation** — but we do **not** claim our redistribution is _zakat_ in the legal-fiqh sense. We call our mechanism the **"Needs Fund / صندوق العون"** to avoid that conflation.

**Mechanism.** When Databayt has net profits, **2.5% of net profits** (not revenue, not accumulated wealth) is allocated to the Needs Fund. The fund is distinct from the Community Pool (waqf-track): the Community Pool funds _purposes_ (infrastructure, events, scholarships); the Needs Fund funds _people in need_. The fund is also distinct from the existing $30/$45 pay-floor and profit-redistribution mechanism in the CU spec: that mechanism adjusts compensation for under-paid active contributors, while the Needs Fund supports contributors in genuine need (illness, displacement, conflict-zone disruption).

**Recipient categories.** Drawn from but not identical to the classical eight; chosen for our context:

- Contributors based in conflict zones (Sudan war, Yemen, Gaza-region, etc.) whose work has been disrupted.
- Contributors in medical or displacement emergencies.
- New contributors below the pay-floor whose situation requires interim support during onboarding.
- Education-cause grants for partner schools in our network facing crisis.

The detailed beneficiary policy is part of Samia's Q3 framework, not this doctrine.

#### Underlying constraints (riba, gharar, harm)

Three principles from Islamic commercial fiqh sit underneath the four primitives above. They are constraints on product and financial decisions, not products in themselves:

- **No riba (ربا — interest extraction).** Databayt does not lend money at interest, and does not borrow at interest where avoidable. Where customer credit is offered (e.g., installment-payment plans for school subscriptions), the structure is markup-based (_murabaha_-style) or fee-based, not interest-bearing.
- **No gharar (غرر — excessive uncertainty).** Contracts are precise. Mudaraba projects have defined scope, capital, profit-sharing ratio, and termination. SaaS subscriptions have transparent pricing. CU calculations have public formulas and contestability per the existing spec.
- **No harm to commons (الضرر).** SSPL exists in part to prevent extractive behavior toward the open-source commons. Trademark policy in `hogwarts/TRADEMARKS.md` exists in part to prevent confusion harm. The community-protections in the CU spec (Sybil prevention, anti-collusion, velocity limits) exist to prevent harm to the contributor commons.

These three constraints are stated here so that future product, financial, and contract decisions can be evaluated against them as a checklist. They are not a Sharia-compliance certification; they are a posture.

---

## Part III — Reference → mechanism translation

The doctrine's load-bearing claim is that each reference maps to a concrete mechanism that already exists or has a named owner. The table below is the bridge from philosophy to operations.

| Reference                                 | Principle expressed                                                                  | Where it operates in Databayt today                                                                                                                                  | Where Samia Q3 2026 formalizes it                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Akbar / Huquq**                         | Rights-based access > property-based exclusion                                       | SSPL license on hogwarts; open-by-default across all 14 repos; CU does not require permission to acquire, only evidence of contribution                              | (no further formalization needed — license is the structural enforcement)                                                                                      |
| **Akbar / 3 claims + 5 forms**            | Ownership / control / use combine into 5 partnership shapes                          | All five forms present today (Hogwarts SaaS = Permissive; self-hosted = Possessive; solo dev = Unified; sponsored build = Dispersed; future waqf pool = Trusteeship) | Form-aware contract templates for each (Mudaraba for Dispersed sponsored builds; standard SaaS T&C for Permissive; self-hosting handbook for Possessive; etc.) |
| **Akbar / 3 mechanisms**                  | Collective solution-seeking, action-precedes-permission, refinement-through-conflict | OSS already practices all three: PRs, fork-then-PR, code review iterations (see `hogwarts/content/docs-en/contributing.mdx`)                                         | (already operational; doctrine names what already happens)                                                                                                     |
| **Akbar / darar–dirar**                   | Two harm patterns: extractive (darar), gratuitous (dirar)                            | SSPL prevents darar (extractive resale); trademark policy (`hogwarts/TRADEMARKS.md`) prevents dirar (confusion-harm)                                                 | (already operational)                                                                                                                                          |
| **NMBD / production-solidarity**          | Contributors are partners in production, not labor and not consumers                 | Partner-not-customer framing for Ahmed Baha and MENA-10 cohort; CU treats community/strategic work equally with code                                                 | (no further formalization needed — the principle frames the partnership policy)                                                                                |
| **Khedr / two equity methodologies**      | Distinct allocation logic for traditional vs startup company types                   | (gap today — CU is one-size-fits-all)                                                                                                                                | Multi-class CU schema (CU-Cap / CU-Lab / CU-Strat); separate Mudaraba template for sponsored builds                                                            |
| **Khedr / Helicopter (staged expansion)** | Each stage's commitment scales with previous stage's demonstrated traction           | MENA-10 pilot cohort = stage 1 (already in place)                                                                                                                    | Stage 2 = conversion-to-paid; stage 3 = multi-school scale; commitment scales with traction                                                                    |
| **Khedr / pre-launch equity contract**    | Document the partnership structure _before_ operations begin                         | (gap today — partnerships are informal)                                                                                                                              | Standard pre-commit equity agreement template for every multi-party project                                                                                    |
| **Khedr / partner departure protocols**   | Bought-out vested CU; unvested returns to pool; Sharia-compliant non-compete         | (gap — never tested)                                                                                                                                                 | Departure handbook; non-compete templates calibrated to MENA legal context                                                                                     |
| **Mudaraba**                              | Sponsored custom-build contract: capital + labor profit split                        | (handled ad hoc per project today)                                                                                                                                   | Standard Mudaraba contract template for sponsored custom-builds                                                                                                |
| **Shirkat al-A'mal**                      | Labor partnership: contributors are owners by contribution                           | The full CU measurement framework in `hogwarts/content/docs-en/shared-economy.mdx` (40/30/20/10 matrix, multipliers, anti-gaming)                                    | CU pool sizing across repos, founder reserve %, operating reserve %, per-repo weighting                                                                        |
| **Waqf-track**                            | Perpetual community pool from revenue                                                | Pledge only (no MRR yet)                                                                                                                                             | Activation when triggers fire; _nazir_ arrangement; beneficiary policy; legal-entity hosting                                                                   |
| **Zakat-aligned (Needs Fund)**            | 2.5% on net profits for contributors in need                                         | Pay-floor (existing) addresses different beneficiaries                                                                                                               | 2.5% rule + beneficiary-categories policy; trigger conditions; conflict-zone discipline                                                                        |
| **No riba / gharar / harm**               | Constraint on product, financial, and contract decisions                             | SSPL (anti-harm), pricing transparency (anti-gharar), no interest-bearing customer credit (anti-riba)                                                                | Pricing review checklist; contract template review; product decision review                                                                                    |

The four "today" rows already operate at company scale. The four "Samia Q3 2026" rows are the operational specification work assigned to the R&D function with a written framework deadline of Q3 2026, to live in the (not-yet-created) `databayt/revenue` repo. This doctrine does **not** pre-commit those rows.

---

## Part IV — What this document IS and IS NOT

> _"Conventions cannot be made, they evolve."_ — Akbar, _Rationality_ (1999)

The doctrine is a vocabulary and a posture. The operational shape evolves through use, contributors, and Samia's Q3 2026 framework. It is not designed in one shot.

### What this document IS

- **Positioning.** The frame Databayt uses to describe itself to sponsors, investors, contributors, partners, and the public.
- **Posture.** The orientation that informs Type-1 decisions about license, pricing, partnership structure, and revenue distribution.
- **Intellectual lineage.** A named, verifiable set of references that grounds the existing posture in a tradition broader than Silicon Valley operator canon.
- **Captain context.** When the captain agent needs to ground a share-economy-related recommendation, this document is the canonical reference. It is reached from `CONSTITUTION.md` §7 and `PRINCIPLES.md` #22, not auto-loaded into the captain's frontmatter.
- **Reading list.** For new contributors who want to understand the company's economic worldview; for Samia as foundational material before the Q3 framework; for future hires; for partners who ask "what do you mean by sharing economy?"

### What this document IS NOT

- **NOT the operational spec.** The CU formulas, contribution matrix, quality multipliers, $45/hr floor, governance rules, founder-reserve %, operating-reserve %, per-repo weighting, multi-class CU schema, conversion-to-cash mechanics, Mudaraba contract template — none of these live in this document. They live in `hogwarts/content/docs-en/shared-economy.mdx` today, and will live in `databayt/revenue` (when Samia creates it in Q3 2026) tomorrow. **This document does NOT change CU formulas. Samia's Q3 framework will.**
- **NOT a Sharia-compliance certification.** We name the Islamic primitives as posture and vocabulary. Sharia-compliance review of specific products, contracts, or financial structures is a separate professional review process that we will pursue when revenue, legal-entity structure, and counsel arrangement permit it.
- **NOT a fatwa.** We are a software company, not a religious authority. We make no claims about the Islamic-legal validity of any specific arrangement; we make claims about the structure of our own commitments.
- **NOT a political document.** NMBD references are economic-philosophical, not political. We engage with the _Participatory Economy Paper_ and the production-solidarity principle. We do not endorse — and this document does not align with — any specific political program.
- **NOT a substitute for the existing canon.** The CEO-OS Western canon (Bezos, Horowitz, Naval, Helmer, etc.) is complementary to this doctrine, not replaced by it. The Western canon answers _"how do we operate well as a company?"_ This canon answers _"in service of what?"_ Read both.

### Amendment cadence

This is a constitutional-level document. Amendments follow Constitution-amendment cadence:

- **Type-1 changes** (rewording the doctrine, adding or removing a reference, changing a primitive's scope) — written decision in `.claude/memory/decisions/<date>-amend-share-economy.md` first, per `PRINCIPLES.md` #5.
- **Type-2 changes** (correcting typos, fixing broken links, updating cross-link targets, light prose edits) — direct edits.
- **Quarterly review.** The doctrine is reviewed quarterly along with `CONSTITUTION.md`. Next review: 2026-08-13. The 2026-08-13 review will also check the 90-day premortem questions from `decisions/2026-05-12-share-economy-doctrine.md`.

---

## Part V — References and reading list

### The four references this doctrine draws from

**Khedr** — د. محمد حسام خضر

- Khedr, M.H. (2019). _رائد الأعمال Inside Out._ Dar Don. ISBN 9789778061598. 239pp.
- YouTube: **خضر و بزنس** (Khedr & Business).
- Site: [ratteb.com/mohamed-hossam-khedr-2](https://ratteb.com/mohamed-hossam-khedr-2).
- Goodreads: [goodreads.com/author/show/19826615](https://www.goodreads.com/author/show/19826615._).

**Akbar** — جميل عبد القادر أكبر

- Akbar, J. (1984). _Responsibility and the Traditional Muslim Built Environment._ PhD dissertation, MIT Department of Architecture (advisor: N. John Habraken). 473pp. DSpace handle: 1721.1/15572. — source of the three-claims framework (ownership / control / use).
- Akbar, J. (1988, 2nd ed. 2021). _Crisis in the Built Environment: The Case of the Muslim City._ — source of the five forms of submission of property.
- Akbar, J. (1992, 2nd ed. 1995, 3rd ed. Beirut). _إمارة الأرض في الإسلام_ (_Imarat al-Ard fi al-Islam_ / _Building the Earth in Islam_).
- Akbar, J. (1999). _Rationality: Blight of the Muslim Built Environment._ In O'Reilly, W. (ed.), _Architectural Knowledge and Cultural Diversity_, Comportements, pp.127-133. — source of the three mechanisms (collective solution-seeking; action precedes permission; refinement through conflict) and the darar/dirar harm distinction.
- Akbar, J. (2014, 2nd ed. 2022). _قص الحق_ (_Qas al-Haq_). 1,800pp. ISBN 978-625-7489-133.
- Akbar, J. (2019). _Rights and Civilizations._ 21pp. — Lakatosian framing of Huquq as the research-program hard-core with three protective-belt elements.
- Akbar, J. (2023). _Property Rights (Ḥuquq) and Civilizations._ Keynote at "City and Civilization Congress," Ankara, Nov. 2022; submitted Jan. 2023. 37pp. — most accessible English summary of the _Qas al-Haq_ argument.
- Akbar, J. (2025). _Why Imre Lakatos' Epistemological Method Best Suits Research in Urbanization: The Case of the Muslim Built Environments._ Archnet-IJAR.
- Ummatics colloquium (2024). "Qas Al-Haq: An Alternative to Capitalism, Nation-State, Parts I & II." [ummatics.org](https://ummatics.org/colloquium-qas-al-haq-an-alternative-to-capitalism-nation-state-parts-i-ii/).
- Bibliography at [en.jamelakbar.com](https://en.jamelakbar.com/).
- Wikipedia profile: [en.wikipedia.org/wiki/Jamel_Akbar](https://en.wikipedia.org/wiki/Jamel_Akbar).

**NMBD** — الحركة الوطنية للبناء والتنمية

- _ورقة الاقتصاد التشاركي_ (Participatory Economy Paper). [nmbdsd.org](https://www.nmbdsd.org/).
- _البيان التأسيسي_ (Foundational Declaration).
- _الميثاق الاجتماعي السوداني الشامل_ (Comprehensive Sudanese Social Contract).
- Vision page: [binaa-sudan.org/afkar/alahdaf](https://www.binaa-sudan.org/afkar/alahdaf).
- Bennabi, Malek. _شروط النهضة_ (Conditions of the Renaissance, 1949); _وجهة العالم الإسلامي_ (Vocation of Islam, 1954).
- Hajj Hammad, Abu al-Qasim. _المنهجية القرآنية_ (Qur'anic Methodology).

**Islamic economy primitives**

- Iqbal, Z., & Mirakhor, A. _An Introduction to Islamic Finance: Theory and Practice_ (2nd ed., Wiley, 2011) — accessible English textbook covering mudaraba, musharaka, waqf, zakat.
- AAOIFI (Accounting and Auditing Organization for Islamic Financial Institutions) standards — operational reference for Sharia-compliant contract structures. [aaoifi.com](https://aaoifi.com/).
- Cizakca, M. _A History of Philanthropic Foundations: The Islamic World from the Seventh Century to the Present_ (2000) — for waqf in practical history.

### How this canon relates to the Western canon in CEO-OS Part V

These references are **complementary** to the founder reading list in `CEO-OS.md` Part V (Grove, Horowitz, Graham, Bezos, Helmer, Naval, Hastings, Christensen, etc.), not substitutes. The two canons answer different questions:

- The Western canon: _"How do we operate well as a 7-person open-source bootstrapped company?"_ — fundamentals of management, decision-making, hiring, prioritization, strategy, customer development, runway discipline.
- This canon: _"In service of what?"_ — the economic-philosophical orientation that makes the operational discipline meaningful.

A founder who reads only the Western canon will build a company that operates well but does not know what it is for. A founder who reads only this canon will know what it is for but not know how to build it. Read both.

### Suggested reading order for new contributors

For a new contributor or hire who wants to understand the share-economy doctrine, read in this order over 3–4 weeks:

1. `CONSTITUTION.md` (all 7 values) — 30 minutes.
2. `PRINCIPLES.md` (all 24 principles, focus on Tier 6) — 1 hour.
3. This document — 2 hours.
4. `hogwarts/content/docs-en/shared-economy.mdx` (the operational CU spec) — 1 hour.
5. NMBD's _ورقة الاقتصاد التشاركي_ (a focused read of the paper) — 2 hours.
6. Khedr's _رائد الأعمال Inside Out_ (skim, focus on equity-allocation chapters) — 6 hours.
7. Akbar's Ummatics colloquium parts I & II (video) — 4 hours.
8. Iqbal & Mirakhor _Introduction to Islamic Finance_ (chapters on mudaraba, musharaka, waqf, zakat only) — 8 hours.

Optional deeper read: Akbar's _Crisis in the Built Environment_ (the entire book) — 15 hours.

### Suggested CEO-OS Part VII addition

The `CEO-OS.md` Part VII "Reading order" 12-week founder reading list (Grove → Horowitz → Graham → Bezos → Altman → Ries → Moore → Doerr → Lencioni → Collins → Helmer → Goldsmith) is good. **Add Khedr at week 13** as the bridge from the Western canon into the MENA-Islamic canon. _رائد الأعمال Inside Out_ is the right starting point because it is the most operationally concrete of the four references.

---

## Part VI — Cross-links and where to go next

### Within kun (this repo)

- `CONSTITUTION.md` §7 "Community is the moat" — the constitutional statement.
- `PRINCIPLES.md` #22 "Community is the moat" — the operating principle.
- `PRINCIPLES.md` #14 "Make a few users love you" — the MENA-10 partner-cohort expression.
- `CEO-OS.md` Part V (Founder canon, Section I added) — the bibliography that includes this doctrine's references.
- `CEO-OS.md` Part III Helmer's 7 Powers — the Counter-Positioning argument.
- `.claude/memory/decisions/2026-05-12-share-economy-doctrine.md` — the Type-1 decision entry for this doctrine.
- `.claude/memory/1on1/samia.md` — Samia's R&D mandate, including the Q3 2026 operational framework.
- `.claude/memory/hiring.md` — the equity / sweat / CU compensation phase; references the future `databayt/revenue` repo.

### Across databayt repos

- `hogwarts/content/docs-en/shared-economy.mdx` + `hogwarts/content/docs-ar/shared-economy.mdx` — the operational CU spec (measurement layer).
- `hogwarts/content/docs-en/business-model.mdx` — pricing tiers (FREE / PRO $1.50/student/mo / ENTERPRISE $1.00/student/mo) and equity terms.
- `hogwarts/content/docs-en/contributing.mdx` — commit conventions and contributor tiers.
- `hogwarts/LICENSE` (SSPL-1.0) + `hogwarts/docs/LICENSING.md` (dual-licensing) + `hogwarts/TRADEMARKS.md` — the license enforcement layer.
- `kun/content/docs/share-economy.mdx` + `share-economy.ar.mdx` — the public-facing contract on `kun.databayt.org/{en,ar}/docs/share-economy`.

### Future

- `databayt/revenue` — to be created by Samia in Q3 2026 as the home of the operational Spec. The "Samia Q3 formalizes" rows in Part III above are the contents of this future repo.

---

## Closing

> **Mission first. Speed last. Truth always.**
> Quality over speed. Mission over survival. Community is the moat.
>
> Open source, sharing economy — built in the open, shared as an economy, owned by the community that produces it.

This doctrine is not the spec. The spec is being written. This doctrine is the answer to the question _"in service of what?"_ — so that when the spec is finished, it points in the right direction.

التضامن في الإنتاج، لا في الاستهلاك فقط.
