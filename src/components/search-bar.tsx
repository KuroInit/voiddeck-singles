"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Listing } from "@/data/listings";
import { conditionLabel, printingLabel, TYPE_LABELS } from "@/lib/rarity";
import { fallbackIntent, scoreCatalogue, type SearchIntent } from "@/lib/search";

const EXAMPLES = [
  "jinx alt art",
  "removal under $1",
  "sealed origins",
  "chinese print teemo",
  "cheapest showcase legends",
  "bulk rares",
];

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Intent chips: the visible trace of the parsed query, so reviewers can see
 * what the model understood (and what the fallback understood without it). */
function intentChips(intent: SearchIntent): string[] {
  const chips: string[] = [];
  for (const k of intent.keywords) chips.push(`"${k}"`);
  for (const s of intent.set ?? []) chips.push(s);
  for (const p of intent.printing ?? []) chips.push(printingLabel(p));
  for (const r of intent.rarity ?? []) chips.push(titleCase(r));
  for (const l of intent.language ?? []) chips.push(l === "en" ? "English" : "Chinese");
  for (const c of intent.condition ?? []) chips.push(conditionLabel(c));
  for (const t of intent.type ?? []) chips.push(TYPE_LABELS[t] ?? t);
  if (intent.minPrice !== undefined) chips.push(`≥ S$${intent.minPrice}`);
  if (intent.maxPrice !== undefined) chips.push(`≤ S$${intent.maxPrice}`);
  if (intent.sort === "price_asc") chips.push("cheapest first");
  if (intent.sort === "price_desc") chips.push("priciest first");
  return chips;
}

/**
 * NL search over listings: the query is parsed server-side (POST /api/search —
 * model via the gateway, deterministic parse as fallback), then the returned
 * SearchIntent is scored against the catalogue with the same deterministic
 * scorer as before. Works with the gateway off — it just parses locally.
 */
export function SearchBar({
  listings,
  onResults,
  placeholder = "Search the market — try a card name or a budget",
  ariaLabel = "Search listings",
  examples = EXAMPLES,
}: {
  listings: Listing[];
  onResults: (listings: Listing[] | null, reasons: Record<string, string>) => void;
  placeholder?: string;
  ariaLabel?: string;
  examples?: string[];
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<{ intent: SearchIntent; source: "ai" | "local" } | null>(
    null
  );

  async function run(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      clear();
      return;
    }
    setBusy(true);
    let intent: SearchIntent;
    let source: "ai" | "local" = "local";
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          intent?: SearchIntent;
          source?: "ai" | "local";
        };
        if (data.intent) {
          intent = data.intent;
          source = data.source === "ai" ? "ai" : "local";
        } else {
          intent = fallbackIntent(trimmed);
        }
      } else {
        intent = fallbackIntent(trimmed);
      }
    } catch {
      intent = fallbackIntent(trimmed);
    }
    setBusy(false);
    setParsed({ intent, source });

    const scored = scoreCatalogue(listings, intent);
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
    setBusy(false);
    setParsed(null);
    onResults(null, {});
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="h-11 text-[15px] sm:h-12 sm:text-base"
        />
        <Button
          type="submit"
          size="sm"
          className="btn-hextech h-11 px-4 text-[13px] sm:h-12 sm:px-5 sm:text-sm"
          disabled={!q.trim() || busy}
        >
          {busy ? "…" : "Search"}
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
      {parsed ? (
        <div
          className="flex flex-wrap items-center gap-1.5"
          aria-live="polite"
        >
          <Badge
            variant="outline"
            title={
              parsed.source === "ai"
                ? "Query parsed by the language model server-side"
                : "Model unavailable or unconfigured — parsed with the local deterministic parser"
            }
            className={
              parsed.source === "ai"
                ? "border-emerald-700 px-2 py-0.5 text-[11px] text-emerald-400"
                : "border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400"
            }
          >
            {parsed.source === "ai" ? "AI-parsed" : "local parse"}
          </Badge>
          {intentChips(parsed.intent).map((chip) => (
            <Badge
              key={chip}
              variant="outline"
              className="border-zinc-700 px-2 py-0.5 text-[11px] font-normal text-zinc-400"
            >
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {examples.map((ex) => (
          <Badge
            key={ex}
            variant="outline"
            className="shrink-0 cursor-pointer border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            onClick={() => {
              setQ(ex);
              void run(ex);
            }}
          >
            {ex}
          </Badge>
        ))}
      </div>
    </div>
  );
}
