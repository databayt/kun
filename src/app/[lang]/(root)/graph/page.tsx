import type { Metadata } from "next";
import GraphContent from "@/components/root/graph/content";
import { type Locale } from "@/components/local/config";

export async function generateMetadata({
  params,
}: GraphPageProps): Promise<Metadata> {
  const { lang } = await params;
  const isAr = lang === "ar";

  return {
    title: isAr ? "الدماغ الثاني" : "Second Brain",
    description: isAr
      ? "خريطة معرفية حية لمحرك كن — المدارس والتعويذات والوكلاء والمنافذ وعلاقاتها، مشتقة من سجل المفردات."
      : "A live knowledge graph of the kun engine — schools, spells, agents, MCP portals and their typed relations, derived from the vocabulary registry.",
  };
}

interface GraphPageProps {
  params: Promise<{ lang: string }>;
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { lang } = await params;
  const locale = lang as Locale;

  return <GraphContent lang={locale} />;
}
