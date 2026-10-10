// Bulk teacher — four fictional teachers with their subjects from one CSV, through /school/bulk.
import { bulkFlow, initScript } from "./_bulk.mjs"

// the app route this flow films — its CDN folder mirrors it: cdn.databayt.org/hogwarts/school/bulk/…
export const route = "school/bulk"
// the source this flow films — `record.sh stale` flags the published stills when it changes
export const block = "import"
export const paths = ["src/components/school-dashboard/import"]
export const title = ["إدخال المعلمين جماعيًا", "Bulk-import teachers"]
export const alt = {
  bulk: ["صفحة الإدخال الجماعي", "The bulk import page"],
  finder: ["اختيار ملف المعلمين من نافذة الملفات", "Picking the teachers file in Finder"],
  map: ["مطابقة أعمدة ملف المعلمين تلقائيًا", "Teachers file columns matched automatically"],
  review: ["مراجعة أربعة معلمين جدد قبل الحفظ", "Reviewing four new teachers before saving"],
  done: ["اكتمل استيراد المعلمين مع بيانات الدخول", "Teachers imported, with their logins"],
  history: ["سجل الاستيراد مع التنزيل والتراجع", "Import history with logins and undo"],
}

const { cleanup, flow } = bulkFlow({ desc: ["مع القسم والمواد", "With department and subjects"], file: "معلمون-جدد.csv", rows: 4 })
export { cleanup, initScript }
export default flow
