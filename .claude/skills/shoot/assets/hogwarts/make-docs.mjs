// Renders the sample student's documents as A4 "scans" (JPG) for the add-student sim.
// Every document carries a «نموذج للعرض» watermark — demo material, never a real record.
//   node make-docs.mjs   → writes next to this file
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(homedir(), "hogwarts/package.json"))
const { chromium } = require("@playwright/test")
const font = (w) => `file://${homedir()}/hogwarts/public/fonts/thmanyah/thmanyah-${w}.woff2`
const photo = "data:image/jpeg;base64," + readFileSync(join(here, "photo.jpg")).toString("base64")

const S = {
  name: "أحمد عمر الطيب", dob: "١٤ / ٠٣ / ٢٠١٩", place: "الخرطوم", father: "عمر الطيب محمد",
  mother: "فاطمة أحمد علي", kg: "روضة النيل", year: "٢٠٢٤ – ٢٠٢٥",
}

const base = `
@font-face{font-family:S;src:url(${font("sans-500")});font-weight:500}@font-face{font-family:S;src:url(${font("sans-700")});font-weight:700}
@font-face{font-family:D;src:url(${font("serif-display-700")});font-weight:700}
*{margin:0;box-sizing:border-box}body{width:1240px;height:1754px;background:#f7f5ef;font-family:S;color:#1d2433;direction:rtl;position:relative;overflow:hidden}
.pg{position:absolute;inset:70px;border:3px double #9aa4b5;padding:70px 80px;display:flex;flex-direction:column;gap:34px}
.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #c9ced8;padding-bottom:26px}
.hd .org{font-size:30px;font-weight:700;line-height:1.5}.hd .org small{display:block;font-size:22px;font-weight:500;color:#5b6577}
.seal{width:130px;height:130px;border-radius:50%;border:4px solid #2f6f5e;color:#2f6f5e;display:grid;place-items:center;text-align:center;font-size:20px;font-weight:700;line-height:1.3}
h1{font-family:D;font-size:64px;text-align:center;margin-top:10px}
.row{display:flex;gap:18px;font-size:30px;line-height:1.6}.row b{min-width:260px;color:#5b6577;font-weight:500}
table{width:100%;border-collapse:collapse;font-size:27px}td,th{border:1.5px solid #b9c0cc;padding:14px 18px;text-align:right}th{background:#e8ecf2}
.sig{margin-top:auto;display:flex;justify-content:space-between;font-size:24px;color:#5b6577}
.sig div{border-top:2px solid #9aa4b5;padding-top:12px;width:300px;text-align:center}
.wm{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.wm span{transform:rotate(-30deg);font-size:150px;font-weight:700;color:rgba(200,40,40,.10);white-space:nowrap}
.ph{width:200px;height:240px;object-fit:cover;border:2px solid #b9c0cc}`

