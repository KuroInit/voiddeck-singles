/**
 * Server-only deck import: fetch a riftdecks.com decklist page or parse a
 * pasted decklist, map cards to the catalogue and the cheapest listings.
 * SSRF-safe: URLs are validated against a fixed-host regex before fetching.
 */
import { CARDS, findCard, type Card } from "@/data/cards";
import { bestListingFor } from "@/lib/marketplace";
import { USD_SGD, getPriceFor } from "@/lib/prices";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const DECK_URL_RE = /^https:\/\/riftdecks\.com\/riftbound-metagame\/deck-[a-z0-9-]+$/;

export type ImportedLine = {
  cardCode: string;
  name: string;
  qty: number;
  inDb: boolean;
  bestListing: { id: string; priceSgd: number } | null;
};

export type ImportedDeck = { name: string; lines: ImportedLine[] };

export class DeckImportError extends Error {
  constructor(
    public code: "INVALID_URL" | "DECK_FETCH_FAILED",
    message: string
  ) {
    super(message);
    this.name = "DeckImportError";
  }
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const NAME_INDEX: Map<string, Card> = (() => {
  const m = new Map<string, Card>();
  for (const c of CARDS) {
    m.set(c.name.toLowerCase(), c);
    m.set(c.fullName.toLowerCase(), c);
  }
  return m;
})();

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type RawEntry = { name: string; qty: number; cardCode?: string };

async function toLine(e: RawEntry): Promise<ImportedLine> {
  const card = e.cardCode
    ? findCard(e.cardCode.toLowerCase())
    : (NAME_INDEX.get(e.name.toLowerCase()) ?? null);
  const cardCode = e.cardCode?.toLowerCase() ?? (card ? card.cardCode : slugify(e.name));
  // bestListingFor is async under the db-backed marketplace.
  const best = card ? await bestListingFor(cardCode) : null;
  return {
    cardCode,
    name: e.name,
    qty: e.qty,
    inDb: Boolean(card),
    bestListing: best ? { id: best.id, priceSgd: best.priceSgd } : null,
  };
}

/**
 * Rows look like:
 * <tr class="card-list-item" data-card-type="legend" data-quantity="1"
 *     data-image-src="/img/cards/riftbound/OGN/ogn-257-298_full.png">
 *   ... <td><a href="/cards/...">Lee Sin, Blind Monk</a></td> ...
 */
function parseRows(html: string): RawEntry[] {
  const rows = html.match(/<tr class="card-list-item"[\s\S]*?<\/tr>/g) ?? [];
  const out: RawEntry[] = [];
  for (const row of rows) {
    const qtyAttr = row.match(/data-quantity="(\d+)"/);
    const imgAttr = row.match(/data-image-src="([^"]+)"/);
    if (!qtyAttr || !imgAttr) continue;
    // /img/cards/riftbound/<SET>/<code>_full.png → cardCode = <code>, lowercased
    const img = imgAttr[1].match(
      /^\/img\/cards\/riftbound\/[A-Za-z0-9]+\/([a-z0-9-]+)_full\.png$/
    );
    if (!img) continue;
    // Card name: the row's link text (symbol cells are bare <img>); fall back
    // to any informative <img alt> inside the row.
    const linkTexts = [...row.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)]
      .map((m) => stripTags(m[1]))
      .filter((t) => t.length > 1);
    const altTexts = [...row.matchAll(/<img[^>]*alt="([^"]+)"/g)]
      .map((m) => decodeEntities(m[1]).trim())
      .filter((t) => t.length > 1 && !/^(showcase|rarity|common|uncommon|rare|epic)$/i.test(t));
    const name = linkTexts[0] ?? altTexts[0];
    if (!name) continue;
    out.push({ name, qty: Number.parseInt(qtyAttr[1], 10) || 1, cardCode: img[1] });
  }
  return out;
}

function deckName(html: string, url: string): string {
  const t = html.match(/<title>([^<]*)<\/title>/);
  if (t) {
    const name = decodeEntities(t[1]).replace(/\s*\|\s*riftdecks\.com\s*/i, "").trim();
    if (name) return name.slice(0, 80);
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1 && stripTags(h1[1])) return stripTags(h1[1]).slice(0, 80);
  const slug = url.split("/").pop()?.replace(/^deck-/, "") ?? "deck";
  return slug.replace(/-/g, " ").replace(/\s+\d+$/, "").slice(0, 80);
}

/**
 * riftdecks.com sits behind a Cloudflare managed challenge that blocks Node's
 * TLS/HTTP fingerprint (plain fetch → 403 "Just a moment...") while allowing
 * curl. Try native fetch first (redirects validated hop-by-hop), then fall
 * back to curl — also hop-by-hop, execFile argv (no shell), 16 MB maxBuffer.
 * Either path returns the raw HTML or throws.
 */
