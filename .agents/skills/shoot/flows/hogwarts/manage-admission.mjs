// Manage admission — the admissions office end to end: the campaigns, the applications
// inbox, one application opened, the merit list, enrolment, the enquiry leads and the settings.
import { initScript as blurPhones } from "./add-student.mjs"

export const initScript = blurPhones

// the app route it films → cdn.databayt.org/hogwarts/<lang>/admission/campaigns.avif
export const route = "admission"
export const block = "admission"
export const paths = ["src/components/school-dashboard/admission"]
export const title = ["إدارة القبول", "Managing admission"]
export const alt = {
  campaigns: ["حملات القبول ومقاعدها وطلباتها", "Admission campaigns with their seats and applications"],
  applications: ["طلبات الالتحاق الواردة", "Incoming applications"],
  application: ["تفاصيل طلب التحاق", "One application in detail"],
  merit: ["قائمة الترتيب حسب الجدارة", "The merit list"],
  enrollment: ["تسجيل المقبولين", "Enrolling accepted applicants"],
  leads: ["الاستفسارات والعملاء المحتملون", "Enquiries and leads"],
  settings: ["إعدادات القبول", "Admission settings"],
}

export default async ({ page, go, shot }) => {
  await go("/ar/admission")
  await shot("campaigns")
  await go("/ar/admission/applications")
  await shot("applications")
  // open the first application from its row menu (rows aren't links)
  await page.locator("tbody tr").first().getByRole("button").last().click()
  await page.getByRole("menuitem", { name: /عرض|View/ }).first().click()
  await page.waitForURL(/\/admission\/applications\/[^/]+$/)
  await shot("application")
  await go("/ar/admission/merit")
  await shot("merit")
  await go("/ar/admission/enrollment")
  await shot("enrollment")
  await go("/ar/admission/leads")
  await shot("leads")
  await go("/ar/admission/settings")
  await shot("settings")
}
