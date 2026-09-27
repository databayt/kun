"""Build the 90-slot editorial plan for the balqalam queue."""
import json, pathlib

SP = {  # feature -> spotlight path (relative to hogwarts root)
    "dashboard": "src/components/school-dashboard/dashboard/SPOTLIGHT.md",
    "attendance": "src/components/school-dashboard/attendance/SPOTLIGHT.md",
    "internationalization": "src/components/internationalization/SPOTLIGHT.md",
    "onboarding": "src/components/onboarding/SPOTLIGHT.md",
    "students": "src/components/school-dashboard/listings/students/SPOTLIGHT.md",
    "parents": "src/components/school-dashboard/listings/parents/SPOTLIGHT.md",
    "gradebook": "src/components/school-dashboard/listings/grades/SPOTLIGHT.md",
    "import": "src/components/school-dashboard/import/SPOTLIGHT.md",
    "admission": "src/components/school-dashboard/admission/SPOTLIGHT.md",
    "library": "src/components/library/SPOTLIGHT.md",
    "school-marketing": "src/components/school-marketing/SPOTLIGHT.md",
    "credentials": "src/components/school-dashboard/listings/credentials/SPOTLIGHT.md",
    "notifications": "src/components/school-dashboard/notifications/SPOTLIGHT.md",
    "offline": "src/components/offline/SPOTLIGHT.md",
    "reports": "src/components/school-dashboard/reports/SPOTLIGHT.md",
    "finance": "src/components/school-dashboard/finance/SPOTLIGHT.md",
    "my-fees": "src/components/school-dashboard/my-fees/SPOTLIGHT.md",
    "lumos": "src/components/lumos/SPOTLIGHT.md",
    "payment": "src/components/payment/SPOTLIGHT.md",
    "timetable": "src/components/school-dashboard/timetable/SPOTLIGHT.md",
    "teachers": "src/components/school-dashboard/listings/teachers/SPOTLIGHT.md",
    "staff": "src/components/school-dashboard/listings/staff/SPOTLIGHT.md",
    "classrooms": "src/components/school-dashboard/listings/classrooms/SPOTLIGHT.md",
    "exams": "src/components/school-dashboard/exams/SPOTLIGHT.md",
    "grades": "src/components/school-dashboard/grades/SPOTLIGHT.md",
    "documents": "src/components/school-dashboard/documents/SPOTLIGHT.md",
    "school": "src/components/school-dashboard/school/SPOTLIGHT.md",
    "assignments": "src/components/school-dashboard/listings/assignments/SPOTLIGHT.md",
    "announcements": "src/components/school-dashboard/listings/announcements/SPOTLIGHT.md",
    "parent-portal": "src/components/school-dashboard/parent-portal/SPOTLIGHT.md",
    "translation": "src/components/translation/SPOTLIGHT.md",
    "messaging": "src/components/school-dashboard/messaging/SPOTLIGHT.md",
    "communication": "src/components/school-dashboard/communication/SPOTLIGHT.md",
    "whatsapp": "src/components/school-dashboard/whatsapp/SPOTLIGHT.md",
    "events": "src/components/school-dashboard/listings/events/SPOTLIGHT.md",
    "catalog": "src/components/catalog/SPOTLIGHT.md",
    "live": "src/components/school-dashboard/live/SPOTLIGHT.md",
    "subjects": "src/components/school-dashboard/listings/subjects/SPOTLIGHT.md",
    "transportation": "src/components/school-dashboard/transportation/SPOTLIGHT.md",
    "billing": "src/components/school-dashboard/billing/SPOTLIGHT.md",
    "compliance": "src/components/school-dashboard/compliance/SPOTLIGHT.md",
}

SLOT = {
    1: ("pain", "school-operations", "A school-day scene the reader recognises; the pain before the product."),
    2: ("proof", "product-proof", "Show the feature working — what the user sees, step by step, in one idea."),
    3: ("persona", "school-operations", "One persona's view of their own week, told from their side."),
    4: ("learn", "learning-science", "Evidence post: what research found / what it may mean for a school / what Balqalam does. Label the evidence."),
    5: ("trust", "trust", "Trust: ownership, language, reliability, honesty about what the product is."),
    6: ("how-to", "product-proof", "A short how-to: three steps or fewer, one process."),
    7: ("question", "school-operations", "A question to school owners/principals that invites a comment; light product bridge or none."),
}