async function curlFetch(url: string): Promise<string> {
  const run = promisify(execFile);
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    const { stdout } = await run(
      "curl",
      [
        "-sS", "--max-redirs", "0", "--max-time", "20",
        "-A", UA, "-H", "accept: text/html",
        "-w", "\n%{http_code}\t%{redirect_url}",
        current,
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: 25_000 }
    );
    const nl = stdout.lastIndexOf("\n");
    const body = nl === -1 ? stdout : stdout.slice(0, nl);
    const [code, redirectUrl] = (nl === -1 ? "" : stdout.slice(nl + 1)).split("\t");
    if (code >= "300" && code < "400") {
      if (!redirectUrl) throw new Error("redirect without location");
      current = new URL(redirectUrl.trim(), current).toString();
      if (!DECK_URL_RE.test(current)) {
        throw new Error(`redirect left the pinned host: ${current}`);
      }
      continue;
    }
    if (code.startsWith("2")) return body;
    throw new Error(`curl failed: ${code}`);
  }
  throw new Error("too many redirects");
}
/** Read at most `max` bytes of the body; oversized responses are rejected
 *  instead of ballooning memory before the 15s timeout. */
async function boundedText(res: Response, max = 5 * 1024 * 1024): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > max) {
    throw new Error(`response too large: ${declared}`);
  }
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void reader.cancel();
      throw new Error(`response too large: >${max}`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchPageHtml(url: string): Promise<string> {
  // redirect:"manual" + per-hop DECK_URL_RE re-validation: the pinned host must
  // hold across the whole redirect chain, not just hop 1.
  let current = url;
  try {
    for (let hop = 0; hop < 3; hop++) {
      const res = await fetch(current, {
        headers: { "User-Agent": UA, accept: "text/html" },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("redirect without location");
        current = new URL(location, current).toString();
        if (!DECK_URL_RE.test(current)) {
          throw new Error(`redirect left the pinned host: ${current}`);
        }
        continue;
      }
      if (res.ok) return await boundedText(res);
      throw new Error(`fetch failed: ${res.status}`);
    }
    throw new Error("too many redirects");
  } catch {
    // fall through to curl (Cloudflare-managed challenge blocks Node fetch)
  }
  return curlFetch(url);
}

export async function fetchDeck(url: string): Promise<ImportedDeck> {
  if (!DECK_URL_RE.test(url)) {
    throw new DeckImportError("INVALID_URL", `Not a riftdecks deck URL: ${url}`);
  }

  let html: string;
  try {
    html = await fetchPageHtml(url);
  } catch (e) {
    throw new DeckImportError("DECK_FETCH_FAILED", `Could not fetch deck page: ${String(e)}`);
  }

  const entries = parseRows(html);
  if (entries.length === 0) {
    throw new DeckImportError("DECK_FETCH_FAILED", "No card rows parsed from deck page");
  }

  return {
    name: deckName(html, url),
    lines: await Promise.all(entries.map(toLine)),
  };
}

/**
 * Fallback parser for pasted decklist text. One card per line:
 * `4 Name`, `4x Name`, `Name x4`, or bare `Name` (qty 1).
 */
export async function parseDeckText(text: string): Promise<ImportedDeck> {
  const entries: RawEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^#/.test(line)) continue;
    const leading = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (leading) {
      entries.push({ name: leading[2].trim(), qty: Number.parseInt(leading[1], 10) || 1 });
      continue;
    }
    const trailing = line.match(/^(.+?)\s+[xX](\d+)$/);
    if (trailing) {
      entries.push({ name: trailing[1].trim(), qty: Number.parseInt(trailing[2], 10) || 1 });
      continue;
    }
    entries.push({ name: line, qty: 1 });
  }

  return {
    name: "Imported decklist",
    lines: await Promise.all(entries.map(toLine)),
  };
}

export type DeckProposal = {
  cardCode: string;
  cardName: string;
  qty: number;
  budgetSgd: number;
  note: string;
  inDb: boolean;
};

const MAX_PROPOSED_QTY = 4;

/**
 * Deterministic want-post proposals for deck lines with no stock.
 *
 * Pure and unit-testable: no AI, no I/O. Only in-catalogue lines are proposed
 * (not-in-catalogue lines stay reported in `lines` as today); lines are grouped
 * by cardCode with qty summed (capped at MAX_PROPOSED_QTY) and the first name
 * kept. budgetSgd is the reference price (usd x 1.35) x qty, or a 1.00/card
 * placeholder when the card is unpriced so the field stays editable. The note
 * is a deterministic template — the route enriches it via the AI gateway.
 */
export function buildProposals(
  lines: ImportedLine[],
  deckName: string
): DeckProposal[] {
  const byCode = new Map<string, { cardName: string; qty: number }>();
  for (const line of lines) {
    if (line.bestListing !== null || !line.inDb) continue;
    const existing = byCode.get(line.cardCode);
    if (existing) existing.qty += line.qty;
    else byCode.set(line.cardCode, { cardName: line.name, qty: line.qty });
  }

  const proposals: DeckProposal[] = [];
  for (const [cardCode, { cardName, qty }] of byCode) {
    const cappedQty = Math.min(qty, MAX_PROPOSED_QTY);
    const usd = getPriceFor(cardCode)?.usd ?? 0;
    const perCard = usd > 0 ? usd * USD_SGD : 1;
    proposals.push({
      cardCode,
      cardName,
      qty: cappedQty,
      budgetSgd: Math.round(perCard * cappedQty * 100) / 100,
      note: `Auto-proposed from deck import: ${deckName}`,
      inDb: true,
    });
  }
  return proposals;
}
