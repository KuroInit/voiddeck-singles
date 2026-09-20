"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Listing } from "@/data/listings";
import { getAllListings } from "@/lib/marketplace";

const EXAMPLES = [
  "jinx alt art",
  "removal under $1",
  "sealed origins",
  "chinese print teemo",
  "bulk rares",
];

type SearchMeta = { source: string; reasons: Record<string, string> } | null;

export function SearchBar({
  onResults,
  onError,
}: {
  onResults: (listings: Listing[] | null, meta: SearchMeta) => void;
  onError?: (msg: string) => void;
}) {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  async function run(query: string) {
    const trimmed = query.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: trimmed }),
      });
      if (res.status === 503) {
        const msg = "AI unavailable — server env not set";
        setMessage(msg);
        onError?.(msg);
        onResults(null, null);
        return;
      }
      if (!res.ok) {
        const msg = "Search failed — try again";
        setMessage(msg);
        onError?.(msg);
        onResults(null, null);
        return;
      }
      const data = (await res.json()) as {
        source: string;
        results: { id: string; score: number; reason: string }[];
      };
      const all = getAllListings();
      const byId = new Map(all.map((l: Listing) => [l.id, l]));
      const reasons: Record<string, string> = {};
      const listings: Listing[] = [];
      for (const r of data.results) {
        const listing = byId.get(r.id);
        if (listing) {
          listings.push(listing);
          reasons[r.id] = r.reason;
        }
      }
      setActive(true);
      onResults(listings, { source: data.source, reasons });
      if (listings.length === 0) {
        setMessage("No listings matched — try fewer words");
      } else if (data.source === "keyword-fallback") {
        setMessage("keyword fallback — AI unavailable");
      }
    } catch {
      const msg = "Search failed — network error";
      setMessage(msg);
      onError?.(msg);
      onResults(null, null);
    } finally {
      setPending(false);
    }
  }

  function clear() {
    setQ("");
    setMessage(null);
    setActive(false);
    onResults(null, null);
  }

  return (
    <div className="flex flex-col gap-2">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the market — try a card name or a budget"
          aria-label="Search listings"
          className="h-11 text-[15px] sm:h-12 sm:text-base"
        />
        <Button type="submit" size="sm" className="h-11 px-4 text-[13px] sm:h-12 sm:px-5 sm:text-sm" disabled={pending || !q.trim()}>
          Search
        </Button>
        {active || q ? (
          <Button type="button" size="sm" variant="ghost" className="h-11 px-3 text-[13px] sm:h-12 sm:text-sm" onClick={clear}>
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
      {pending ? (
        <div className="flex flex-col gap-1.5" aria-hidden>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : null}
      {message ? <p className="text-[13px] text-zinc-500">{message}</p> : null}
    </div>
  );
}
