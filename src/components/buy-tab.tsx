"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AskPanel } from "@/components/ask-panel";
import { BundleSheet } from "@/components/bundle-sheet";
import { DeckImportSheet } from "@/components/deck-import-sheet";
import { FacetBar } from "@/components/facet-bar";
import { ListingCard } from "@/components/listing-card";
import { SearchBar } from "@/components/search-bar";
import type { Listing } from "@/data/listings";
import { addToCart } from "@/lib/cart";
import { revealStagger } from "@/lib/motion";
import { toast } from "sonner";

function notifyCartChanged() {
  window.dispatchEvent(new CustomEvent("vds:cart-changed"));
}

export function BuyTab({ listings }: { listings: Listing[] }) {
  // Sale listings arrive from the server page; sort once, price ascending.
  const [catalogue] = useState<Listing[]>(() =>
    [...listings].sort((a, b) => a.priceSgd - b.priceSgd),
  );
  const [base, setBase] = useState<Listing[] | null>(null);
  const [shown, setShown] = useState<Listing[]>(catalogue);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [askOpen, setAskOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [prefillGoal, setPrefillGoal] = useState<string | undefined>(undefined);
  const [prefillBudget, setPrefillBudget] = useState<number | undefined>(undefined);
  const gridRef = useRef<HTMLDivElement>(null);

  const onFacets = useCallback((next: Listing[]) => setShown(next), []);

  const onSearchResults = useCallback(
    (listings: Listing[] | null, reasons: Record<string, string>) => {
      setBase(listings);
      setReasons(reasons);
      if (listings === null) setShown(catalogue);
    },
    [catalogue],
  );

  useEffect(() => {
    if (gridRef.current) revealStagger(gridRef.current);
  }, [shown]);

  function handleAdd(listing: Listing) {
    addToCart(listing.id, 1, { maxQty: listing.qty });
    notifyCartChanged();
    toast.success("Added to cart");
  }

  const resultLabel = base === null ? "the full market" : "search results";

  return (
    <div className="flex w-full flex-col gap-4 pb-24 md:gap-5">
      <SearchBar listings={catalogue} onResults={onSearchResults} />

      <FacetBar listings={base ?? catalogue} onChange={onFacets} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400 sm:text-[15px]">
          {shown.length} {shown.length === 1 ? "listing" : "listings"}
          {base !== null ? ` in ${resultLabel}` : ""}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-9 text-[13px]" onClick={() => setDeckOpen(true)}>
            Import a deck
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-[13px]" onClick={() => setBundleOpen(true)}>
            Build a deck core
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500 sm:text-base">
          {base !== null
            ? "No listings matched — try fewer words or clear the search."
            : "Nothing for sale right now. Check back after the next restock."}
        </p>
      ) : (
        <div
          ref={gridRef}
          className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-x-4 xl:grid-cols-4"
        >
          {shown.map((listing) => (
            <div key={listing.id} className="flex flex-col gap-1.5">
              {reasons[listing.id] ? (
                <Badge
                  variant="outline"
                  className="w-fit max-w-full truncate border-sky-800 text-[10px] font-normal text-sky-400 sm:text-[11px]"
                  title={reasons[listing.id]}
                >
                  {reasons[listing.id]}
                </Badge>
              ) : null}
              <ListingCard listing={listing} onAddToCart={handleAdd} />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setAskOpen(true)}
        className="fixed right-4 bottom-4 z-40 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/40 transition-colors hover:bg-amber-300 md:text-[15px]"
      >
        Ask the shop
      </button>

      <AskPanel open={askOpen} onOpenChange={setAskOpen} />
      <BundleSheet
        open={bundleOpen}
        onOpenChange={setBundleOpen}
        listings={catalogue}
        prefillGoal={prefillGoal}
        prefillBudget={prefillBudget}
      />
      <DeckImportSheet
        open={deckOpen}
        onOpenChange={setDeckOpen}
        onPrefillBundle={(goal: string, budgetSgd?: number) => {
          setDeckOpen(false);
          setPrefillGoal(goal);
          setPrefillBudget(budgetSgd);
          setBundleOpen(true);
        }}
      />
    </div>
  );
}
