import { aiConfigured } from "@/lib/ai";
import { parseIntent, fallbackIntent, scoreCatalogue } from "@/lib/search";
import { getListings } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

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

  let intent;
  let source: "ai" | "keyword-fallback";
  try {
    intent = await parseIntent(q);
    source = "ai";
  } catch {
    intent = fallbackIntent(q);
    source = "keyword-fallback";
  }

  const results = scoreCatalogue(getListings("sale"), intent).slice(0, 24);
  return Response.json({ source, intent, results, count: results.length });
}
