import foilJson from "@/data/foil.json";

type FoilFile = {
  meta?: { source?: unknown; asOf?: unknown };
  codes?: unknown;
};

/** True when the market data shows this printing exists as a foil/holo variant. */
export function isFoil(cardCode: string | null): boolean {
  if (!cardCode) return false;
  const codes = (foilJson as FoilFile).codes;
  return Array.isArray(codes) && codes.includes(cardCode);
}

export function foilMeta(): { source: string; asOf: string } {
  const meta = (foilJson as FoilFile).meta;
  return {
    source: typeof meta?.source === "string" ? meta.source : "",
    asOf: typeof meta?.asOf === "string" ? meta.asOf : "",
  };
}
