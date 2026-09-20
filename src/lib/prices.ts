import pricesJson from "@/data/prices.json";

export const USD_SGD = 1.35;

type PricesFile = {
  meta?: { source?: unknown; asOf?: unknown };
  prices?: Record<string, unknown>;
};

export function priceMeta(): { source: "bilgewater-market" | "tcgplayer-mirror"; asOf: string } {
  const meta = (pricesJson as PricesFile).meta;
  if (!meta || typeof meta !== "object") {
    return { source: "bilgewater-market", asOf: "" };
  }
  if (meta.source !== "bilgewater-market" && meta.source !== "tcgplayer-mirror") {
    return { source: "bilgewater-market", asOf: "" };
  }
  return {
    source: meta.source,
    asOf: typeof meta.asOf === "string" ? meta.asOf : "",
  };
}

export function getPriceFor(cardCode: string | null): { usd: number; source: string; asOf: string } | null {
  if (cardCode === null) return null;
  const prices = (pricesJson as PricesFile).prices;
  if (!prices || typeof prices !== "object") return null;
  const entry = prices[cardCode] as { usd?: unknown } | undefined;
  const usd = entry && typeof entry === "object" ? entry.usd : undefined;
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0) return null;
  const meta = priceMeta();
  return { usd, source: meta.source, asOf: meta.asOf };
}
