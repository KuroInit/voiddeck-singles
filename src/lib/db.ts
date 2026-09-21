import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { SEED_LISTINGS } from "@/data/listings";
import { CARDS } from "@/data/cards";
import type { Card } from "@/data/cards";
import pricesJson from "@/data/prices.json";
import foilJson from "@/data/foil.json";

// JSON file boundaries: resolveJsonModule infers enormous literal types; cast
// once at the edge into the small shapes we actually read.
type PricesFile = { prices?: Record<string, { usd?: number }> };
type FoilFile = { codes?: string[] };
const PRICES_FILE = pricesJson as PricesFile;
const FOIL_FILE = foilJson as FoilFile;

/** Serverless hosts (Vercel) mount the project dir read-only but give a writable
 *  /tmp — the DB remaps there and re-seeds lazily per cold start (ensureSeeded).
 *  Local dev keeps data/ so the db persists across restarts. */
export const DATA_DIR =
  process.env.VERCEL === "1" ? "/tmp/vds-data" : path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "vds.db");

const SEED_HANDLES = [
  "kaiju_karen",
  "zilean_dad",
  "bojio_ben",
  "gg_wp_gwen",
  "teh_ping_gavin",
  "choachu_kang",
  "oniichan_ops",
  "jurong_janna",
] as const;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  card_code TEXT,
  card_name TEXT NOT NULL,
  printing TEXT,
  rarity TEXT,
  type TEXT,
  condition TEXT,
  language TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  price_sgd REAL,
  budget_sgd REAL,
  grade TEXT,
  pickup TEXT,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  card_code TEXT PRIMARY KEY,
  name TEXT,
  full_name TEXT,
  subtitle TEXT,
  set_code TEXT,
  card_set TEXT,
  card_number TEXT,
  rarity TEXT,
  domain TEXT,
  domains TEXT,
  card_type TEXT,
  energy REAL,
  power REAL,
  might REAL,
  ability TEXT,
  image_url TEXT
);
CREATE TABLE IF NOT EXISTS card_variations (
  card_code TEXT NOT NULL REFERENCES cards(card_code),
  variation TEXT NOT NULL,
  usd REAL,
  is_foil INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (card_code, variation)
);
CREATE VIEW IF NOT EXISTS listings_view AS
  SELECT p.*, u.handle AS seller FROM posts p JOIN users u ON u.id = p.user_id
  WHERE p.kind = 'sell' AND p.status = 'open';
CREATE INDEX IF NOT EXISTS idx_posts_card ON posts(card_code, kind, status);
CREATE INDEX IF NOT EXISTS idx_posts_kind ON posts(kind, status);
`;

let db: DatabaseSync | null = null;
let ensured = false;

export function getDb(): DatabaseSync {
  if (!ensured) ensureSeeded();
  return db!;
}

export function ensureSeeded(): void {
  if (ensured && db) return;
  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  seedIfEmpty();
  ensured = true;
}

function count(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as { n: number | bigint } | undefined;
  return row ? Number(row.n) : 0;
}

function seedIfEmpty(): void {
  const d = db!;
  if (count(d, "SELECT COUNT(*) AS n FROM users") === 0 && count(d, "SELECT COUNT(*) AS n FROM posts") === 0) {
    seedUsersAndPosts();
  }
  if (count(d, "SELECT COUNT(*) AS n FROM cards") === 0) {
    seedCardsAndVariations();
  }
}

// ---- seeding ---------------------------------------------------------------

function seedUsersAndPosts(): void {
  const d = db!;
  const now = Date.now();
  const base = now - 24 * 60 * 60 * 1000; // seeds are at least a day old
  const insertUser = d.prepare(
    "INSERT INTO users (id, handle, kind, created_at) VALUES (?, ?, 'seed', ?)",
  );
  const byHandle = new Map<string, string>();
  d.exec("BEGIN");
  try {
    SEED_HANDLES.forEach((handle, i) => {
      const id = `su-${handle}`;
      byHandle.set(handle, id);
      insertUser.run(id, handle, new Date(base - 60 * 60 * 1000 - i * 60_000).toISOString());
    });
    const insertPost = d.prepare(
      `INSERT INTO posts (
        id, user_id, kind, card_code, card_name, printing, rarity, type,
        condition, language, qty, price_sgd, budget_sgd, grade, pickup, note,
        status, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'seed', ?)`,
    );
    // created_at descends with index so `ORDER BY created_at DESC` keeps the
    // original SEED_LISTINGS order (L01, L02, ...) within the seed block.
    SEED_LISTINGS.forEach((l, i) => {
      const userId = byHandle.get(l.seller);
      if (!userId) throw new Error(`seed listing ${l.id} references unknown seller ${l.seller}`);
      const isSale = l.mode === "sale";
      insertPost.run(
        l.id,
        userId,
        isSale ? "sell" : "want",
        l.cardCode,
        l.cardName,
        l.printing,
        l.rarity,
        l.type,
        l.condition,
        l.language,
        l.qty,
        isSale ? l.priceSgd : null,
        isSale ? null : (l.budgetSgd ?? null),
        l.grade,
        l.pickup,
        l.note,
        new Date(base + (SEED_LISTINGS.length - i) * 60_000).toISOString(),
      );
    });
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

/** variations.json (produced by scripts/fetch-prices.ts), or null when absent/corrupt. */
export type VariationsFile = {
  meta?: { source?: string; asOf?: string };
  variations?: Record<string, { variation: string; usd: number | null }[]>;
};

export function readVariationsFile(): VariationsFile | null {
  const p = path.join(process.cwd(), "src", "data", "variations.json");
  if (!existsSync(p)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as VariationsFile;
  } catch {
    return null;
  }
}

function seedCardsAndVariations(): void {
  const d = db!;
  const insertCard = d.prepare(
    `INSERT INTO cards (
      card_code, name, full_name, subtitle, set_code, card_set, card_number,
      rarity, domain, domains, card_type, energy, power, might, ability, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const knownCodes = new Set<string>();
  d.exec("BEGIN");
  try {
    for (const c of CARDS) {
      knownCodes.add(c.cardCode);
      insertCard.run(
        c.cardCode,
        c.name,
        c.fullName,
        c.subtitle,
        c.setCode,
        c.cardSet,
        c.cardNumber,
        c.rarity,
        c.domain,
        JSON.stringify(c.domains ?? []),
        c.cardType,
        c.energy,
        c.power,
        c.might,
        c.ability,
        c.imageUrl,
      );
    }
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }

  seedVariations(knownCodes);
}

