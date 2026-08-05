# Golden set — calibration for `/draft`

Six pairs. **Every example is real repo material** — shipped decks, staged decks, and the actual
output of the unattended drain. Nothing here is invented, because invented examples calibrate
against a fiction instead of against this brand's voice.

The checks referenced are the seven in `content/docs/social/copy.mdx`. Read that first; this file
is the calibration, not the rule.

---

## 1. The hook — the drain's real failure

**BAD** — verbatim output of the 2026-08-05 drain, answering the `admission-highlight` brief.
Sourced from `hogwarts/content/docs-en/admission.mdx` (the log says so). It passed every gate the
pipeline had at the time.

```
القبول في مدرستك… من أول سؤال ولي الأمر إلى أول يوم للطالب.

في هوجورتس، رحلة القبول كلها في مكان واحد:

• الأسرة تسأل أو تحجز زيارة للمدرسة، ويصل الطلب إلى فريقك مباشرة.
• التقديم مجاني دائمًا — استمارة من خمس خطوات تُحفظ تلقائيًا، ويمكن إكمالها لاحقًا.
• يستلم ولي الأمر رقم طلب يتابع به حالته بنفسه، بدون مكالمة واحدة لمكتب القبول.
• فريقك يراجع ويقيّم ويرتّب المتقدمين، ثم يرسل عرض القبول برابط خاص.
• عند تأكيد التسجيل، يُنشأ ملف الطالب وأولياء الأمر والرسوم والفواتير ومقعده في الفصل — في خطوة واحدة.

النتيجة: مكتب القبول يقضي وقته مع الأسر، لا مع الأوراق.

وبيانات مدرستك تبقى لمدرستك وحدها — كل قراءة وكتابة محصورة في نطاق مدرستك.
```

What fails:

- **Check 1** — the first line is a table of contents. "From the parent's first question to the
  student's first day" describes the scope of a feature. Nobody has ever felt that.
- **Check 2** — five bullets. This is not one idea; it is a documentation page.
- **Check 4** — no scene anywhere. It was written from a feature list, so there was no Thursday
  in the source material to carry into the copy.
- **Check 5** — AR and EN are line-for-line parallel, same clause order. One is a translation.
- **Reject list** — `كل قراءة وكتابة محصورة في نطاق مدرستك` is _tenant scoping_, translated. The
  data-isolation guarantee is real and worth saying; this is the engineer's sentence for it, and
  a principal does not have the concept "read and write" about their own school.

**GOOD** — the same brief, rewritten:

```
مكتب القبول في أول الموسم: طابور عند الباب، وملفات على الطاولة، وهاتف لا يتوقف.

في هوجورتس تُقدّم الأسرة من هاتفها وتتابع حالة طلبها بنفسها — فيعود المكتب إلى الحديث مع
الناس بدل ترتيب الورق.

اطلب جولة على بيانات مدرستك: ed.databayt.org
```

```
First week of the season, the admissions desk is a queue, a stack of files, and a phone that
never stops.

With hogwarts a family applies from their phone and checks status themselves — so the desk goes
back to talking to people instead of sorting paper.

See it on your own school's data: ed.databayt.org
```

Note the EN sibling is anchored on **time** (_"first week of the season"_) where the AR is
anchored on **place** (`مكتب القبول`). That is check 5 satisfied deliberately, not accidentally.

---

## 2. The scene test, as a PASS

**GOOD** — `hogwarts/carousels/exams-one-entry.json`, caption, verbatim. The best copy in the org.

```
آخر الفصل مشهد يعرفه كل معلم: درجات تُرصد، ثم تُنقل، ثم تُكتب من جديد — ومع كل نسخة فرصة
جديدة للخطأ. في hogwarts الدرجة تُرصد مرة واحدة، ومنها تصدر الشهادات وكشوف الدرجات ويظهر
التقدير في حساب ولي الأمر. رصد واحد، مخرجات كثيرة — هكذا ينتهي الفصل بهدوء.
```

Why it works, clause by clause:

- `آخر الفصل مشهد يعرفه كل معلم` — **check 4 in the first six words.** The reader is inside their
  own memory before the product is mentioned.
- `تُرصد، ثم تُنقل، ثم تُكتب من جديد` — the failure named as a **rhythm**, not as a problem
  statement. Three verbs, escalating. This is where the sentence earns the reader.
- `ومع كل نسخة فرصة جديدة للخطأ` — the cost, stated once, with no number. **The moral gate's ban
  on invented metrics forced this, and it is better than a statistic would have been.**