const doc = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${base}</style></head><body>
<div class="pg">${body}</div><div class="wm"><span>نموذج للعرض</span></div></body></html>`

const DOCS = {
  "degree.jpg": doc(`
    <div class="hd"><div class="org">${S.kg}<small>الخرطوم — السودان</small></div><div class="seal">${S.kg}<br>٢٠٢٥</div></div>
    <h1>شهادة إتمام مرحلة الروضة</h1>
    <p style="font-size:32px;line-height:1.9;text-align:center">تشهد إدارة ${S.kg} بأن الطفل<br><b style="font-size:44px">${S.name}</b><br>
    قد أتمّ مرحلة الروضة للعام الدراسي ${S.year} بنجاح وتفوّق، وهو مؤهّل للالتحاق بالصف الأول الابتدائي.</p>
    <div class="row"><b>تاريخ الميلاد</b>${S.dob}</div><div class="row"><b>التقدير العام</b>ممتاز</div>
    <div class="sig"><div>المعلّمة</div><div>مديرة الروضة</div></div>`),
  "transcript.jpg": doc(`
    <div class="hd"><div class="org">${S.kg}<small>تقرير الأداء الختامي — ${S.year}</small></div><div class="seal">تقرير<br>الأداء</div></div>
    <h1>تقرير أداء الطفل</h1>
    <div class="row"><b>اسم الطفل</b>${S.name}</div><div class="row"><b>المستوى</b>الروضة — المستوى الثاني</div>
    <table><tr><th>المجال</th><th>التقييم</th><th>ملاحظات</th></tr>
      <tr><td>اللغة العربية (الحروف والقراءة)</td><td>ممتاز</td><td>يقرأ الكلمات القصيرة</td></tr>
      <tr><td>الرياضيات (الأعداد ١–٢٠)</td><td>ممتاز</td><td>يجمع ويطرح بسهولة</td></tr>
      <tr><td>اللغة الإنجليزية</td><td>جيد جداً</td><td>يعرف الحروف والألوان</td></tr>
      <tr><td>المهارات الحركية</td><td>ممتاز</td><td>نشيط ومتعاون</td></tr>
      <tr><td>السلوك والمشاركة</td><td>ممتاز</td><td>محبوب من زملائه</td></tr></table>
    <div class="row"><b>نسبة الحضور</b>٩٦٪</div>
    <div class="sig"><div>المعلّمة</div><div>مديرة الروضة</div></div>`),
  "id.jpg": doc(`
    <div class="hd"><div class="org">شهادة ميلاد<small>بيانات قيد المولود</small></div><div class="seal">قيد<br>المواليد</div></div>
    <h1>شهادة ميلاد</h1>
    <div class="row"><b>اسم المولود</b>${S.name}</div><div class="row"><b>الجنس</b>ذكر</div>
    <div class="row"><b>تاريخ الميلاد</b>${S.dob}</div><div class="row"><b>مكان الميلاد</b>${S.place}</div>
    <div class="row"><b>اسم الأب</b>${S.father}</div><div class="row"><b>اسم الأم</b>${S.mother}</div>
    <div class="row"><b>الجنسية</b>سوداني</div>
    <div class="sig"><div>المسجِّل</div><div>الختم</div></div>`),
  "resume.jpg": doc(`
    <div class="hd"><div class="org">ملف الطالب<small>بيانات تعريفية من ولي الأمر</small></div><img class="ph" src="${photo}"></div>
    <div class="row"><b>الاسم</b>${S.name}</div><div class="row"><b>العمر</b>٧ سنوات</div>
    <div class="row"><b>ولي الأمر</b>${S.father} (الأب)</div><div class="row"><b>العنوان</b>${S.place}</div>
    <div class="row"><b>الهوايات</b>الرسم، كرة القدم، القصص المصوّرة</div>
    <div class="row"><b>اللغات</b>العربية، مبادئ الإنجليزية</div>
    <div class="row"><b>ملاحظات صحية</b>لا توجد حساسية معروفة</div>
    <div class="row"><b>الروضة السابقة</b>${S.kg}</div>
    <div class="sig"><div>توقيع ولي الأمر</div><div>التاريخ</div></div>`),
  "other.jpg": doc(`
    <div class="hd"><div class="org">بطاقة التطعيمات<small>سجل تطعيمات الطفل</small></div><div class="seal">صحة<br>الطفل</div></div>
    <h1>بطاقة التطعيم</h1>
    <div class="row"><b>اسم الطفل</b>${S.name}</div><div class="row"><b>تاريخ الميلاد</b>${S.dob}</div>
    <table><tr><th>التطعيم</th><th>التاريخ</th><th>الحالة</th></tr>
      <tr><td>الدرن (BCG)</td><td>٢٠١٩</td><td>✓ مكتمل</td></tr><tr><td>شلل الأطفال</td><td>٢٠١٩–٢٠٢٠</td><td>✓ مكتمل</td></tr>
      <tr><td>الخماسي</td><td>٢٠١٩–٢٠٢٠</td><td>✓ مكتمل</td></tr><tr><td>الحصبة</td><td>٢٠٢٠</td><td>✓ مكتمل</td></tr>
      <tr><td>الجرعة المنشّطة</td><td>٢٠٢٣</td><td>✓ مكتمل</td></tr></table>
    <div class="sig"><div>الطبيب</div><div>المركز الصحي</div></div>`),
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1240, height: 1754 } })
for (const [file, html] of Object.entries(DOCS)) {
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150)
  await p.screenshot({ path: join(here, file), type: "jpeg", quality: 86 })
  console.log("✓", file)
}
await b.close()
