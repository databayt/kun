// Bulk teacher, filmed — four fictional teachers with department and subjects from one CSV, through /school/bulk.
import { bulkSim } from "./_bulk.mjs"

const { meta, cleanup, prepare, take } = bulkSim({
  desc: ["مع القسم والمواد", "With department and subjects"],
  file: "معلمون-جدد.csv",
  rows: 4,
  noun: "«المعلمين»",
  meta: {
    title: "إدخال <mark>المعلمين جماعياً</mark>",
    sub: "دليل خطوة بخطوة لإدارة المدرسة في منصة بالقلم",
    outro: "المعلمون الجدد <mark>بملف واحد</mark>",
    outroSub: "بأقسامهم وموادهم — وحسابات الدخول جاهزة",
  },
})
export { meta, cleanup, prepare }
export default take
