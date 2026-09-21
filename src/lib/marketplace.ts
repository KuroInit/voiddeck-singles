import "server-only";

import { randomUUID } from "node:crypto";

import { getDb, readVariationsFile } from "./db";
import { getCurrentUser } from "./users";
import { USD_SGD } from "./prices";
import pricesJson from "@/data/prices.json";
import type { Listing } from "@/data/listings";

export { USD_SGD };

// JSON file boundary: resolveJsonModule infers an enormous literal type; cast
// once at the edge into the shape we read.
type PricesFile = { meta?: { source?: string; asOf?: string }; prices?: Record<string, { usd?: number }> };
const PRICES_FILE = pricesJson as PricesFile;

/** Listing plus the cards-table join for art (parent steering: imageUrl via LEFT JOIN). */
export type ListingRow = Listing & { imageUrl?: string | null };
/** Want post with its best in-budget sell listing resolved server-side. */
export type WantListing = ListingRow & { match?: Listing | null };

export type CardVariation = {
  variation: string;
  usd: number | null;
  isFoil: boolean;
  source: string;
  asOf: string;
};

export type Stats = {
  cardCount: number;
  variationCount: number;
  foilCount: number;
  saleCount: number;
  wantCount: number;
  userCount: number;
};

const LISTING_SELECT = `
  SELECT p.id, p.kind, p.card_code AS cardCode, p.card_name AS cardName, p.printing,
         p.rarity, p.type, p.condition, p.language, p.qty, p.price_sgd AS priceSgd,
         p.budget_sgd AS budgetSgd, p.grade, p.pickup, p.note, p.source,
         u.handle AS seller, c.image_url AS imageUrl
  FROM posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN cards c ON c.card_code = p.card_code`;

// Seeds keep their original file order (created_at staggered ascending at seed
// time); user/ai posts surface newest-first after the seed block.
const LISTING_ORDER = `
  ORDER BY CASE WHEN p.source = 'seed' THEN 0 ELSE 1 END, p.created_at DESC, p.id ASC`;

const CONDITION_PRIORITY: Record<Listing["condition"], number> = {
  nm: 0,
  lp: 1,
  mp: 2,
  psa9: 3,
};

function rowToListing(r: Record<string, unknown>): ListingRow {
  const isWant = r.kind === "want";
  const cardCode = r.cardCode === null || r.cardCode === undefined ? null : String(r.cardCode);
  const listing: ListingRow = {
    id: String(r.id),
    cardName: String(r.cardName),
    cardCode,
    // cardCode prefix IS the set code ("ogn-…" → OGN); sealed/bulk rows (null) are Origins products.
    set: (cardCode ? cardCode.slice(0, 3).toUpperCase() : "OGN") as Listing["set"],
    printing: (r.printing ?? "standard") as Listing["printing"],
    rarity: (r.rarity ?? "common") as Listing["rarity"],
    type: (r.type ?? "unit") as Listing["type"],
    condition: (r.condition ?? "nm") as Listing["condition"],
    language: r.language === null || r.language === undefined ? null : (String(r.language) as Listing["language"]),
    qty: Number(r.qty ?? 1),
    priceSgd: isWant ? 0 : Number(r.priceSgd ?? 0),
    grade: r.grade === null || r.grade === undefined ? null : String(r.grade),
    seller: String(r.seller),
    pickup: (r.pickup ?? "mail") as Listing["pickup"],
    note: String(r.note ?? ""),
    mode: isWant ? "wtb" : "sale",
    source: (r.source === "ai_proposed" ? "ai_proposed" : r.source === "seed" ? "seed" : "user") as Listing["source"],
    imageUrl: r.imageUrl === null || r.imageUrl === undefined ? null : String(r.imageUrl),
  };
  if (isWant) listing.budgetSgd = r.budgetSgd === null || r.budgetSgd === undefined ? undefined : Number(r.budgetSgd);
  return listing;
}

function queryListings(where: string, ...params: unknown[]): ListingRow[] {
  const rows = getDb().prepare(`${LISTING_SELECT} ${where} ${LISTING_ORDER}`).all(...params) as Record<
    string,
    unknown
  >[];
  return rows.map(rowToListing);
}

export async function getAllListings(): Promise<ListingRow[]> {
  // "Listings" = open sell posts (the listings_view); want posts live on the
  // Looking-for board via getWtbPosts.
  return queryListings("WHERE p.status = 'open' AND p.kind = 'sell'");
}

