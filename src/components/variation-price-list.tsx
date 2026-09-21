"use client";

import { useEffect, useRef, useState } from "react";
import { USD_SGD } from "@/lib/prices";
import { cn } from "@/lib/utils";

type VariationRow = {
  variation: string;
  usd: number | null;
  isFoil: boolean;
  source: string;
  asOf: string;
};

const SOURCE_LABELS: Record<string, string> = {
  "bilgewater-market": "Bilgewater Market",
  "tcgplayer-mirror": "TCGplayer mirror",
};

/** jankrats-style label: `signature` → "Signature (foil)", `foiled` → "Foil", others capitalized. */
function variationLabel(variation: string): string {
  if (variation === "signature") return "Signature (foil)";
  if (variation.startsWith("foiled")) return "Foil";
  return variation
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Per-variation reference prices for one card printing, fetched from the
 * server (`GET /api/cards/<code>` → card_variations). Rendered in its own
 * "Market Cost" panel below the card image. There is no price history: the
 * source ships a single dated snapshot (Bilgewater Market's API is bot-walled,
 * so no live or historical series is available), so the panel shows each
 * priced variation's cost as of that snapshot — "Normal — US$0.05 ≈ S$0.07 ·
 * Bilgewater Market, 2026-09-20" — each as its own outbound link, jankrats-style.
 * Unpriced variations are skipped; no priced variation at all → honest
 * "No reference price available." No price is ever invented.
 */
export function VariationPriceList({
  cardCode,
  className,
  onPrices,
}: {
  cardCode: string | null;
  className?: string;
  /** Notifies the parent of a prefill price: the `normal` variation's USD, else the cheapest priced variation. */
  onPrices?: (minUsd: number | null) => void;
}) {
  const [priced, setPriced] = useState<VariationRow[] | null>(null);
  const onPricesRef = useRef(onPrices);
  onPricesRef.current = onPrices;

  useEffect(() => {
    if (cardCode === null) {
      setPriced([]);
      onPricesRef.current?.(null);
      return;
    }
    let cancelled = false;
    setPriced(null);
    fetch(`/api/cards/${encodeURIComponent(cardCode)}`)
      .then(async (res) => {
        if (!res.ok) return { variations: [] as VariationRow[] };
        return (await res.json()) as { variations: VariationRow[] };
      })
      .then((data) => {
        if (cancelled) return;
        const rows = (data.variations ?? []).filter(
          (v) => typeof v.usd === "number" && Number.isFinite(v.usd),
        );
        setPriced(rows);
        const normal = rows.find((v) => v.variation === "normal");
        onPricesRef.current?.(
          normal ? normal.usd : rows.length > 0 ? Math.min(...rows.map((v) => v.usd!)) : null,
        );
      })
      .catch(() => {
        if (!cancelled) setPriced([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cardCode]);

  if (priced === null) {
    return (
      <div className={cn("hextech-frame chamfer rounded-none p-4", className)}>
        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Market Cost</p>
        <p className="mt-1.5 text-xs text-zinc-500">Loading reference prices…</p>
      </div>
    );
  }

  if (priced.length === 0) {
    return (
      <div className={cn("hextech-frame chamfer rounded-none p-4", className)}>
        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Market Cost</p>
        <p className="mt-1.5 text-xs text-zinc-500">No reference price available.</p>
      </div>
    );
  }

  const idUpper = cardCode!.toUpperCase();

  return (
    <div className={cn("hextech-frame chamfer rounded-none p-4 text-xs leading-relaxed text-zinc-500", className)}>
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Market Cost</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {priced.map((v) => {
          const sgd = Math.round((v.usd as number) * USD_SGD * 100) / 100;
          const suffix = v.asOf ? `, ${v.asOf}` : "";
          return (
            <a
              key={v.variation}
              href={`https://bilgewatermarket.com/cards/${idUpper}?print_variation=${encodeURIComponent(v.variation)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-fit text-muted-foreground underline-offset-2 transition-colors hover:text-gold-bright hover:underline"
            >
              <span className="text-gold-bright">{variationLabel(v.variation)}</span>
              {" — US$"}
              {(v.usd as number).toFixed(2)}
              {" ≈ S$"}
              {sgd.toFixed(2)}
              {" · "}
              {SOURCE_LABELS[v.source] ?? v.source}
              {suffix}
            </a>
          );
        })}
      </div>
    </div>
  );
}
