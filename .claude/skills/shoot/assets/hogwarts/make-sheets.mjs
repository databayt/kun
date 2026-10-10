// Writes the sample spreadsheets for the bulk-student / bulk-teacher flows, and a Finder
// thumbnail for each (a JPG of the sheet's first rows, as macOS Quick Look draws a CSV).
// Fictional people: patterned phones (+249 900 000 0xx), example.com mail, DEMO- ids, so a
// leftover row is obvious and never reaches anyone. Arabic headers: auto-matching is the point.
//   node make-sheets.mjs   → writes next to this file
import { writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { requireRt } from "../../../edit/scripts/media/rt.mjs"

const here = dirname(fileURLToPath(import.meta.url))
// Playwright from the media runtime, the one shoot.mjs uses (hogwarts' may lack its browser).
const { chromium } = requireRt("playwright-core")
const font = (w) => `file://${homedir()}/hogwarts/public/fonts/thmanyah/thmanyah-${w}.woff2`
const phone = (n) => `+2499000000${String(n).padStart(2, "0")}`

// Section «الصف الأول - أ» exists on the demo and has a timetable (the add-student happy path).
export const STUDENTS = {
  file: "طلاب-الصف-الأول.csv",
  header: ["الاسم", "رقم الطالب", "الصف", "الشعبة", "الجنس", "تاريخ الميلاد", "اسم الأب", "هاتف الأب"],
  rows: [
    ["يوسف عثمان", "DEMO-101", "الصف الأول", "أ", "ذكر", "2019-02-11", "عثمان بابكر", phone(21)],
    ["ريم الصادق", "DEMO-102", "الصف الأول", "أ", "أنثى", "2019-05-03", "الصادق حمد", phone(22)],
    ["محمد الأمين", "DEMO-103", "الصف الأول", "أ", "ذكر", "2019-01-27", "الأمين يس", phone(23)],
    ["ملاذ حسن", "DEMO-104", "الصف الأول", "أ", "أنثى", "2019-08-15", "حسن الطاهر", phone(24)],
    ["عبدالله النور", "DEMO-105", "الصف الأول", "أ", "ذكر", "2019-04-09", "النور إدريس", phone(25)],
    ["هبة عوض", "DEMO-106", "الصف الأول", "أ", "أنثى", "2019-10-30", "عوض الكريم", phone(26)],
  ],
}

// Subjects the demo school teaches; no department column (createMissing would add one).
export const TEACHERS = {
  file: "معلمون-جدد.csv",
  header: ["الاسم", "الرقم الوظيفي", "البريد الإلكتروني", "الهاتف", "الجنس", "المواد", "المؤهل"],
  rows: [
    ["سلمى الفاضل", "DEMO-T01", "salma.demo@example.com", phone(31), "أنثى", "اللغة العربية", "بكالوريوس"],
    ["أنس المبارك", "DEMO-T02", "anas.demo@example.com", phone(32), "ذكر", "الرياضيات", "ماجستير"],
    ["نون عبدالقادر", "DEMO-T03", "noon.demo@example.com", phone(33), "أنثى", "العلوم", "بكالوريوس"],
    ["طارق السر", "DEMO-T04", "tarig.demo@example.com", phone(34), "ذكر", "اللغة الإنجليزية", "بكالوريوس"],
  ],
}

const csv = ({ header, rows }) =>
  "﻿" + [header, ...rows].map((r) => r.map((c) => (/[,"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n"

// Quick Look of a CSV: a plain grid, header row bold, Arabic right-to-left.
const sheet = ({ header, rows }) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:S;src:url(${font("sans-500")});font-weight:500}@font-face{font-family:S;src:url(${font("sans-700")});font-weight:700}
*{margin:0;box-sizing:border-box}body{width:900px;height:1200px;background:#fff;font-family:S;direction:rtl;overflow:hidden}
table{border-collapse:collapse;font-size:18px;width:max-content}td{border:1px solid #d6d9de;padding:12px 10px;white-space:nowrap;color:#1d2433}
tr:first-child td{font-weight:700;background:#f1f3f6}tr:nth-child(odd):not(:first-child) td{background:#fafbfc}</style></head>
<body><table>${[header, ...rows, ...Array(14).fill(header.map(() => ""))].map((r) => `<tr>${r.map((c) => `<td${/^[+A-Za-z0-9]/.test(c) ? ' dir="ltr"' : ""}>${c || "&nbsp;"}</td>`).join("")}</tr>`).join("")}</table></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
for (const s of [STUDENTS, TEACHERS]) {
  writeFileSync(join(here, s.file), csv(s))
  await page.setContent(sheet(s), { waitUntil: "networkidle" })
  await page.screenshot({ path: join(here, s.file.replace(/\.csv$/, ".thumb.jpg")), type: "jpeg", quality: 88 })
  console.log(`✓ ${s.file} (+ thumb)`)
}
await browser.close()
