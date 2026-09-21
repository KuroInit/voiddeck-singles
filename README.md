# Voiddeck Singles

**The void-deck card market for Riftbound — a local-only demo.**

An AI-enabled second-hand marketplace for **Riftbound TCG singles** aimed at Singapore
buyers and sellers: people chasing rare Showcase / Signature printings, and players buying
multiple singles to build decks.

> Everything in here is a **demo**. Sellers, stock and prices are fictional, checkout is
> simulated, and there is no authentication. Unofficial fan demo — not affiliated with
> Riot Games.

## What it does

| Surface | Behaviour |
| --- | --- |
| **Buy** | Mobile-first grid of seeded + your own listings, facet filters, price sort, listing detail with a Market Cost reference panel, simulated cart + demo checkout. |
| **Sell** | Pick a card from the **full Riftbound card database** (1,188 printings across Origins / Proving Grounds / Spiritforged / Unleashed / Vendetta) so every listing maps to a valid card, then set condition, qty, pickup and your asking price (prefilled from the price snapshot). |
| **Looking for** | WTB board with a budget per want; each want is auto-matched against active sale listings (`cheapest listing ≤ budget`), or honestly reported as "No matches yet". |
| **Search** | Natural-language search over the listings and the want board ("foil showcase legends under $30", "jinx alt art"). The query is parsed server-side by the model (`POST /api/search`) into structured intent — keywords, set/printing/rarity/language/condition/type facets, price bounds, sort order — then scored against the catalogue by a deterministic scorer. With the gateway off (or on any parse failure) the same query falls back to local token/price parsing, so search always works; the UI shows which parser ran. |
| **Shop Q&A** | Catalogue-grounded assistant that cites listing ids (`[L07]`) and says plainly what the listings do *not* establish (authenticity, market value, print run). |
| **Deck-core builder** | "build me a Noxus aggro core under $30" → a composed cart from available singles, repriced server-side, with honest gaps. |
| **Deck import** | Paste a `riftdecks.com` deck link → the decklist is parsed, every card mapped to the card DB, and stock availability shown per line ("buy what's in stock"). Out-of-stock lines become assistant-proposed Looking-for posts — editable, and created only after you confirm. |

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (**radix-nova**) · `motion`
(vanilla JS core API, no React bindings) · plain `fetch` to an OpenAI-compatible chat
endpoint (no SDK) · **embedded SQLite** via `node:sqlite` (Node 24's built-in
`DatabaseSync` — no native addon, no external service).

## Data layer

All persistent state lives in a local database file, `data/vds.db` (gitignored), across
four stores: **cards** (every Riftbound printing + per-variation Bilgewater prices),
**listings** (a SQL view over open sell posts), **users** (seeded fictional sellers +
handle-only local demo accounts), and **posts** (sell posts create listings; want posts
feed the Looking-for board). Reads happen in server components through
`src/lib/marketplace.ts` (server-only); client mutations POST to the API routes and call
`router.refresh()`. Re/seed with:

```bash
npm run db:seed
```

The database also bootstraps itself lazily on first request (`ensureSeeded()`), so a
fresh clone works without the explicit step. The one piece of state that stays in the
browser is the **cart** (`vds_cart` in `localStorage`), validated against the live
listings whenever the cart sheet opens.

Deck import proposes Looking-for posts for cards that are out of stock — the proposals
are shown as an explicit validation step and **nothing is created until you confirm**.

## Run it locally

```bash
npm install
cp .env.example .env      # then fill in your gateway values
npm run dev               # http://localhost:3000
```

### Environment

Server-only, read from `.env` (never exposed to the browser bundle):

```
AI_BASE_URL=   # OpenAI-compatible base URL, e.g. https://gateway.example/v1
AI_API_KEY=    # bearer token
AI_MODEL=      # chat model id
```

With these unset the AI surfaces (search parsing, shop Q&A, deck-core builder)
degrade honestly: search falls back to local deterministic parsing, Q&A and the
builder render an "AI unavailable" state, and `/api/ask`, `/api/bundle` return
`503 AI_NOT_CONFIGURED`. No fabricated answers are ever produced.

## Data pipeline

```bash
npm run refresh-data
```

- `scripts/fetch-cards.ts` — downloads the latest `cards.json` release asset from
  [`LouisCourrian/riftbound-cards`](https://github.com/LouisCourrian/riftbound-cards) and
  trims it into `src/data/cards.json`.
- `scripts/fetch-prices.ts` — **local-only** Playwright walk of the public
  Bilgewater Market card pages, writing a dated snapshot into `src/data/prices.json`
  (`meta.source` + `meta.asOf`). Falls back to the server-rendered TCGplayer mirror
  (`riftboundcardlist.com/prices`, recorded as `source: "tcgplayer-mirror"`). No price
  is ever invented: an empty snapshot renders as "no reference price available".

Playwright never runs as part of the app — prices are a committed build-time snapshot.

## Design system

**"Hextech heartland"** — League-of-Legends gold and navy (`#C8AA6E` / `#F0E6D2` on
`#010A13`–`#0A1428`, magic-cyan `#0AC8B9` ring) over a faint HDB void-deck tile-wall
texture. Display type is Cinzel (uppercase, tracked); UI text is Geist. Shared surface
utilities live in `app/globals.css`: `.hextech-frame` (gold gradient border),
`.chamfer` (LoL-style cut corners), `.btn-hextech` (gold gradient CTA),
`.rune-divider` (gold hairline + diamond). One rarity colour language
(`src/lib/rarity.ts`) is shared by listing chips, `CardFrame` gradients and import
rows: common zinc · uncommon sky · rare violet · epic fuchsia · showcase amber;
Signature listings get a warm gold wash. Motion helpers live in `src/lib/motion.ts`
(`revealStagger`, `tabSwap`, `bump`, `pressable`) — durations ≤250 ms, decorative
only, and every helper no-ops under `prefers-reduced-motion`.

## Data sources & licences

- **Card database** — `riftbound-cards` fan project (code MIT; card data © Riot Games).
  Card art is **hot-linked** from Riot's CDN and never committed; `CardFrame` is the local
  SVG fallback for missing art.
- **Reference prices** — dated snapshot of Bilgewater Market (or the labelled TCGplayer
  mirror fallback). USD → SGD uses a fixed demo rate of `1.35`, displayed with `≈`.
- All sellers, notes, stock and prices are fictional demo data.

## Scope / known limitations

- Local-only by request: no hosting, no CI, no real auth. User-created listings, wants
  and posts live in the local database (`data/vds.db`) and are labelled "demo — stored
  in your local database"; sign-in is a one-click local demo handle (no passwords). The
  cart alone stays in `localStorage` (`vds_cart`) and is labelled "stored in your
  browser".
- No real payments (the checkout modal says so), no access control, no live price
  refresh in the running app, no embeddings, no price history (single dated snapshot
  per variation — the listing page shows Market Cost as of that date).
- Seeded listings span all five sets (Origins, Proving Grounds, Spiritforged,
  Unleashed, Vendetta); the card database behind the pickers and deck import spans
  the same sets.