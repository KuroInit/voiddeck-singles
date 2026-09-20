# Voiddeck Singles — data-layer architecture (pinned)

Date: 2026-09-20. Scope: local-only (no hosting). Stack: Next.js 15 + SQLite via `node:sqlite` (Node 24 built-in, verified).

## Goal
Replace the localStorage persistence with a real local database and restructure the domain into four stores, so deck import can check availability across ALL listings and propose Looking-for posts for gaps — with explicit user validation before anything is created.

## Stores
1. **cards** — every Riftbound printing (all variations incl. `-a` alt-art and `-star` signature rows), with per-variation Bilgewater prices and foil flags.
2. **listings** — sellable inventory: SQL **view** over open sell posts (`kind='sell' AND status='open'`). Seeds + user sell posts live in `posts`; the view is the thing search/deck import/AI check.
3. **users** — everyone with a profile (seeded fictional sellers + local demo signups; handle-based, no passwords).
4. **posts** — everything a user posts: `kind='sell'` (creates a listing) or `kind='want'` (Looking-for), with `source` = `seed | user | ai_proposed`.

## Database
- File: `data/vds.db` (gitignored). Engine: `node:sqlite` `DatabaseSync` (synchronous — perfect for route handlers/server components).
- Lazy bootstrap: `ensureSeeded()` in `src/lib/db.ts` — creates schema + seeds if empty; safe to call on every request. Also `npm run db:seed` for explicit reseeding (drops + recreates).

### Schema (pinned)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,            -- 'su-<handle-slug>' for seeds, 'u-<timestamp>' for signups
  handle TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'user',  -- 'seed' | 'user'
  created_at TEXT NOT NULL
);
CREATE TABLE posts (
  id TEXT PRIMARY KEY,            -- seeds keep their existing ids "L01".."L49","W01".."W06"; new: "U-<timestamp>"
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,             -- 'sell' | 'want'
  card_code TEXT,                 -- cards.card_code; NULL for sealed/bulk/category rows
  card_name TEXT NOT NULL,
  printing TEXT, rarity TEXT, type TEXT,
  condition TEXT, language TEXT,  -- NULL = not stated
  qty INTEGER NOT NULL DEFAULT 1,
  price_sgd REAL,                 -- sell only: ASKING price
  budget_sgd REAL,                -- want only
  grade TEXT,
  pickup TEXT,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'fulfilled' | 'cancelled'
  source TEXT NOT NULL DEFAULT 'user',  -- 'seed' | 'user' | 'ai_proposed'
  created_at TEXT NOT NULL
);
CREATE TABLE cards (
  card_code TEXT PRIMARY KEY,
  name TEXT, full_name TEXT, subtitle TEXT,
  set_code TEXT, card_set TEXT, card_number TEXT,
  rarity TEXT, domain TEXT, domains TEXT,   -- domains JSON array
  card_type TEXT, energy REAL, power REAL, might REAL,
  ability TEXT, image_url TEXT
);
CREATE TABLE card_variations (
  card_code TEXT NOT NULL REFERENCES cards(card_code),
  variation TEXT NOT NULL,        -- 'normal' | 'foiled' | 'showcase' | 'signature' | 'promo…'
  usd REAL,                       -- Bilgewater Market USD price for that variation (NULL = unpriced)
  is_foil INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (card_code, variation)
);
-- The listings "database":
CREATE VIEW listings_view AS
  SELECT p.*, u.handle AS seller FROM posts p JOIN users u ON u.id = p.user_id
  WHERE p.kind = 'sell' AND p.status = 'open';
