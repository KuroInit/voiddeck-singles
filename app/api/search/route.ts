import { aiConfigured, chatJSON } from "@/lib/ai";
import { fallbackIntent, sanitizeIntent } from "@/lib/search";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You parse search queries for a Riftbound TCG singles marketplace (Singapore, prices in SGD). " +
  'Return ONLY a JSON object: {"keywords": string[], "set"?: string[], "printing"?: string[], ' +
  '"rarity"?: string[], "language"?: string[], "condition"?: string[], "type"?: string[], ' +
  '"maxPrice"?: number, "minPrice"?: number, "sort"?: "relevance"|"price_asc"|"price_desc"}. ' +
  'keywords: 1-8 phrases matched against card name, printing, rarity, type, set, or the seller note ' +
  '(split the query into meaningful phrases, e.g. "jinx alt art" -> ["jinx", "alt art"]; keep ' +
  'multi-word phrases like "removal spell" intact). Allowed values: set = OGN|OGS|SFD|UNL|VEN ' +
  '(Origins, Proving Grounds, Spiritforged, Unleashed, Vendetta); printing = standard|alt_art|signature; ' +
  "rarity = common|uncommon|rare|epic|showcase; language = en|zh; condition = nm|lp|mp|psa9; " +
  "type = legend|unit|spell|rune|battlefield|gear|token|sealed|bulk. " +
  "Prices are SGD numbers parsed from phrases like \"under $5\" (maxPrice) or \"above $2\" (minPrice). " +
  'sort "price_asc"/"price_desc" only when the query asks for cheapest/most expensive. ' +
  "Omit fields the query does not express. Use ONLY these allowed values — never invent others.";

export async function POST(req: Request) {
  let body: { q?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "MISSING_Q" }, { status: 400 });
  }
  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (!q) {
    return Response.json({ error: "MISSING_Q" }, { status: 400 });
  }

  // Unconfigured gateway, timeouts, bad JSON, malformed shapes — every failure
  // degrades to the deterministic parse, so search never hard-fails on the AI.
  if (!aiConfigured()) {
    return Response.json({ intent: fallbackIntent(q), source: "local" });
  }
  try {
    const raw = await chatJSON(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: q },
      ],
      300,
      8_000
    );
    return Response.json({ intent: sanitizeIntent(raw, q), source: "ai" });
  } catch {
    return Response.json({ intent: fallbackIntent(q), source: "local" });
  }
}
