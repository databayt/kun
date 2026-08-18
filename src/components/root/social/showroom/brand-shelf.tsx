"use client";

// Apple TV-style brand shelves — one swipeable row per reference brand,
// patterned on mkan's ListingCarouselSection (title-with-chevron header, embla
// dragFree, logical ps-/basis spacing) with the tv-app hover lift on each
// poster. Cards are the existing ShowroomCard, so every artwork keeps its
// detail dialog; the grid below stays the full filterable registry.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useSocial } from "@/components/root/social/provider";
import { ShowroomCard } from "./asset-card";
import type { ShowroomAsset } from "./data";

interface ShelfConfig {
  key: string;
  /** Reference-card id prefix that claims an asset for this shelf. */
  prefix: string;
  title: string;
  titleAr: string;
  sourceUrl: string;
}

// The two style north stars. A new shelf is one config row — assets join it
// by id prefix in references.json, nothing else to wire.
const SHELVES: ShelfConfig[] = [
  {
    key: "thmanyah",
    prefix: "thmanyah-",
    title: "Thmanyah — ثمانية",
    titleAr: "ثمانية — Thmanyah",
    sourceUrl: "https://web.facebook.com/Thmanyah",
  },
  {
    key: "aljazeera",
    prefix: "aljazeera-tech",
    title: "Al Jazeera Technology",
    titleAr: "الجزيرة تكنولوجيا",
    sourceUrl: "https://web.facebook.com/AljazeeraTechnology",
  },
  {
    key: "airbnb",
    prefix: "airbnb-",
    title: "Airbnb Campaign References — Mkan Inspiration",
    titleAr: "إعلانات إيربي إن بي المرجعية — إلهام مكان",
    sourceUrl: "https://www.airbnb.com",
  },
];

export function BrandShelves({ assets }: { assets: ShowroomAsset[] }) {
  const { isRTL } = useSocial();

  return (
    <div className="space-y-10">
      {SHELVES.map((shelf) => {
        // Shelf assets by prefix
        const shelfAssets = assets.filter(
          (a) =>
            a.kind === "reference" &&
            a.id.startsWith(shelf.prefix),
        );
        if (shelfAssets.length === 0) return null;

        return (
          <section key={shelf.key} className="space-y-4">
            <Link
              href={shelf.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground flex items-center gap-1 text-xl font-bold transition-colors"
            >
              {isRTL ? shelf.titleAr : shelf.title}
              <ArrowUpRight className="mt-1 size-4 rtl:-rotate-90" />
            </Link>

            <Carousel
              opts={{
                align: "start",
                dragFree: true,
                direction: isRTL ? "rtl" : "ltr",
              }}
              className="w-full"
            >
              <CarouselContent>
                {shelfAssets.map((asset, i) => (
                  <CarouselItem
                    key={asset.id}
                    className="basis-[70%] transition-transform duration-200 ease-out hover:z-10 hover:scale-[1.02] sm:basis-[45%] md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
                  >
                    <ShowroomCard asset={asset} index={i} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="bg-background/80 hidden backdrop-blur-sm md:inline-flex" />
              <CarouselNext className="bg-background/80 hidden backdrop-blur-sm md:inline-flex" />
            </Carousel>
          </section>
        );
      })}
    </div>
  );
}
