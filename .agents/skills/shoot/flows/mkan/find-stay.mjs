// Find a stay — a guest's path on mkan.sd: search Port Sudan → results on the map → a home →
// its photos → the price card. Read-only: it stops before contacting the host, so a shoot never
// writes anything to production. Labels from mkan's ar/en dictionaries via t().

const card = (page) => page.locator("div.group.cursor-pointer h3").first()

export default async ({ page, go, shot, t }) => {
  await go("/ar")
  await shot("home")

  await page.getByRole("button", { name: t("أي مكان", "Anywhere") }).click()
  await page.getByRole("option", { name: t(/بورتسودان/, /Port Sudan/) }).click()
  await shot("where")

  await page.getByRole("button", { name: t("بحث", "Search"), exact: true }).click()
  await page.waitForURL(/\/search/, { timeout: 60000 })
  // search results can take most of a minute on a cold container
  await card(page).waitFor({ timeout: 90000 })
  await shot("results")

  await card(page).click()
  await page.waitForURL(/\/listings\//, { timeout: 60000 })
  await shot("listing")

  // the photo tour is its own page; shot() waits out its spinner
  await page.getByRole("button", { name: t("عرض جميع صور العقار", "View all property photos") }).first().click()
  await page.locator("img").nth(2).waitFor({ timeout: 30000 }).catch(() => {})
  await shot("photos")
  await page.goBack()
  await page.waitForURL(/\/listings\/[^/]+$/, { timeout: 30000 }).catch(() => {})

  // the price card renders as you scroll, and its call to action is a tel: link, not a button
  await page.mouse.wheel(0, 900)
  await page.getByText(t("اتصل بالمضيف", "Call host")).first().scrollIntoViewIfNeeded()
  await shot("price")
}
