import CatalogContent from "@/components/machine/catalog/content"
import { type Locale } from "@/components/local/config"

export const metadata = {
  title: "Catalog",
}

interface CatalogPageProps {
  params: Promise<{ lang: string }>
}

export default async function CatalogPage({ params }: CatalogPageProps) {
  const { lang } = await params
  return <CatalogContent lang={lang as Locale} />
}