function isFoilVariation(variation: string): boolean {
  return variation.startsWith("foiled") || variation.startsWith("signature");
}

function seedVariations(knownCodes: Set<string>): void {
  const d = db!;
  const vf = readVariationsFile();

  const insertVariation = d.prepare(
    "INSERT OR IGNORE INTO card_variations (card_code, variation, usd, is_foil) VALUES (?, ?, ?, ?)",
  );
  d.exec("BEGIN");
  try {
    const variations = vf?.variations;
    if (variations && Object.keys(variations).length > 0) {
      for (const [code, rows] of Object.entries(variations)) {
        if (!knownCodes.has(code)) continue; // FK: only cards we actually store
        for (const row of rows) {
          if (typeof row?.variation !== "string" || row.variation.length === 0) continue;
          insertVariation.run(
            code,
            row.variation,
            typeof row.usd === "number" && Number.isFinite(row.usd) ? row.usd : null,
            isFoilVariation(row.variation) ? 1 : 0,
          );
        }
      }
    } else {
      // Fallback: prices.json as a single 'normal' row per code, foil from foil.json.
      const prices = PRICES_FILE.prices ?? {};
      const foilCodes = new Set<string>(FOIL_FILE.codes ?? []);
      for (const [code, entry] of Object.entries(prices)) {
        if (!knownCodes.has(code)) continue;
        const usd = entry && typeof entry.usd === "number" && Number.isFinite(entry.usd) ? entry.usd : null;
        insertVariation.run(code, "normal", usd, foilCodes.has(code) ? 1 : 0);
      }
    }
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

// ---- cards row mapping (shared by the /api/cards routes) --------------------

export type { Card };

export function rowToCard(r: Record<string, unknown>): Card {
  let domains: string[] = [];
  try {
    const parsed: unknown = r.domains === null || r.domains === undefined ? null : JSON.parse(String(r.domains));
    if (Array.isArray(parsed)) domains = parsed.filter((d): d is string => typeof d === "string");
  } catch {
    domains = [];
  }
  return {
    cardCode: String(r.card_code),
    name: r.name === null || r.name === undefined ? "" : String(r.name),
    fullName: r.full_name === null || r.full_name === undefined ? "" : String(r.full_name),
    subtitle: r.subtitle === null || r.subtitle === undefined ? null : String(r.subtitle),
    setCode: r.set_code === null || r.set_code === undefined ? "" : String(r.set_code),
    cardSet: r.card_set === null || r.card_set === undefined ? "" : String(r.card_set),
    cardNumber: r.card_number === null || r.card_number === undefined ? "" : String(r.card_number),
    rarity: r.rarity === null || r.rarity === undefined ? "" : String(r.rarity),
    domain: r.domain === null || r.domain === undefined ? "" : String(r.domain),
    domains,
    cardType: r.card_type === null || r.card_type === undefined ? "" : String(r.card_type),
    energy: r.energy === null || r.energy === undefined ? null : Number(r.energy),
    power: r.power === null || r.power === undefined ? null : Number(r.power),
    might: r.might === null || r.might === undefined ? null : Number(r.might),
    ability: r.ability === null || r.ability === undefined ? null : String(r.ability),
    imageUrl: r.image_url === null || r.image_url === undefined ? null : String(r.image_url),
  };
}
