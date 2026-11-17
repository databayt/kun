import CatalogDetail from "@/components/machine/catalog/detail"
import { type Locale } from "@/components/local/config"

export const metadata = {
  title: "Catalog item",
}

interface CatalogItemPageProps {
  params: Promise<{ lang: string; type: string; name: string }>
}

export default async function CatalogItemPage({ params }: CatalogItemPageProps) {
  const { lang, type, name } = await params
  return <CatalogDetail lang={lang as Locale} type={type} name={name} />
}
