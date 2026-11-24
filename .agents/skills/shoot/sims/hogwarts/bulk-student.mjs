// Bulk student, filmed — six fictional first-graders («الصف الأول - أ») from one CSV, through /school/bulk.
import { bulkSim } from "./_bulk.mjs"

const { meta, cleanup, prepare, take } = bulkSim({
  desc: ["مع الصف والشعبة والوالدين", "With grade, section and both parents"],
  file: "طلاب-الصف-الأول.csv",
  rows: 6,
  noun: "«الطلاب»",
  meta: {
    title: "إدخال <mark>الطلاب جماعياً</mark>",
    sub: "دليل خطوة بخطوة لإدارة المدرسة في منصة بالقلم",
    outro: "صفّ كامل <mark>بملف واحد</mark>",
    outroSub: "الطلاب بصفوفهم وأولياء أمورهم — وحسابات الدخول جاهزة",
  },
})
export { meta, cleanup, prepare }
export default take
