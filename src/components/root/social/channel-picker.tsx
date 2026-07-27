"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import { productChannelWired } from "@/components/root/social/products";
import { fill, type SocialDict } from "@/components/root/social/dictionary";

interface ChannelPickerProps {
  product: string;
  selected: ChannelId[];
  wiredForProduct: ChannelId[];
  onChange: (next: ChannelId[]) => void;
  isRTL: boolean;
  t: SocialDict;
}

/**
 * Multi-select over the brand's wired channels.
 *
 * A plain <Select> can only hold one value, which quietly removed the ability
 * to publish to two channels but not a third — the whole point of the fan-out.
 * Checkbox items keep the compact toolbar shape and give the selection back.
 */
export function ChannelPicker({
  product,
  selected,
  wiredForProduct,
  onChange,
  isRTL,
  t,
}: ChannelPickerProps) {
  const allSelected =
    wiredForProduct.length > 0 &&
    wiredForProduct.every((id) => selected.includes(id));

  const label = () => {
    if (wiredForProduct.length === 0) return t.selectChannel;
    if (allSelected) return t.all;
    if (selected.length === 0) return t.selectChannel;
    if (selected.length === 1) {
      const channel = CHANNELS.find((c) => c.id === selected[0]);
      return channel
        ? isRTL
          ? channel.labelAr
          : channel.label
        : t.selectChannel;
    }
    return fill(t.channelCount, { count: selected.length });
  };

  const toggle = (id: ChannelId) => {
    onChange(
      selected.includes(id)
        ? selected.filter((c) => c !== id)
        : [...selected, id],
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id="channel-selector"
        aria-label={t.channel}
        disabled={wiredForProduct.length === 0}
        className="focus-visible:ring-ring/50 flex h-8 w-auto items-center justify-start gap-2 rounded-md border-0 bg-transparent px-3 text-sm shadow-none outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>{label()}</span>
        <ChevronDown className="size-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRTL ? "end" : "start"} className="min-w-44">
        <DropdownMenuItem
          onSelect={(event) => {
            // Keep the menu open — selecting channels is a multi-step action.
            event.preventDefault();
            onChange(allSelected ? [] : [...wiredForProduct]);
          }}
          disabled={wiredForProduct.length === 0}
          className="justify-between"
        >
          <span>{t.all}</span>
          {allSelected && <Check className="size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {CHANNELS.map((ch) => {
          const available = productChannelWired(product, ch.id, ch.wired);
          const name = isRTL ? ch.labelAr : ch.label;
          return (
            <DropdownMenuCheckboxItem
              key={ch.id}
              checked={selected.includes(ch.id)}
              disabled={!available}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => available && toggle(ch.id)}
            >
              {name}
              {!available && (
                <span className="text-muted-foreground ms-1 text-xs">
                  ({t.comingSoon})
                </span>
              )}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
