"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/data/cards";
import { rarityClass } from "@/lib/rarity";
import type { CatalogFacets } from "@/components/home-tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type CardPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (card: Card) => void;
  /** Facet options, computed on the server from the cards table. */
  facets: CatalogFacets;
};

const MAX_RENDER = 200;
const DEBOUNCE_MS = 200;

/**
 * Card picker over the full catalogue. Search queries the server
 * (`GET /api/cards?q=&set=&rarity=&domain=&cardType=`, debounced 200ms,
 * server cap 200) instead of importing cards.json client-side; facet options
 * arrive as props from the server page.
 */
export function CardPicker({ open, onOpenChange, onPick, facets }: CardPickerProps) {
  const [q, setQ] = useState("");
  const [setFilter, setSetFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // Reset local state whenever the picker opens, so a stale query doesn't persist.
  useEffect(() => {
    if (open) {
      setQ("");
      setSetFilter("all");
      setRarityFilter("all");
      setDomainFilter("all");
      setTypeFilter("all");
      setResults([]);
    }
  }, [open]);

  // Debounced server-side search over the cards table.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      const needle = q.trim();
      if (needle) params.set("q", needle);
      if (setFilter !== "all") params.set("set", setFilter);
      if (rarityFilter !== "all") params.set("rarity", rarityFilter);
      if (domainFilter !== "all") params.set("domain", domainFilter);
      if (typeFilter !== "all") params.set("cardType", typeFilter);
      const id = ++reqId.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/cards?${params.toString()}`);
        const data = (await res.json()) as { cards?: Card[] };
        if (reqId.current === id) {
          setResults(Array.isArray(data.cards) ? data.cards : []);
        }
      } catch {
        if (reqId.current === id) setResults([]);
      } finally {
        if (reqId.current === id) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, q, setFilter, rarityFilter, domainFilter, typeFilter]);

  const shown = results.slice(0, MAX_RENDER);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85dvh] max-h-[85dvh] flex-col gap-3 overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0 p-0">
          <DialogTitle>Pick a card</DialogTitle>
          <DialogDescription>
            Search the full Riftbound catalogue ({facets.total} cards).
          </DialogDescription>
        </DialogHeader>

        <Command shouldFilter={false} className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="shrink-0 space-y-2">
            <CommandInput
              placeholder="Search by name…"
              value={q}
              onValueChange={setQ}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select value={setFilter} onValueChange={setSetFilter}>
                <SelectTrigger className="w-full" size="sm" aria-label="Filter by set">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sets</SelectItem>
                  {facets.sets.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rarityFilter} onValueChange={setRarityFilter}>
                <SelectTrigger className="w-full" size="sm" aria-label="Filter by rarity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rarities</SelectItem>
                  {facets.rarities.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger className="w-full" size="sm" aria-label="Filter by domain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  {facets.domains.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full" size="sm" aria-label="Filter by type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {facets.types.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CommandList className="min-h-0 max-h-none flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 px-2 py-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No cards match those filters.</CommandEmpty>
            ) : (
              <div data-anim-root className="py-1">
                {shown.map((card) => (
                  <CommandItem
                    key={card.cardCode}
                    value={card.cardCode}
                    onSelect={() => {
                      onPick(card);
                      onOpenChange(false);
                    }}
                    className="gap-3 px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {card.fullName}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{card.cardCode}</span>
                        <span>{card.cardSet}</span>
                        <span className="capitalize">{card.cardType}</span>
                        {card.domain ? <span>{card.domain}</span> : null}
                      </div>
                    </div>
                    <Badge variant="outline" className={`border ${rarityClass(card.rarity)}`}>
                      {card.rarity}
                    </Badge>
                  </CommandItem>
                ))}
                {results.length > MAX_RENDER ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    Showing first {MAX_RENDER} of {results.length} — refine the search or
                    filters.
                  </p>
                ) : null}
              </div>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
