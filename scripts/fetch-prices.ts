// Fetches USD reference prices for Riftbound cards (EN printings) from
// bilgewatermarket.com and writes src/data/prices.json.
//
// Discovered URL structure:
//   - bilgewatermarket.com is a Vite SPA; its public REST API lives at
//     https://api.bilgewatermarket.com (OpenAPI at /openapi.json).
//   - GET /api/public/cards?page=N&page_size=50 (page_size <= 50) returns
//     paginated rows: { card_id: "VEN-001/166", print_variation: "normal" |
//     "foiled" | "showcase" | "signature" | "promo[...]", en_card: {...},
//     markets: { us: { price, currency: "USD", provider: "TCGplayer" }, ... } }.
//   - card_id maps 1:1 to our cardCode (lowercase, "/" -> "-"), so no fuzzy
//     name matching is needed. Prices are USD (TCGplayer via bilgewater).
//   - The API is public but rate-limited: polite delay + 429 backoff required.
//
// Fallback (if bilgewater blocks or is unreachable):
//   https://riftboundcardlist.com/prices and per-set pages
//   /sets/{origins,origins-proving-grounds,spiritforged,unleashed,vendetta} are
//   server-rendered tables with per-printing TCGplayer market prices keyed by
//   card image URL .../images/cards/<cardCode>.avif.
//
// If a source cannot deliver, prices is written empty — never fabricated.
//
// Usage: npx tsx scripts/fetch-prices.ts

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

const OUT = path.resolve(__dirname, "../src/data/prices.json");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const PER_PAGE_TIMEOUT_MS = 20_000;
const PAGE_DELAY_MS = 300;
const MAX_BILGEWATER_PAGES = 200;

import cardsJson from "../src/data/cards.json";

const asOf = () => new Date().toISOString().slice(0, 10);

// bilgewater print_variation preference: base EN printing first, then foil,
// showcase, signature, promo variants. Lower rank wins; ties prefer cheaper.
const VARIATION_RANK: Record<string, number> = {
  normal: 0,
  foiled: 1,
  showcase: 2,
  signature: 3,
  promo: 4,
};

function variationRank(v: string | null | undefined): number {
  const s = (v ?? "").toLowerCase();
  for (const [prefix, rank] of Object.entries(VARIATION_RANK)) {
    if (s.startsWith(prefix)) return rank;
  }
  return VARIATION_RANK.promo;
}

// "VEN-189*/166" -> "ven-189-star-166" (star suffix normalized like cards.json);
// "OGN-299/298" -> "ogn-299-298".
const cardIdToCode = (cardId: string): string =>
  cardId.toLowerCase().replace("*", "-star").replace("/", "-");

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

type BilgewaterRow = {
  card_id: string;
  print_variation?: string | null;
  en_card?: { language?: string } | null;
  markets?: { us?: { price?: number | null } | null } | null;
};

/** Primary source: bilgewatermarket.com public API, crawled via Playwright. */
async function fetchBilgewater(
  context: BrowserContext
): Promise<Record<string, { usd: number }>> {
  const request = context.request;
  const seen = new Set<string>(); // duplicate page rows
  const ranked: Record<string, { rank: number; usd: number }> = {};
  let pageNo = 1;

  while (pageNo <= MAX_BILGEWATER_PAGES) {
    const url = `https://api.bilgewatermarket.com/api/public/cards?page=${pageNo}&page_size=50`;
    let json: { items?: BilgewaterRow[]; hasMore?: boolean } | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await request.get(url, {
        headers: { "User-Agent": UA },
        timeout: PER_PAGE_TIMEOUT_MS,
      });
      if (res.status() === 429) {
        console.warn(`[fetch-prices] 429 on ${url}, backing off 30s`);
        await delay(30_000);
        continue;
      }
      if (!res.ok()) throw new Error(`API ${res.status()} on ${url}`);
      json = (await res.json()) as { items?: BilgewaterRow[]; hasMore?: boolean };
      break;
    }
    if (!json) throw new Error(`rate-limited out on ${url}`);

    const items = json.items ?? [];
    for (const it of items) {
      const key = `${it.card_id}|${it.print_variation ?? ""}`;
      if (!it.card_id || seen.has(key)) continue;
      seen.add(key);
      if (!it.en_card) continue; // CN-only row; we want EN printings
      const usd = it.markets?.us?.price;
      if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) continue;
      const code = cardIdToCode(it.card_id);
      const rank = variationRank(it.print_variation);
      const cur = ranked[code];
      if (!cur || rank < cur.rank || (rank === cur.rank && usd < cur.usd)) {
        ranked[code] = { rank, usd: Math.round(usd * 100) / 100 };
      }
    }

    const more = json.hasMore === true && items.length > 0;
    console.log(
      `[fetch-prices] bilgewater page ${pageNo}: +${items.length} rows (total unique codes: ${Object.keys(ranked).length})`
    );
    if (!more) break;
    pageNo++;
    await delay(PAGE_DELAY_MS);
  }

  const out: Record<string, { usd: number }> = {};
  for (const [code, { usd }] of Object.entries(ranked)) out[code] = { usd };
  return out;
}

