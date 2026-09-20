"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Listing } from "@/data/listings";
import { fallbackIntent, scoreCatalogue } from "@/lib/search";

const EXAMPLES = [
  "jinx alt art",
  "removal under $1",
  "sealed origins",
  "chinese print teemo",
  "bulk rares",
];

/**
 * Plain search over the for-sale listings: deterministic token scoring plus
 * local price parsing ("removal under $1"), computed in the browser — no AI.
 * The catalogue comes from the server page as a prop (the listings now live
 * in the local database); the scorer itself is unchanged.
 */
export function SearchBar({
  listings,
  onResults,
}: {
  listings: Listing[];
  onResults: (listings: Listing[] | null, reasons: Record<string, string>) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(false);

  function run(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      clear();
      return;
    }
    const scored = scoreCatalogue(listings, fallbackIntent(trimmed));
    const byId = new Map(listings.map((l) => [l.id, l]));
    const reasons: Record<string, string> = {};
    const results: Listing[] = [];
    for (const s of scored.slice(0, 24)) {
      const listing = byId.get(s.id);
      if (!listing) continue;
      results.push(listing);
      reasons[s.id] = s.reason;
    }
    setActive(true);
    onResults(results, reasons);
  }

  function clear() {
    setQ("");
    setActive(false);
    onResults(null, {});
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the market — try a card name or a budget"
          aria-label="Search listings"
          className="h-11 text-[15px] sm:h-12 sm:text-base"
        />
        <Button
          type="submit"
          size="sm"
          className="h-11 px-4 text-[13px] sm:h-12 sm:px-5 sm:text-sm"
          disabled={!q.trim()}
        >
          Search
        </Button>
        {active || q ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-11 px-3 text-[13px] sm:h-12 sm:text-sm"
            onClick={clear}
          >
            Clear
          </Button>
        ) : null}
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {EXAMPLES.map((ex) => (
          <Badge
            key={ex}
            variant="outline"
            className="shrink-0 cursor-pointer border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            onClick={() => {
              setQ(ex);
              run(ex);
            }}
          >
            {ex}
          </Badge>
        ))}
      </div>
    </div>
  );
}