- `رصد واحد، مخرجات كثيرة` — **check 2.** One idea, four words, and it is the whole product.
- `هكذا ينتهي الفصل بهدوء` — closes on a **feeling**, not a feature. Nothing is being sold in
  this clause and it is the reason the piece is memorable.

Note also the passives here are correct per the rung-1 passive rule: `الدرجة تُرصد مرة واحدة` is
_about the mark_, so hiding the actor costs the reader nothing.

Its EN sibling, and the three deliberate divergences — see pair 6.

---

## 3. The invented metric — and it is ours

**BAD** — `hogwarts/carousels/sms-pillars.json`, stat slide:

```json
{
  "type": "stat",
  "value": "20+",
  "label": {
    "ar": "ساعة إدارية تُوفَّر كل أسبوع",
    "en": "admin hours saved every week"
  }
}
```

This violates the moral gate **and** `content/social/pillars.json`'s own
`finance-without-spreadsheets` constraint, which says in as many words: _"no claimed hours-saved
figure."_ We have never measured it. Its `status` is `"draft"` and was never moved to `"staged"`
— the gate held, but by accident rather than by check.

**GOOD** — the honest shape of the same claim, from `hogwarts/carousels/hogwarts-intro.json`:

```
ساعة من الورق، تُنجز بنقرة.        An hour of paperwork, done in a click.
```

A **shape**, not a measurement. It makes the reader feel the ratio without asserting a number we
would have to defend. When you want to say "this saves a lot of time" and you have no data, say
the shape.

**Contrast — a number that IS allowed**, same deck:

```json
{
  "type": "stat",
  "value": "72",
  "label": {
    "ar": "لبنة مفتوحة المصدر تُبنى عليها مدرستك",
    "en": "open-source building blocks behind your school"
  }
}
```

72 is a fact about our repo. Anyone can count it. The test is not "no numbers" — it is **no number
you cannot point at.**

---

## 4. Abstraction vs. concrete

**BAD** (the register we drift toward when writing from a feature list):

```
منصة متكاملة لإدارة العمليات المدرسية وتحسين الكفاءة التشغيلية
```

Four abstraction nouns, zero objects. `متكاملة` and `الكفاءة التشغيلية` are both on the wordlist.

**GOOD** — `hogwarts-intro.json`, the answer slide, reduced to its spine:

```
القبول، الحضور، الدرجات، الفواتير — في مكان واحد.
```

Check 3. Name the things. The list of four nouns _is_ the value proposition, and it is shorter
than the abstraction that was standing in for it.

---

## 5. The CTA

**BAD** — two asks and no destination:

```
تواصل معنا لمعرفة المزيد، ولا تنسَ متابعة صفحتنا!
```

Two verbs, one exclamation mark, nowhere to go.

**GOOD** — `hogwarts-intro.json`, CTA slide:

```
اطلب عرضًا تجريبيًا  →  https://ed.databayt.org
Book a demo
```

One verb, one destination, last. Check 6.

---

## 6. The sibling test

**GOOD** — `exams-one-entry.json`, both locales:

```
آخر الفصل مشهد يعرفه كل معلم: درجات تُرصد، ثم تُنقل، ثم تُكتب من جديد — ومع كل نسخة فرصة
جديدة للخطأ. في hogwarts الدرجة تُرصد مرة واحدة، ومنها تصدر الشهادات وكشوف الدرجات ويظهر
التقدير في حساب ولي الأمر. رصد واحد، مخرجات كثيرة — هكذا ينتهي الفصل بهدوء.
```

```
End of term looks the same in most schools: marks entered, copied, then typed again — and every
copy is another chance for an error. In hogwarts a mark is entered once; report cards,
transcripts, and the parent's view all follow. One entry, many outputs — that is how a term ends
calmly.
```

The three deliberate divergences:

1. `مشهد يعرفه كل معلم` ("a scene every teacher knows") → _"looks the same in most schools"_.
   Different image, same recognition. The Arabic addresses the **teacher**; the English addresses
   the **institution** — which is where each language's reader sits on this channel.
2. `ومنها تصدر الشهادات وكشوف الدرجات` (active, the marks _issue_ the documents) → _"report cards,
   transcripts, and the parent's view all follow"_. English takes the list; Arabic takes the verb.
3. `هكذا ينتهي الفصل بهدوء` closes on **the term**; _"that is how a term ends calmly"_ closes on
   **the ending**. Same beat, different final word.

None of these are translation errors. All three are the doctrine working.

---

## What this file is not

Not a template library. Do not lift these sentences into a new post — `أسبوع المدير يذوب في الورق`
is spent, and reusing it makes the brand sound like it has one idea. Lift the **method**: open on
a scene, name the failure as a rhythm, land one claim, close on a feeling.
