"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Listing } from "@/data/listings";
import {
  LISTING_TYPES,
  conditionLabel,
  languageLabel,
  printingLabel,
  typeLabel,
} from "@/lib/rarity";
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

function activeCount(facets: Facets): number {
  return (["set", "rarity", "printing", "type", "condition", "language"] as const)
    .map((k) => facets[k])
    .filter(Boolean).length;
}

function activeChips(facets: Facets): { key: keyof Facets; value: string; label: string }[] {
  const chips: { key: keyof Facets; value: string; label: string }[] = [];
  if (facets.rarity) chips.push({ key: "rarity", value: facets.rarity, label: facets.rarity[0].toUpperCase() + facets.rarity.slice(1) });
  if (facets.printing) chips.push({ key: "printing", value: facets.printing, label: printingLabel(facets.printing) });
  if (facets.type) chips.push({ key: "type", value: facets.type, label: typeLabel(facets.type) });
  if (facets.condition) chips.push({ key: "condition", value: facets.condition, label: conditionLabel(facets.condition) });
  if (facets.language) chips.push({ key: "language", value: facets.language, label: facets.language === "unstated" ? "Not stated" : languageLabel(facets.language) });
  return chips;
}

function Chip({
  label,
  active,
  onClick,
  size = "md",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  size?: "md" | "sm";
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "shrink-0 cursor-pointer border select-none",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-[13px]",
        active
          ? "border-transparent bg-amber-400 text-zinc-950 hover:bg-amber-300"
          : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
      )}
    >
      {label}
    </Badge>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterGroups({
  facets,
  toggle,
  reset,
}: {
  facets: Facets;
  toggle: (key: keyof Facets, value: string) => void;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-1 pb-2">
      <FilterGroup label="Set">
        {(["OGN", "OGS", "SFD", "UNL", "VEN"] as const).map((s) => (
          <Chip key={s} label={s} active={facets.set === s} onClick={() => toggle("set", s)} />
        ))}
      </FilterGroup>
      <FilterGroup label="Rarity">
        {(["common", "uncommon", "rare", "epic", "showcase"] as const).map((r) => (
          <Chip key={r} label={r[0].toUpperCase() + r.slice(1)} active={facets.rarity === r} onClick={() => toggle("rarity", r)} />
        ))}
      </FilterGroup>
      <FilterGroup label="Printing">
        {(["standard", "alt_art", "signature"] as const).map((p) => (
          <Chip key={p} label={printingLabel(p)} active={facets.printing === p} onClick={() => toggle("printing", p)} />
        ))}
      </FilterGroup>
      <FilterGroup label="Type">
        {LISTING_TYPES.map((t) => (
          <Chip key={t} label={typeLabel(t)} active={facets.type === t} onClick={() => toggle("type", t)} />
        ))}
      </FilterGroup>
      <FilterGroup label="Condition">
        {(["nm", "lp", "mp", "psa9"] as const).map((c) => (
          <Chip key={c} label={conditionLabel(c)} active={facets.condition === c} onClick={() => toggle("condition", c)} />
        ))}
      </FilterGroup>
      <FilterGroup label="Language">
        <Chip label={languageLabel("en")} active={facets.language === "en"} onClick={() => toggle("language", "en")} />
        <Chip label={languageLabel("zh")} active={facets.language === "zh"} onClick={() => toggle("language", "zh")} />
        <Chip label="Not stated" active={facets.language === "unstated"} onClick={() => toggle("language", "unstated")} />
      </FilterGroup>
      <Button variant="outline" size="sm" onClick={reset} disabled={activeCount(facets) === 0}>
        Reset all filters
      </Button>
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    onChange(applyFacets(listings, facets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, facets]);

  const toggle = (key: keyof Facets, value: string) => {
    setFacets((f) => ({ ...f, [key]: f[key as "set"] === value ? null : value }));
  };

  const reset = () => setFacets((f) => ({ ...f, set: null, rarity: null, printing: null, type: null, condition: null, language: null }));

  const chips = useMemo(() => activeChips(facets), [facets]);
  const count = activeCount(facets);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0 gap-2 border-zinc-700 px-3 text-[13px] sm:text-sm"
          onClick={() => setPanelOpen(true)}
        >
          <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M2 4h12M4.5 8h7M6.5 12h3" strokeLinecap="round" />
          </svg>
          Filters
          {count > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-semibold text-zinc-950">
              {count}
            </span>
          ) : null}
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <span
              key={c.key as string}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/60 bg-amber-400/10 py-0.5 pl-2.5 pr-1.5 text-xs text-amber-300"
            >
              {c.label}
              <button
                aria-label={`Remove ${c.label} filter`}
                className="rounded-full p-0.5 text-amber-300/70 hover:bg-amber-400/20 hover:text-amber-200"
                onClick={() => toggle(c.key, c.value)}
              >
                <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>

        <Select
          value={facets.sort}
          onValueChange={(v) => setFacets((f) => ({ ...f, sort: v as FacetSort }))}
        >
          <SelectTrigger size="sm" className="h-10 w-[7.5rem] shrink-0 text-[13px] sm:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_asc">Price ↑</SelectItem>
            <SelectItem value="price_desc">Price ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          className={cn(
            "flex flex-col gap-4 overflow-y-auto border-zinc-800 bg-zinc-950 p-5",
            isDesktop ? "w-[22rem] sm:max-w-sm" : "max-h-[80dvh] rounded-t-2xl"
          )}
        >
          <SheetHeader className="p-0">
            <SheetTitle className="text-base">Filters</SheetTitle>
          </SheetHeader>
          <div className="flex-1">
            <FilterGroups facets={facets} toggle={toggle} reset={reset} />
          </div>
          <SheetFooter className="flex-row gap-2 border-t border-zinc-800 p-0 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => setPanelOpen(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
