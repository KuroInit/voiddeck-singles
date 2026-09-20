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
| **Buy** | Mobile-first grid of seeded + your own listings, facet filters, price sort, listing detail with a reference price line, simulated cart + demo checkout. |
| **Sell** | Pick a card from the **full Riftbound card database** (1,188 printings across Origins / Proving Grounds / Spiritforged / Unleashed / Vendetta) so every listing maps to a valid card, then set condition, qty, pickup and your asking price (prefilled from the price snapshot). |
| **Looking for** | WTB board with a budget per want; each want is auto-matched against active sale listings (`cheapest listing ≤ budget`), or honestly reported as "No matches yet". |
| **Search** | A plain, deterministic search over the listings — token scoring plus local price parsing ("removal under $1"). Not AI-powered; works with the gateway disabled. |
| **Shop Q&A** | Catalogue-grounded assistant that cites listing ids (`[L07]`) and says plainly what the listings do *not* establish (authenticity, market value, print run). |
| **Deck-core builder** | "build me a Noxus aggro core under $30" → a composed cart from available singles, repriced server-side, with honest gaps. |
| **Deck import** | Paste a `riftdecks.com` deck link → the decklist is parsed, every card mapped to the card DB, and stock availability shown per line ("buy what's in stock"). |

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (**radix-nova**) · `motion`
(vanilla JS core API, no React bindings) · plain `fetch` to an OpenAI-compatible chat
endpoint (no SDK).

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

With these unset the AI surfaces (shop Q&A, deck-core builder) render an honest
"AI unavailable — server env not set" state and `/api/ask`, `/api/bundle` return
`503 AI_NOT_CONFIGURED`. No fabricated answers are ever produced. Search is
deterministic and always works.

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

Dark-first shadcn zinc palette with an amber-400 accent. One rarity colour language
(`src/lib/rarity.ts`) shared by listing chips, `CardFrame` gradients and import rows:
common zinc · uncommon sky · rare violet · epic fuchsia · showcase amber; Signature
listings get an amber tint. Motion helpers live in `src/lib/motion.ts` (`revealStagger`,
`tabSwap`, `bump`, `pressable`) — durations ≤250 ms, decorative only, and every helper
no-ops under `prefers-reduced-motion`.

## Data sources & licences

- **Card database** — `riftbound-cards` fan project (code MIT; card data © Riot Games).
  Card art is **hot-linked** from Riot's CDN and never committed; `CardFrame` is the local
  SVG fallback for missing art.
- **Reference prices** — dated snapshot of Bilgewater Market (or the labelled TCGplayer
  mirror fallback). USD → SGD uses a fixed demo rate of `1.35`, displayed with `≈`.
- All sellers, notes, stock and prices are fictional demo data.

## Scope / known limitations

- Local-only by request: no hosting, no CI, no accounts. User-created listings and wants
  live in `localStorage` (`vds_user_listings`, `vds_user_wtb`, `vds_cart`) and are labelled
  "demo — stored in your browser".
- No real payments (the checkout modal says so), no auth, no live price refresh in the
  running app, no embeddings.
- Seeded listings cover an **Origins (OGN)** subset only; the card database behind the
  pickers and deck import spans all sets.