import Card from "@/components/atom/card";
import Image from "next/image";
import type { HomeItem } from "./config";
import { GuardianIcon, AppsIcon } from "@/components/atom/icons";
import type { Locale } from "@/components/local/config";

// Inline SVG fallback for cards without a downloaded raster (keyed by config `icon`).
const svgIconMap = {
  GuardianIcon,
  AppsIcon,
};

interface HomeCardsProps {
  items: HomeItem[];
  lang?: Locale;
}

export default function HomeCards({ items, lang = "en" }: HomeCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 py-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        let icon = null;
        if (item.image) {
          icon = (
            <Image
              src={`/icons/home/${item.image}`}
              alt={item.title}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 object-contain dark:invert"
            />
          );
        } else {
          const IconComponent =
            svgIconMap[item.icon as keyof typeof svgIconMap];
          icon = IconComponent ? (
            <IconComponent className="fill-current" />
          ) : null;
        }
        return (
          <Card
            key={item.id}
            id={item.id}
            title={item.title}
            description={item.description}
            icon={icon}
            href={`/${lang}${item.href}`}
          />
        );
      })}
    </div>
  );
}
