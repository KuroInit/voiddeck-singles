/**
 * Deterministic catalogue search: plain keyword/price intent parsing plus a
 * stable scoring pass over the listings. Pure and dependency-free — safe to
 * import from client components (SearchBar) and server routes (ask/bundle
 * retrieval) alike.
 */
import type { Listing } from "@/data/listings";
import { printingLabel } from "@/lib/rarity";

export type SearchIntent = {
  keywords: string[];
  printing?: string[];
  rarity?: string[];
  language?: string[];
  condition?: string[];
  type?: string[];
  maxPrice?: number;
  minPrice?: number;
  sort?: "relevance" | "price_asc" | "price_desc";
};

export type ScoredListing = { id: string; score: number; reason: string };

const FACETS = {
  printing: ["standard", "alt_art", "signature"],
  rarity: ["common", "uncommon", "rare", "epic", "showcase"],
  language: ["en", "zh"],
  condition: ["nm", "lp", "mp", "psa9"],
  type: ["legend", "unit", "spell", "rune", "battlefield", "gear", "token", "sealed", "bulk"],
} as const;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** Naive stem: strip one trailing s/es/ed/ing. */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 2 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Substring match on normalized words, after stemming both sides. */
function wordMatches(token: string, word: string): boolean {
  const t = stem(token);
  const w = stem(word);
  if (!t || !w) return false;
  return t === w || (t.length >= 3 && w.includes(t)) || (w.length >= 3 && t.includes(w));
}

/** How much of a keyword phrase appears in a field's normalized words. */
function phraseMatch(phrase: string, fieldWords: string[]): {
  matched: number;
  total: number;
  phraseHit: boolean;
} {
  const toks = tokens(phrase);
  if (toks.length === 0) return { matched: 0, total: 0, phraseHit: false };
  let matched = 0;
  for (const tok of toks) {
    if (fieldWords.some((w) => wordMatches(tok, w))) matched++;
  }
  // Full-phrase containment bonus: every stemmed token appears in order-agnostic
  // sequence within the joined field text.
  const phraseHit =
    toks.length > 1 && normText(fieldWords).includes(toks.map((t) => stem(t)).join(" "));
  return { matched, total: toks.length, phraseHit };
}

function normText(words: string[]): string {
  return words.map((w) => stem(w)).join(" ");
}

const PRICE_STOPWORDS: Record<string, true> = {
  under: true, below: true, over: true, above: true, less: true, more: true,
  than: true, at: true, least: true, max: true, maximum: true, min: true,
  minimum: true, sgd: true, usd: true,
};

export function fallbackIntent(q: string): SearchIntent {
  const s = q.toLowerCase();
  const maxMatch = s.match(/(?:under|below|less than|<)\s*\$?\s*(\d+(?:\.\d+)?)/);
  const minMatch = s.match(/(?:over|above|more than|at least|>)\s*\$?\s*(\d+(?:\.\d+)?)/);
  const maxPrice = maxMatch ? Number.parseFloat(maxMatch[1]) : undefined;
  const minPrice = minMatch ? Number.parseFloat(minMatch[1]) : undefined;
  const keywords = tokens(q).filter(
    (t) => !PRICE_STOPWORDS[t] && !/^\$?\d+(\.\d+)?$/.test(t)
  );
  const intent: SearchIntent = { keywords, sort: "relevance" };
  if (maxPrice !== undefined) intent.maxPrice = maxPrice;
  if (minPrice !== undefined) intent.minPrice = minPrice;
  return intent;
}

/* ---------- deterministic scoring ---------- */

type FieldGroup = { text: string; weight: number };

function listingFieldGroups(l: Listing): FieldGroup[] {
  const printingText = printingLabel(l.printing);
  return [
    { text: l.cardName, weight: 3 },
    { text: [printingText, l.rarity].filter(Boolean).join(" "), weight: 2 },
    { text: l.type, weight: 1 },
    { text: l.note, weight: 1 },
  ].filter((g) => g.text.length > 0);
}

function priceOf(listings: Listing[], id: string): number {
  return listings.find((l) => l.id === id)?.priceSgd ?? Number.MAX_SAFE_INTEGER;
}

export function scoreCatalogue(listings: Listing[], intent: SearchIntent): ScoredListing[] {
  const hasFilters =
    (intent.printing?.length ?? 0) > 0 ||
    (intent.rarity?.length ?? 0) > 0 ||
    (intent.language?.length ?? 0) > 0 ||
    (intent.condition?.length ?? 0) > 0 ||
    (intent.type?.length ?? 0) > 0 ||
    intent.maxPrice !== undefined ||
    intent.minPrice !== undefined;

  const passing = listings.filter((l) => {
    if (intent.printing?.length && !intent.printing.includes(l.printing)) return false;
    if (intent.rarity?.length && !intent.rarity.includes(l.rarity)) return false;
    if (intent.language?.length && !(l.language && intent.language.includes(l.language)))
      return false;
    if (intent.condition?.length && !intent.condition.includes(l.condition)) return false;
    if (intent.type?.length && !intent.type.includes(l.type)) return false;
    if (intent.maxPrice !== undefined && l.priceSgd > intent.maxPrice) return false;
    if (intent.minPrice !== undefined && l.priceSgd < intent.minPrice) return false;
    return true;
  });

  const keywords = intent.keywords.filter((k) => k.trim().length > 0);
  const scored: ScoredListing[] = [];

  for (const l of passing) {
    const groups = listingFieldGroups(l);
    let score = 0;
    const matchedPhrases: string[] = [];

    for (const phrase of keywords) {
      let phraseScored = false;
      for (const g of groups) {
        const { matched, total, phraseHit } = phraseMatch(phrase, tokens(g.text));
        if (matched === 0) continue;
        score += g.weight * (matched / total);
        if (phraseHit) score += g.weight;
        phraseScored = true;
      }
      if (phraseScored) matchedPhrases.push(phrase);
    }

    if (score > 0) {
      const shown = matchedPhrases.slice(0, 3).map((p) => `"${p}"`);
      scored.push({
        id: l.id,
        score: Math.round(score * 100) / 100,
        reason: `matches ${shown.join(" + ")}`,
      });
    }
  }

  if (scored.length === 0 && hasFilters) {
    // Filter-only intent (or keywords matched nothing): keep facet matches at 0.
    return passing.map((l) => ({ id: l.id, score: 0, reason: "facet match" }));
  }

  if (intent.sort === "price_asc") {
    scored.sort((a, b) => priceOf(listings, a.id) - priceOf(listings, b.id));
  } else if (intent.sort === "price_desc") {
    scored.sort((a, b) => priceOf(listings, b.id) - priceOf(listings, a.id));
  } else {
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return priceOf(listings, a.id) - priceOf(listings, b.id);
    });
  }
  return scored;
}
