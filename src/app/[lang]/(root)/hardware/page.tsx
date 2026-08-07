import HardwareContent from "@/components/root/hardware/content";
import { type Locale } from "@/components/local/config";

export const metadata = {
  title: "Hardware",
};

interface HardwarePageProps {
  params: Promise<{ lang: string }>;
}

export default async function HardwarePage({ params }: HardwarePageProps) {
  const { lang } = await params;
  const locale = lang as Locale;

  return <HardwareContent lang={locale} />;
}
