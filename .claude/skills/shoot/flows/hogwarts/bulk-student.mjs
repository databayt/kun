// Bulk student — six fictional first-graders («الصف الأول - أ») from one CSV, through /school/bulk.
import { bulkFlow, initScript } from "./_bulk.mjs"

export const title = ["إدخال الطلاب جماعيًا", "Bulk-import students"]
export const alt = {
  bulk: ["صفحة الإدخال الجماعي", "The bulk import page"],
  finder: ["اختيار ملف الطلاب من نافذة الملفات", "Picking the students file in Finder"],
  map: ["مطابقة أعمدة ملف الطلاب تلقائيًا", "Students file columns matched automatically"],
  review: ["مراجعة ستة طلاب جدد قبل الحفظ", "Reviewing six new students before saving"],
  done: ["اكتمل استيراد الطلاب مع بيانات الدخول", "Students imported, with their logins"],
  history: ["سجل الاستيراد مع التنزيل والتراجع", "Import history with logins and undo"],
}

const { cleanup, flow } = bulkFlow({ desc: ["مع الصف والشعبة والوالدين", "With grade, section and both parents"], file: "طلاب-الصف-الأول.csv", rows: 6 })
export { cleanup, initScript }
export default flow