export async function getListings(mode: "sale" | "wtb"): Promise<WantListing[]> {
  const rows =
    mode === "sale"
      ? queryListings("WHERE p.status = 'open' AND p.kind = 'sell'")
      : await getWtbPosts();
  return rows;
}

export async function getWtbPosts(): Promise<WantListing[]> {
  const posts = queryListings("WHERE p.status = 'open' AND p.kind = 'want'");
  // Each want post carries its best in-budget listing; an honest null means
  // nothing currently matches within budget.
  return Promise.all(
    posts.map(async (post) => ({ ...post, match: await bestListingFor(post.cardCode, post.budgetSgd) })),
  );
}

export async function getListingById(id: string): Promise<ListingRow | null> {
  const rows = queryListings("WHERE p.status = 'open' AND p.id = ?", id);
  return rows[0] ?? null;
}

const DEFAULTS = {
  printing: "standard",
  rarity: "common",
  type: "unit",
  condition: "nm",
  language: null,
  pickup: "mail",
  grade: null,
} as const;

export type SellListingInput = {
  cardName: string;
  cardCode: string | null;
  printing: Listing["printing"];
  rarity: Listing["rarity"];
  type: Listing["type"];
  condition: Listing["condition"];
  language: Listing["language"];
  qty: number;
  priceSgd: number;
  grade?: string | null;
  pickup: Listing["pickup"];
  note: string;
  source?: "user" | "ai_proposed";
};

export type WantPostInput = {
  cardName: string;
  cardCode: string | null;
  qty?: number;
  budgetSgd: number;
  note: string;
  source?: "user" | "ai_proposed";
};

function newPostId(): string {
  // Two posts in the same millisecond collide on the PRIMARY KEY — suffix a
  // random component so a double-submit burst 500s are impossible.
  return `U-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

// The current user is resolved from the vds_user cookie (async in Next 15);
// post insertion happens for whoever holds it. Route handlers translate a
// NoUserError into the pinned 401 shape.
export class NoUserError extends Error {
  constructor() {
    super("NO_USER");
  }
}

async function insertPost(values: {
  kind: "sell" | "want";
  cardCode: string | null;
  cardName: string;
  printing: string;
  rarity: string;
  type: string;
  condition: string;
  language: string | null;
  qty: number;
  priceSgd: number | null;
  budgetSgd: number | null;
  grade: string | null;
  pickup: string;
  note: string;
  source: "user" | "ai_proposed";
}): Promise<ListingRow> {
  const user = await getCurrentUser();
  if (!user) throw new NoUserError();
  const db = getDb();
  const id = newPostId();
  db.prepare(
    `INSERT INTO posts (
      id, user_id, kind, card_code, card_name, printing, rarity, type,
      condition, language, qty, price_sgd, budget_sgd, grade, pickup, note,
      status, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
  ).run(
    id,
    user.id,
    values.kind,
    values.cardCode,
    values.cardName,
    values.printing,
    values.rarity,
    values.type,
    values.condition,
    values.language,
    values.qty,
    values.priceSgd,
    values.budgetSgd,
    values.grade,
    values.pickup,
    values.note,
    values.source,
    new Date().toISOString(),
  );
  const listing = await getListingById(id);
  if (!listing) throw new Error(`inserted post ${id} vanished`);
  return listing;
}

export async function addSellListing(input: SellListingInput): Promise<ListingRow> {
  return insertPost({
    kind: "sell",
    cardCode: input.cardCode,
    cardName: input.cardName,
    printing: input.printing ?? DEFAULTS.printing,
    rarity: input.rarity ?? DEFAULTS.rarity,
    type: input.type ?? DEFAULTS.type,
    condition: input.condition ?? DEFAULTS.condition,
    language: input.language ?? DEFAULTS.language,
    qty: input.qty,
    priceSgd: input.priceSgd,
    budgetSgd: null,
    grade: input.grade ?? DEFAULTS.grade,
    pickup: input.pickup ?? DEFAULTS.pickup,
    note: input.note,
    source: input.source ?? "user",
  });
}

