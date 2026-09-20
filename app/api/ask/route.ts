import { aiConfigured, chatJSON } from "@/lib/ai";
import { parseIntent, fallbackIntent, scoreCatalogue } from "@/lib/search";
import { getAllListings } from "@/lib/marketplace";
import { getPriceFor, priceMeta, USD_SGD } from "@/lib/prices";

export const runtime = "nodejs";

type AskAnswer = {
  text: string;
  citations: { id: string; quote: string }[];
  unknowns: string[];
};

const SYSTEM_PROMPT =
  "You are the Voiddeck Singles shop assistant. Use ONLY the JSON listings provided below. " +
  "Cite listing ids inline like [L07]. Sellers' prices are asking prices, not market values. " +
  "Reference prices come from the provided price snapshot (source + date) and are reference only. " +
  "If the listings do not establish something (authenticity, market value, availability, print run, " +
  "future stock), say so plainly instead of guessing. Answer in at most 4 short sentences.";

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  let body: { q?: unknown; listingId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "MISSING_Q" }, { status: 400 });
  }
  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (!q) {
    return Response.json({ error: "MISSING_Q" }, { status: 400 });
  }
  const listingId = typeof body.listingId === "string" ? body.listingId : undefined;

  const catalogue = getAllListings().filter((l) => l.mode === "sale");

  // Retrieval must work even when intent parsing fails.
  let retrieval;
  try {
    retrieval = scoreCatalogue(catalogue, await parseIntent(q)).slice(0, 12);
  } catch {
    retrieval = scoreCatalogue(catalogue, fallbackIntent(q)).slice(0, 12);
  }

  const byId = new Map(catalogue.map((l) => [l.id, l]));
  let retrieved = retrieval
    .map((r) => byId.get(r.id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  if (listingId) {
    const forced = byId.get(listingId);
    if (forced) {
      retrieved = [forced, ...retrieved.filter((l) => l.id !== listingId)].slice(0, 12);
    }
  }

  const meta = priceMeta();
  const priceRows = [
    ...new Set(retrieved.map((l) => l.cardCode).filter((c): c is string => Boolean(c))),
  ]
    .slice(0, 12)
    .map((cardCode) => {
      const p = getPriceFor(cardCode);
      if (!p) return { cardCode, price: null as string | null };
      return {
        cardCode,
        usd: p.usd,
        approxSgd: Math.round(p.usd * USD_SGD * 100) / 100,
        source: p.source,
        asOf: p.asOf,
      };
    });

  const prompt = [
    `Question: ${q}`,
    "",
    "Listings JSON:",
    JSON.stringify(retrieved),
    "",
    `Price snapshot (source: ${meta.source}, asOf: ${meta.asOf}); null price means no reference price available:`,
    JSON.stringify(priceRows),
    "",
    'Return JSON: {"text": string, "citations": [{"id": string, "quote": string}], "unknowns": string[]}. ' +
      "citations quote the exact listing snippet backing the claim; unknowns list things the listings cannot establish.",
  ].join("\n");

  let answer: AskAnswer;
  try {
    const raw = await chatJSON(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      700
    );
    const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const text = typeof obj.text === "string" ? obj.text : undefined;
    if (!text || !Array.isArray(obj.citations) || !Array.isArray(obj.unknowns)) {
      throw new Error("malformed ask response");
    }
    const citations = obj.citations
      .map((c) => {
        const o = (typeof c === "object" && c !== null ? c : {}) as Record<string, unknown>;
        return { id: typeof o.id === "string" ? o.id : "", quote: typeof o.quote === "string" ? o.quote : "" };
      })
      .filter((c) => c.id && byId.has(c.id));
    const unknowns = obj.unknowns.filter((u): u is string => typeof u === "string");
    answer = { text, citations, unknowns };
  } catch {
    return Response.json({ error: "AI_BAD_RESPONSE" }, { status: 502 });
  }

  return Response.json(answer);
}
