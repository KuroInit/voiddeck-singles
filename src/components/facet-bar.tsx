"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Listing } from "@/data/listings";
import { LISTING_TYPES, conditionLabel, languageLabel, printingLabel, typeLabel } from "@/lib/rarity";
import { cn } from "@/lib/utils";

export type FacetSort = "price_asc" | "price_desc";

export type Facets = {
  sort: FacetSort;
  set: string | null;
  rarity: string | null;
  printing: string | null;
  type: string | null;
  condition: string | null;
  language: string | null; // "en" | "zh" | "unstated"
};

export const DEFAULT_FACETS: Facets = {
  sort: "price_asc",
  set: null,
  rarity: null,
  printing: null,
  type: null,
  condition: null,
  language: null,
};

/** Deterministic client-side filter + sort. Price ascending is the default. */
export function applyFacets(listings: Listing[], facets: Facets): Listing[] {
  const out = listings.filter((l) => {
    if (facets.set && l.set !== facets.set) return false;
    if (facets.rarity && l.rarity !== facets.rarity) return false;
    if (facets.printing && l.printing !== facets.printing) return false;
    if (facets.type && l.type !== facets.type) return false;
    if (facets.condition && l.condition !== facets.condition) return false;
    if (facets.language) {
      const lang = l.language ?? "unstated";
      if (lang !== facets.language) return false;
    }
    return true;
  });
  out.sort((a, b) =>
    facets.sort === "price_desc" ? b.priceSgd - a.priceSgd : a.priceSgd - b.priceSgd
  );
  return out;
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "shrink-0 cursor-pointer border select-none",
        active
          ? "border-transparent bg-amber-400 text-zinc-950 hover:bg-amber-300"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      )}
    >
      {label}
    </Badge>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

export function FacetBar({
  listings,
  onChange,
}: {
  listings: Listing[];
  onChange: (next: Listing[]) => void;
}) {
  const [facets, setFacets] = useState<Facets>(DEFAULT_FACETS);

  useEffect(() => {
    onChange(applyFacets(listings, facets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, facets]);

  const toggle = (key: keyof Facets, value: string) => {
    setFacets((f) => ({ ...f, [key]: f[key as "set"] === value ? null : value }));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={facets.sort}
          onValueChange={(v) => setFacets((f) => ({ ...f, sort: v as FacetSort }))}
        >
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_asc">Price ↑</SelectItem>
            <SelectItem value="price_desc">Price ↓</SelectItem>
          </SelectContent>
        </Select>
        {JSON.stringify(facets) !== JSON.stringify(DEFAULT_FACETS) ? (
          <button
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            onClick={() => setFacets(DEFAULT_FACETS)}
          >
            Reset filters
          </button>
        ) : null}
      </div>
      <ChipRow>
        <Chip label="OGN" active={facets.set === "OGN"} onClick={() => toggle("set", "OGN")} />
      </ChipRow>
      <ChipRow>
        {(["common", "uncommon", "rare", "epic", "showcase"] as const).map((r) => (
          <Chip
            key={r}
            label={r[0].toUpperCase() + r.slice(1)}
            active={facets.rarity === r}
            onClick={() => toggle("rarity", r)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {(["standard", "alt_art", "signature"] as const).map((p) => (
          <Chip
            key={p}
            label={printingLabel(p)}
            active={facets.printing === p}
            onClick={() => toggle("printing", p)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {LISTING_TYPES.map((t) => (
          <Chip
            key={t}
            label={typeLabel(t)}
            active={facets.type === t}
            onClick={() => toggle("type", t)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {(["nm", "lp", "mp", "psa9"] as const).map((c) => (
          <Chip
            key={c}
            label={conditionLabel(c)}
            active={facets.condition === c}
            onClick={() => toggle("condition", c)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip
          label={languageLabel("en")}
          active={facets.language === "en"}
          onClick={() => toggle("language", "en")}
        />
        <Chip
          label={languageLabel("zh")}
          active={facets.language === "zh"}
          onClick={() => toggle("language", "zh")}
        />
        <Chip
          label="Not stated"
          active={facets.language === "unstated"}
          onClick={() => toggle("language", "unstated")}
        />
      </ChipRow>
    </div>
  );
}