export async function addWtbPost(input: WantPostInput): Promise<ListingRow> {
  return insertPost({
    kind: "want",
    cardCode: input.cardCode,
    cardName: input.cardName,
    printing: DEFAULTS.printing,
    rarity: DEFAULTS.rarity,
    type: DEFAULTS.type,
    condition: DEFAULTS.condition,
    language: DEFAULTS.language,
    qty: input.qty ?? 1,
    priceSgd: null,
    budgetSgd: input.budgetSgd,
    grade: DEFAULTS.grade,
    pickup: DEFAULTS.pickup,
    note: input.note,
    source: input.source ?? "user",
  });
}

/** Batch helper (deck-import validation): creates want posts, preserving order. */
export async function createWantPosts(inputs: WantPostInput[]): Promise<Listing[]> {
  const listings: Listing[] = [];
  for (const input of inputs) {
    listings.push(await addWtbPost(input));
  }
  return listings;
}

export async function bestListingFor(cardCode: string | null, budgetSgd?: number): Promise<Listing | null> {
  if (cardCode === null) return null;
  const candidates = queryListings(
    "WHERE p.status = 'open' AND p.kind = 'sell' AND p.card_code = ? AND p.qty > 0",
    cardCode,
  ).filter((l) => budgetSgd === undefined || l.priceSgd <= budgetSgd);
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      a.priceSgd - b.priceSgd ||
      CONDITION_PRIORITY[a.condition] - CONDITION_PRIORITY[b.condition] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return candidates[0];
}

export async function getStats(): Promise<Stats> {
  const db = getDb();
  const scalar = (sql: string): number => {
    const row = db.prepare(sql).get() as { n: number | bigint } | undefined;
    return row ? Number(row.n) : 0;
  };
  return {
    cardCount: scalar("SELECT COUNT(*) AS n FROM cards"),
    variationCount: scalar("SELECT COUNT(*) AS n FROM card_variations"),
    // A card "has a foil variant" iff any variation row is foil — this is what
    // drives the shimmer, so count cards, not rows.
    foilCount: scalar("SELECT COUNT(DISTINCT card_code) AS n FROM card_variations WHERE is_foil = 1"),
    saleCount: scalar("SELECT COUNT(*) AS n FROM listings_view"),
    wantCount: scalar("SELECT COUNT(*) AS n FROM posts WHERE kind = 'want' AND status = 'open'"),
    userCount: scalar("SELECT COUNT(*) AS n FROM users"),
  };
}

export async function getCardVariations(cardCode: string): Promise<CardVariation[]> {
  const rows = getDb()
    .prepare(
      `SELECT variation, usd, is_foil FROM card_variations
       WHERE card_code = ?
       ORDER BY CASE WHEN variation = 'normal' THEN 0 ELSE 1 END, variation ASC`,
    )
    .all(cardCode) as Record<string, unknown>[];
  const meta = priceMeta();
  return rows.map((r) => ({
    variation: String(r.variation),
    usd: r.usd === null || r.usd === undefined ? null : Number(r.usd),
    isFoil: Number(r.is_foil) === 1,
    source: meta.source,
    asOf: meta.asOf,
  }));
}

export function priceMeta(): { source: "bilgewater-market" | "tcgplayer-mirror"; asOf: string } {
  const vf = readVariationsFile();
  const meta = vf?.meta ?? PRICES_FILE.meta;
  if (!meta || typeof meta !== "object") {
    return { source: "bilgewater-market", asOf: "" };
  }
  if (meta.source !== "bilgewater-market" && meta.source !== "tcgplayer-mirror") {
    return { source: "bilgewater-market", asOf: "" };
  }
  return { source: meta.source, asOf: typeof meta.asOf === "string" ? meta.asOf : "" };
}

/** Cheapest 'normal' variation from card_variations; falls back to prices.json. */
export async function getPriceFor(
  cardCode: string | null,
): Promise<{ usd: number; source: string; asOf: string } | null> {
  if (cardCode === null) return null;
  const normals = (await getCardVariations(cardCode))
    .filter((v) => v.variation === "normal" && v.usd !== null)
    .sort((a, b) => (a.usd ?? 0) - (b.usd ?? 0));
  if (normals.length > 0) {
    const best = normals[0];
    return { usd: best.usd as number, source: best.source, asOf: best.asOf };
  }
  const entry = PRICES_FILE.prices?.[cardCode];
  if (!entry || typeof entry.usd !== "number" || !Number.isFinite(entry.usd) || entry.usd < 0) return null;
  const meta = priceMeta();
  return { usd: entry.usd, source: meta.source, asOf: meta.asOf };
}

export { getCurrentUser };
