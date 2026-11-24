// Ask the Mkan agent — stills of the in-app chatbot on mkan.sd: the robot panel on /listings,
// a plain-language request, the answer with home cards + refine chips, and the full-screen chat's
// «أكمل على واتساب». Sends one anonymous message; never presses a card or the WhatsApp link.
// The film is sims/mkan/ask-agent.mjs + a real WhatsApp recording (record.sh), joined in the edit.

export const route = "find"
export const block = "agent"
export const paths = ["src/components/agent"]
export const title = ["وكيل مكان", "The Mkan agent"]
export const alt = {
  panel: ["لوحة وكيل مكان مفتوحة بجانب الإعلانات", "The Mkan agent panel open beside the listings"],
  answer: ["رد الوكيل مع بطاقات المنازل وأزرار تحسين البحث", "The agent's answer with home cards and refine chips"],
  whatsapp: ["قائمة المحادثة وفيها «أكمل على واتساب»", "The chat menu with “Continue on WhatsApp”"],
}

export default async ({ page, go, shot, t }) => {
  await go("/ar/listings")
  await page.getByRole("button", { name: t("اسأل وكيل الإيجار", "Ask the rental agent") }).click()
  await page.getByPlaceholder(t("اسأل أي شيء", "Ask anything")).first().waitFor()
  await shot("panel")

  const input = page.getByPlaceholder(t("اسأل أي شيء", "Ask anything")).first()
  await input.fill(t("شقة مفروشة بغرفتين في كيتشوكيرو، حتى ٤٠٠ ألف شهرياً", "furnished 2-bedroom in Kicukiro, up to 400k a month"))
  await input.press("Enter")
  await page.getByText(t("الأنسب لك", "Best match")).first().waitFor({ timeout: 60000 })
  await shot("answer")

  await page.locator(`[aria-label="${t("فتح في صفحة كاملة", "Open full screen")}"]`).first().click()
  await page.waitForURL(/\/find\?c=/, { timeout: 30000 })
  await page.getByRole("button", { name: t("المزيد", "More") }).first().click()
  await page.getByText(t("أكمل على واتساب", "Continue on WhatsApp")).first().waitFor()
  await shot("whatsapp")
}