CREATE INDEX idx_posts_card ON posts(card_code, kind, status);
CREATE INDEX idx_posts_kind ON posts(kind, status);
```
`is_foil` per variation: variation starts with `foiled` → foil; `signature` → foil (Signature Showcase printings are foil by construction). A card printing "has a foil variant" iff any row with is_foil=1 — this is what drives the shimmer and the jankrats-style price display.

### Seeding
- **users**: the 8 seeded seller handles (`kaiju_karen, zilean_dad, bojio_ben, gg_wp_gwen, teh_ping_gavin, choachu_kang, oniichan_ops, jurong_janna`) as `kind='seed'`.
- **posts**: every row of `SEED_LISTINGS` from `src/data/listings.ts` (unchanged file — it stays the seed source): `mode:'sale'` → `kind='sell'` (price_sgd = priceSgd), `mode:'wtb'` → `kind='want'` (budget_sgd). IDs preserved ("L01", "W01", …) so existing links work. seller = rotating seeded user.
- **cards**: from `src/data/cards.json` (1,188 printings).
- **card_variations**: from `src/data/variations.json` (per-code array of `{variation, usd}` — produced by scripts/fetch-prices.ts from the same Bilgewater feed). If the file is missing/empty at seed time, fall back to `src/data/prices.json` as a single `normal` variation row per code, and derive foil from `src/data/foil.json`.

## Server data layer (pinned contract)
`src/lib/marketplace.ts` becomes **server-only** (top `import "server-only"`), backed by db.ts. Signatures (same names as today so UI churn is minimal, but async):
```ts
getAllListings(): Promise<Listing[]>                      // from listings_view, seeds+user, newest-user-first
getListings(mode: "sale" | "wtb"): Promise<Listing[]>
getWtbPosts(): Promise<Listing[]>                          // want posts (open), seeds first then newest
getListingById(id: string): Promise<Listing | null>
addSellListing(input): Promise<Listing>                    // inserts kind='sell' post for current user
addWtbPost(input): Promise<Listing>                        // inserts kind='want' post
bestListingFor(cardCode: string | null, budgetSgd?: number): Promise<Listing | null>
createWantPosts(inputs: WantPostInput[]): Promise<Listing[]>  // batch (deck import validation)
```
`Listing` (client-facing shape) stays exactly as today: `{ id, cardName, cardCode, set:"OGN", printing, rarity, type, condition, language, qty, priceSgd, grade, seller, pickup, note, mode:"sale"|"wtb", source, budgetSgd? }`. `mode` is derived (kind sell→sale, want→wtb); `seller` = users.handle; `source` passes through (`ai_proposed` surfaces honestly in the UI).

Users (`src/lib/users.ts`, server-only):
```ts
getCurrentUser(): Promise<{ id, handle, kind } | null>      // reads cookie vds_user
signUpOrSwitch(handle: string): Promise<user>               // creates user if new, sets cookie
listUsers(): Promise<users[]>                               // for the switcher
```

## HTTP API (pinned)
All routes `export const runtime = "nodejs"`.
- `GET /api/listings?mode=sale|wtb` → `{ listings: Listing[] }`
- `POST /api/posts` body `{ kind:"sell"|"want", cardCode, cardName, printing?, rarity?, type?, condition?, language?, qty, priceSgd?, budgetSgd?, grade?, pickup?, note, source?: "user"|"ai_proposed" }` → `{ listing: Listing }` (requires a current user → 401 `{error:"NO_USER"}` if none)
- `GET /api/users/me` → `{ user | null }`; `POST /api/users/me` `{ handle }` → `{ user }` (sets cookie); `GET /api/users` → `{ users }` (switcher)
- `GET /api/cards?q=&set=&rarity=&domain=&cardType=` → `{ cards: Card[] }` (server-side search over cards table, cap 200)
- `GET /api/deck-import` — unchanged shape PLUS new `proposals` (see below)

## UI patterns (pinned)
- Server components read through `marketplace.ts` directly (await); client mutations POST to the API then `router.refresh()`.
- `app/page.tsx`: server component; awaits listings + current user, passes to client tabs as props.
- `app/listing/[id]/page.tsx`: server component; `getListingById` → not-found state; client island only for cart/ask buttons.
- Cart stays client-side (`vds_cart` localStorage), validated against the listings passed down.
- Current user: SiteHeader shows handle + switcher Dialog (pick existing or create new). Creating a post without a user → open the dialog first (honest copy: "local demo accounts — one click, no password").
- card-picker: search now queries `GET /api/cards` (debounced 200ms) instead of importing cards.json.
- jankrats-style price display: wherever reference prices show (sell prefill, listing detail), render **per-variation** prices like jankrats: each variation on its own line — `Foil — US$3.71 ≈ S$5.01 · Bilgewater Market, 2026-09-20`, linking out to `https://bilgewatermarket.com/cards/<ID>?print_variation=<variation>`. Variation label capitalized; `signature` shows as "Signature (foil)". Source of truth: `card_variations`.

## Deck import → availability → AI-proposed wants (pinned)
1. `POST /api/deck-import {url|text}` → deck lines; per line `bestListing` (cheapest open sell listing) as today.
2. NEW `proposals: { cardCode, cardName, qty, budgetSgd, note, inDb }[]` — one per no-stock line (dedup by cardCode, qty summed). `budgetSgd` = reference price (cheapest `normal` variation usd × 1.35, round 2dp; ×qty). `note`: when the gateway is configured, one `chatJSON` call drafts short want notes for all gaps in one shot; fallback note = `Auto-proposed from deck import: <deck name>`. **Deterministic availability check; AI only drafts notes.**
3. `DeckImportSheet` renders the proposals as a validation step: editable budget + note per row, checkbox per row (default checked), honest header "The assistant proposed these Looking-for posts — nothing is created until you confirm." Button "Create N want posts" → `POST /api/posts` per row with `source:"ai_proposed"` → toast + link to the Looking-for board. Unchecked rows are dropped.

## File ownership for this wave
- **DBCore**: src/lib/db.ts, src/lib/users.ts, src/lib/marketplace.ts (rewrite), app/api/listings/, app/api/posts/, app/api/users/(me/)route.ts, app/api/cards/route.ts, scripts/seed-db.ts, package.json (only `db:seed` script + `data/` in .gitignore).
- **VariationsData**: scripts/fetch-prices.ts, src/data/variations.json.
- **DeckAI**: src/lib/deckimport.ts, app/api/deck-import/route.ts, src/components/deck-import-sheet.tsx.
- **UIAsync**: src/components/{site-header, cart-sheet, listing-card, buy-tab, facet-bar, search-bar, card-picker, sell-panel, wtb-board, bundle-sheet}.tsx, app/page.tsx, app/listing/[id]/page.tsx, app/notes/page.tsx, README.md.
- Parent owns: integration, app/layout.tsx, verification, commits.