/** Fallback source: riftboundcardlist.com server-rendered set tables. */
async function fetchRbcl(context: BrowserContext): Promise<Record<string, { usd: number }>> {
  const page: Page = await context.newPage();
  page.setDefaultTimeout(PER_PAGE_TIMEOUT_MS);
  const SETS = [
    "origins",
    "origins-proving-grounds",
    "spiritforged",
    "unleashed",
    "vendetta",
  ];
  const rows: Record<string, { usd: number; foil: boolean }> = {};
  const failed: string[] = [];

  for (const set of SETS) {
    const url = `https://riftboundcardlist.com/sets/${set}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const extracted = (await page.evaluate(() => {
        const out: { code: string; usd: number; foil: boolean }[] = [];
        for (const tr of Array.from(document.querySelectorAll("tr"))) {
          const img = tr.querySelector<HTMLImageElement>(
            'img[src*="/images/cards/"]'
          );
          if (!img) continue;
          const m = img.src.match(/\/images\/cards\/([a-z0-9-]+)\.avif/);
          if (!m) continue;
          const cell = tr.querySelector<HTMLTableCellElement>(
            "td.sticky-col-right"
          );
          if (!cell) continue;
          const pm = cell.textContent?.match(/\$([0-9,]+\.[0-9]{2})/);
          if (!pm) continue;
          out.push({
            code: m[1],
            usd: Number.parseFloat(pm[1].replace(/,/g, "")),
            foil: tr.innerHTML.includes("(foil)"),
          });
        }
        return out;
      })) as { code: string; usd: number; foil: boolean }[];
      for (const { code, usd, foil } of extracted) {
        const cur = rows[code];
        // prefer non-foil base printing; else cheaper
        if (!cur || (cur.foil && !foil) || (cur.foil === foil && usd < cur.usd)) {
          rows[code] = { usd, foil };
        }
      }
      console.log(`[fetch-prices] rbcl ${set}: ${extracted.length} priced rows`);
    } catch (err) {
      failed.push(`${url} (${String(err).slice(0, 120)})`);
    }
    await delay(PAGE_DELAY_MS);
  }
  await page.close();

  const out: Record<string, { usd: number }> = {};
  for (const [code, { usd }] of Object.entries(rows)) out[code] = { usd };
  if (failed.length > 0) console.warn(`[fetch-prices] rbcl failures: ${failed.join("; ")}`);
  return out;
}

/**
 * Secondary bilgewater pass: per-card detail pages for cardCodes the feed did
 * not cover (e.g. showcase signatures like OGN-299*, promo tokens like
 * UNL-T04). Page pattern: https://bilgewatermarket.com/cards/<ID>
 * ?print_variation=<variant>, where ID is "<SET>-<NUM>*" for codes shaped
 * "set-num-star-total" and "<SET>-<NUM>" otherwise. Known limitation: the SPA
 * gates card-detail fetches behind Firebase App Check, which returns 403 for
 * headless clients — the page then renders "Card not found." and yields no
 * price. Implemented anyway so the pass works wherever App Check succeeds.
 */
async function fetchBilgewaterCardPages(
  context: BrowserContext,
  missingCodes: string[],
  pageBudget: number
): Promise<{ prices: Record<string, { usd: number }>; failures: string[] }> {
  const page: Page = await context.newPage();
  page.setDefaultTimeout(PER_PAGE_TIMEOUT_MS);
  const prices: Record<string, { usd: number }> = {};
  const failures: string[] = [];
  const VARIANTS = ["signature", "showcase", "normal", "foiled", "promo", ""];
  let attempts = 0;

  const idCandidates = (code: string): string[] => {
    const [set, ...rest] = code.split("-");
    const tail = rest.join("-");
    if (tail.includes("-star-")) {
      return [`${set}-${tail.split("-")[0]}*`.toUpperCase()];
    }
    return [`${set}-${tail}`.toUpperCase()];
  };

  for (const code of missingCodes) {
    let reason = "all ID/variant candidates exhausted";
    outer: for (const id of idCandidates(code)) {
      for (const variant of VARIANTS) {
        if (attempts >= pageBudget) {
          reason = "page budget exhausted";
          break outer;
        }
        const url = `https://bilgewatermarket.com/cards/${encodeURIComponent(id)}${
          variant ? `?print_variation=${variant}` : ""
        }`;
        attempts++;
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.waitForSelector('text=/Card not found|\\$[0-9]/i', {
            timeout: PER_PAGE_TIMEOUT_MS,
          });
          const text = await page.evaluate(() => document.body.innerText);
          if (/card not found/i.test(text)) {
            reason = `page renders "Card not found" (Firebase App Check unavailable in headless; detail API gated)`;
            break outer; // no point trying other variants for this ID
          }
          const pm = text.match(/US?\$\s?([0-9,]+\.[0-9]{2})/);
          if (pm) {
            prices[code] = {
              usd: Math.round(Number.parseFloat(pm[1].replace(/,/g, "")) * 100) / 100,
            };
            reason = "";
            break outer;
          }
          reason = "page rendered but no USD price found in DOM";
          break outer;
        } catch (err) {
          reason = `navigation/DOM error: ${String(err).slice(0, 120)}`;
        }
        await delay(PAGE_DELAY_MS);
      }
    }
    if (!prices[code]) failures.push(`${code}: ${reason}`);
  }
  await page.close();
  return { prices, failures };
}

async function main(): Promise<void> {
  let source: "bilgewater-market" | "tcgplayer-mirror";
  let prices: Record<string, { usd: number }> = {};
  const failures: string[] = [];

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: UA });
    try {
      prices = await fetchBilgewater(context);
    } catch (err) {
      failures.push(`bilgewatermarket API: ${String(err).slice(0, 200)}`);
      prices = {};
    }
    if (Object.keys(prices).length >= 100) {
      source = "bilgewater-market";
      // Second bilgewater pass: per-card pages for codes the feed skipped.
      const knownCodes: string[] = cardsJson.map((c) => c.cardCode);
      const missing = knownCodes.filter((c) => !prices[c]);
      const remainingBudget = MAX_BILGEWATER_PAGES - Math.floor(Object.keys(prices).length / 50);
      if (missing.length > 0 && remainingBudget > 0) {
        console.log(`[fetch-prices] ${missing.length} codes missing from feed; trying per-card pages`);
        const { prices: extra, failures: cardFailures } = await fetchBilgewaterCardPages(
          context,
          missing,
          remainingBudget
        );
        Object.assign(prices, extra);
        failures.push(...cardFailures);
      }
    } else {
      if (Object.keys(prices).length > 0) {
        failures.push("bilgewatermarket API delivered < 100 codes; falling back");
      }
      prices = await fetchRbcl(context);
      source = "tcgplayer-mirror";
    }
    await context.close();
  } finally {
    await browser.close();
  }

  const payload = {
    meta: {
      source,
      asOf: asOf(),
    },
    prices,
  };
  await writeFile(OUT, JSON.stringify(payload), "utf8");

  const codes = Object.keys(prices);
  console.log(`\n[fetch-prices] source: ${payload.meta.source}`);
  console.log(`[fetch-prices] asOf: ${payload.meta.asOf}`);
  console.log(`[fetch-prices] priced cardCodes: ${codes.length}`);
  console.log(
    `[fetch-prices] samples: ${JSON.stringify(
      Object.fromEntries(codes.slice(0, 5).map((c) => [c, prices[c]]))
    )}`
  );
  if (failures.length > 0) {
    console.log(`[fetch-prices] failed sources/URLs:\n  ${failures.join("\n  ")}`);
  }
  if (codes.length === 0) {
    console.warn("[fetch-prices] WARNING: no prices obtained; wrote empty map");
  }
}

main().catch((err) => {
  console.error("[fetch-prices] FAILED:", err);
  process.exitCode = 1;
});
