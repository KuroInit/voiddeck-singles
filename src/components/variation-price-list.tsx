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
 * server (`GET /api/cards/<code>` → card_variations). Each priced variation
 * renders as its own outbound link to Bilgewater Market, like jankrats:
 * `Foil — US$3.71 ≈ S$5.01 · Bilgewater Market, 2026-09-20`.
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
    return <p className={cn("text-xs text-zinc-500", className)}>Loading reference prices…</p>;
  }

  if (priced.length === 0) {
    return (
      <p className={cn("text-xs text-zinc-500", className)}>No reference price available.</p>
    );
  }

  const idUpper = cardCode!.toUpperCase();

  return (
    <div className={cn("text-xs leading-relaxed text-zinc-500", className)}>
      {priced.map((v) => {
        const sgd = Math.round((v.usd as number) * USD_SGD * 100) / 100;
        const suffix = v.asOf ? `, ${v.asOf}` : "";
        return (
          <a
            key={v.variation}
            href={`https://bilgewatermarket.com/cards/${idUpper}?print_variation=${encodeURIComponent(v.variation)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-fit underline-offset-2 transition-colors hover:text-zinc-300 hover:underline"
          >
            {variationLabel(v.variation)} — US${(v.usd as number).toFixed(2)} ≈ S$
            {sgd.toFixed(2)} · {SOURCE_LABELS[v.source] ?? v.source}
            {suffix}
          </a>
        );
      })}
    </div>
  );
}