# (week theme, [7 x (feature, persona, angle seed)])
WEEKS = [
    ("The school outgrew paper", [
        ("dashboard", "owner", "Five signs a school has outgrown paper."),
        ("dashboard", "principal", "The morning screen: each role opens on what it needs first."),
        ("dashboard", "owner", "What an owner wants to see before the first bell."),
        ("attendance", "principal", "Absence as an early signal, not an administrative box."),
        ("internationalization", "owner", "Arabic by default — built in Arabic, not translated into it."),
        ("onboarding", "owner", "From 'yes' to a populated dashboard, not an empty system."),
        ("dashboard", "owner", "How many notebooks does your school run on?"),
    ]),
    ("One record per student", [
        ("students", "registrar", "The student file that travels between offices."),
        ("students", "registrar", "Four doors in, one student record out."),
        ("parents", "registrar", "New term, the same family typed in again."),
        ("gradebook", "teacher", "Feedback works when it arrives in time — what the evidence says."),
        ("import", "owner", "Your data exports whenever you want: the school keeps it."),
        ("import", "registrar", "Your Excel sheet is already your migration plan."),
        ("parents", "principal", "Where does a father's new phone number end up?"),
    ]),
    ("Admission season", [
        ("admission", "registrar", "The queue at the door and the photocopied form."),
        ("admission", "registrar", "From application to enrolled student, one click in the middle."),
        ("admission", "parent", "Applying from the phone and checking status without calling."),
        ("library", "principal", "Reading for pleasure — what the evidence says, and the school library's part."),
        ("school-marketing", "owner", "The admission form used to be a photocopy; now it is a link."),
        ("credentials", "registrar", "Logins sent to the parent's WhatsApp in one click."),
        ("admission", "owner", "How long between a parent's application and your reply?"),
    ]),
    ("Attendance", [
        ("attendance", "principal", "The meeting waits because the register is not complete."),
        ("attendance", "teacher", "The register marked; the families of the absent already know."),
        ("attendance", "teacher", "Marking the class before the first lesson ends."),
        ("notifications", "principal", "School–home communication: what the evidence says about timely messages."),
        ("offline", "principal", "Built for slow connections: the signal drops, the register does not."),
        ("reports", "principal", "An attendance report by class and day without collecting notebooks."),
        ("notifications", "principal", "When does a parent learn their child was absent today?"),
    ]),
    ("Fees and trust", [
        ("finance", "finance", "Month end: the accountant chasing receipts notebook by notebook."),
        ("finance", "finance", "Invoice and receipt generated on screen, not in a spreadsheet."),
        ("my-fees", "parent", "What do I owe, for which child, and when?"),
        ("lumos", "principal", "Metacognition: students who check their own understanding learn more — what the evidence says."),
        ("payment", "finance", "Paid means paid: checked before the screen says so."),
        ("finance", "finance", "Fee reminders that go out on the payment schedule."),
        ("finance", "owner", "A parent says they paid — how fast can your school prove it?"),
    ]),
    ("Timetable and teachers", [
        ("timetable", "principal", "The timetable redrawn again and again before the term."),
        ("timetable", "principal", "Try to book one teacher in two rooms. It says no."),
        ("teachers", "teacher", "A teacher's week at a glance."),
        ("teachers", "principal", "Teacher workload: what large surveys of teachers report, and what a school can remove."),
        ("staff", "owner", "The bus driver and the librarian work here too."),
        ("classrooms", "principal", "Set the number of sections; the rooms appear."),
        ("teachers", "principal", "Who is carrying the heaviest timetable at your school this week?"),
    ]),
    ("Exams and marks", [
        ("gradebook", "teacher", "Marks copied from the notebook to the sheet, then checked again."),
        ("exams", "teacher", "Your letterhead, your layout; the questions are filled in."),
        ("exams", "teacher", "AI drafts the questions; the teacher decides what stays."),
        ("exams", "principal", "Why students forget after the exam — retrieval practice, what the evidence says."),
        ("grades", "registrar", "How to check that a transcript is real."),
        ("gradebook", "teacher", "Exam marked Tuesday, in the gradebook Tuesday."),
        ("grades", "principal", "How many times is one mark typed at your school?"),
    ]),
    ("Documents and ownership", [
        ("import", "owner", "A school stuck with an old system because its records cannot come out."),
        ("documents", "registrar", "Keep your ministry's certificate layout; the system fills it in."),
        ("school", "owner", "Don't run buses? Switch Transport off; the menu follows."),
        ("assignments", "teacher", "Spacing: practice spread over time beats one long session — the evidence."),
        ("students", "it", "Who owns student data when the contract ends? The school."),
        ("documents", "registrar", "Certificates from your own template, ready to print."),
        ("import", "owner", "If you changed systems tomorrow, what would you lose?"),
    ]),
    ("People adopt systems", [
        ("teachers", "principal", "The staff meeting where the new system met folded arms."),
        ("dashboard", "teacher", "The teacher's screen shows only what the teacher needs."),
        ("announcements", "principal", "Write the announcement once; every parent reads it."),
        ("lumos", "teacher", "Worked examples reduce overload for novices — what the evidence says."),
        ("internationalization", "principal", "Your staff should not need English to run their own school."),
        ("assignments", "teacher", "Set it once; every student gets it, plus a reminder."),
        ("teachers", "principal", "What does your staff resist most when a new system arrives?"),
    ]),
    ("The family", [
        ("parent-portal", "parent", "The office phone after dinner: a parent asking what the school already knows."),
        ("parent-portal", "parent", "One place: attendance, marks and fees for each child."),
        ("reports", "parent", "The report card that never made it home."),
        ("parent-portal", "principal", "Parental engagement: which kinds of involvement the evidence supports."),
        ("translation", "parent", "Write it once; each parent reads it in their language."),
        ("messaging", "teacher", "It looks like WhatsApp; it belongs to your school."),
        ("messaging", "principal", "How do parents reach your school today?"),
    ]),
    ("Communication", [
        ("communication", "principal", "One notice copied into six WhatsApp groups."),
        ("whatsapp", "owner", "Stop running the school from the secretary's personal phone."),
        ("events", "principal", "Forty seats, sixty parents: the waiting list runs itself."),
        ("catalog", "principal", "Reading comprehension strategies — what the evidence says, and the textbook inside the system."),
        ("notifications", "parent", "The parent finds out before lunch, not at the end of term."),
        ("library", "teacher", "Borrow a book in one tap; the due date sets itself."),
        ("communication", "principal", "How many WhatsApp groups does your school run?"),
    ]),
    ("Learning beyond the room", [
        ("lumos", "principal", "The absent student misses the lesson entirely."),
        ("lumos", "teacher", "Watch the lesson, then answer; the first try counts."),
        ("catalog", "teacher", "Your textbook, already inside the system."),
        ("lumos", "principal", "Video lessons and blended learning — what the evidence can and cannot say yet."),
        ("live", "principal", "Online classes follow the timetable instead of a new schedule."),
        ("subjects", "teacher", "Open the subject; the textbook is one tap away."),
        ("live", "owner", "What happens to learning when the school closes for a day?"),
    ]),
    ("The whole school, and the offer", [
        ("dashboard", "owner", "A free ministry platform does not run the whole school."),
        ("transportation", "parent", "'Your child has boarded the bus' — the message every parent waits for."),
        ("billing", "owner", "Under a hundred students? Free, permanently."),
        ("internationalization", "principal", "Learning in the language children think in — what the evidence says."),
        ("compliance", "registrar", "Every afternoon: is today's ADEK attendance file ready? (UAE schools)"),
        ("onboarding", "owner", "The pilot: send the lists you already keep; three months free, then an annual contract."),
    ]),
]


def build():
    rows, seq = [], 0
    for w, (theme, slots) in enumerate(WEEKS, start=1):
        for d, (feature, persona, angle) in enumerate(slots, start=1):
            seq += 1
            kind, pillar, how = SLOT[d]
            rows.append({
                "seq": seq, "week": w, "slot": d, "theme": theme, "kind": kind, "pillar": pillar,
                "feature": feature, "spotlight": SP[feature], "persona": persona,
                "angle": angle, "slotGuide": how,
            })
    assert seq == 90, seq
    return rows


if __name__ == "__main__":
    rows = build()
    out = pathlib.Path("/private/tmp/claude-501/-Users-abdout-kun/eb75f9ad-146d-4249-8833-1481e1859e4b/scratchpad/plan.json")
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    root = pathlib.Path("/Users/abdout/hogwarts")
    missing = {r["spotlight"] for r in rows if not (root / r["spotlight"]).exists()}
    print("rows", len(rows), "missing spotlights", missing)
    from collections import Counter
    print(Counter(r["pillar"] for r in rows))
    print(Counter(r["feature"] for r in rows).most_common(8))
