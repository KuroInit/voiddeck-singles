// Fetches the latest riftbound-cards release dataset and trims it to the
// Card shape consumed by the app (src/data/cards.json).
//
// Data source: https://github.com/LouisCourrian/riftbound-cards (releases/latest,
// asset "cards.json"). The dataset is MIT-licensed fan data; card data and
// artwork are © Riot Games.
//
// Usage: npx tsx scripts/fetch-cards.ts

import { writeFile } from "node:fs/promises";
import path from "node:path";

const RELEASE_URL =
  "https://api.github.com/repos/LouisCourrian/riftbound-cards/releases/latest";
const UA = "voiddeck-singles-fetch (local demo data refresh)";
const OUT = path.resolve(__dirname, "../src/data/cards.json");

/** Raw row shape from the riftbound-cards dataset (subset we consume). */
type RawCard = {
  cardCode: string;
  name: string;
  fullName?: string | null;
  subtitle?: string | null;
  setCode: string;
  cardSet: string;
  cardNumber: string;
  rarity: string;
  domain?: string | null;
  domains?: string[] | null;
  cardType: string;
  energy?: number | null;
  power?: number | null;
  might?: number | null;
  abilityOriginal?: string | null;
  abilityCorrected?: string | null;
  ability?: string | null;
  imageUrl?: string | null;
};

/** Trimmed Card shape (mirrors src/data/cards.ts). */
type Card = {
  cardCode: string;
  fullName: string;
  name: string;
  subtitle: string | null;
  setCode: string;
  cardSet: string;
  cardNumber: string;
  rarity: string;
  domain: string;
  domains: string[];
  cardType: string;
  energy: number | null;
  power: number | null;
  might: number | null;
  ability: string | null;
  imageUrl: string | null;
};

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

async function main(): Promise<void> {
  const relRes = await fetch(RELEASE_URL, { headers: { "User-Agent": UA } });
  if (!relRes.ok) {
    throw new Error(`release lookup failed: ${relRes.status} ${RELEASE_URL}`);
  }
  const release = (await relRes.json()) as {
    assets: { name: string; browser_download_url: string }[];
  };
  const asset = release.assets?.find((a) => a.name === "cards.json");
  if (!asset) {
    throw new Error(
      `no "cards.json" asset in latest release (assets: ${release.assets?.map((a) => a.name).join(", ")})`
    );
  }

  const res = await fetch(asset.browser_download_url, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) {
    throw new Error(`asset download failed: ${res.status} ${asset.browser_download_url}`);
  }
  const raw = (await res.json()) as RawCard[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("cards.json asset did not contain a non-empty array");
  }

  const cards: Card[] = raw.map((r) => ({
    cardCode: r.cardCode,
    fullName: r.fullName ?? r.name,
    name: r.name,
    subtitle: r.subtitle ?? null,
    setCode: r.setCode,
    cardSet: r.cardSet,
    cardNumber: r.cardNumber,
    rarity: (r.rarity ?? "").toLowerCase(),
    domain: r.domain ?? "",
    domains:
      Array.isArray(r.domains) && r.domains.length > 0 ? r.domains : [r.domain ?? ""],
    cardType: (r.cardType ?? "").toLowerCase(),
    energy: numOrNull(r.energy),
    power: numOrNull(r.power),
    might: numOrNull(r.might),
    ability: r.abilityOriginal ?? r.abilityCorrected ?? r.ability ?? null,
    imageUrl: r.imageUrl ?? null,
  }));

  await writeFile(OUT, JSON.stringify(cards), "utf8");

  // Summary
  const setCodes = [...new Set(cards.map((c) => c.setCode))].sort();
  console.log(`[fetch-cards] wrote ${cards.length} rows to ${OUT}`);
  console.log(`[fetch-cards] set codes: ${setCodes.join(", ")}`);
  for (const code of ["ogn-007-298", "ven-sp2-006"]) {
    const c = cards.find((x) => x.cardCode === code);
    if (c) {
      console.log(
        `[fetch-cards] ${code}: ${c.fullName} | ${c.setCode}/${c.rarity}/${c.cardType} | domains=${c.domains.join("+")}`
      );
    } else {
      console.warn(`[fetch-cards] WARNING: ${code} not found in output`);
    }
  }
}

main().catch((err) => {
  console.error("[fetch-cards] FAILED:", err);
  process.exitCode = 1;
});
