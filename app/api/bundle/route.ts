import { aiConfigured, chatJSON } from "@/lib/ai";
import { fallbackIntent, scoreCatalogue } from "@/lib/search";
import { getListings } from "@/lib/marketplace";
import type { Listing } from "@/data/listings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  let body: { goal?: unknown; budgetSgd?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "MISSING_INPUT" }, { status: 400 });
  }
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const budget =
    typeof body.budgetSgd === "number"
      ? body.budgetSgd
      : typeof body.budgetSgd === "string"
        ? Number.parseFloat(body.budgetSgd)
        : Number.NaN;
  if (!goal || !Number.isFinite(budget) || budget <= 0) {
    return Response.json({ error: "MISSING_INPUT" }, { status: 400 });
  }

  const allSale = await getListings("sale");
  const candidates = scoreCatalogue(allSale, fallbackIntent(goal)).slice(0, 30);
  const byId = new Map(
    allSale.map((l) => [l.id, l])
  );
  const candidateList = candidates
    .map((c) => byId.get(c.id))
    .filter((l): l is Listing => Boolean(l));

  if (candidateList.length === 0) {
    return Response.json({ error: "NO_FIT", gaps: ["no matching listings in the catalogue"] });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await chatJSON(
      [
        {
          role: "system",
          content:
            "You are a TCG shop bundle builder. Pick ONLY ids from the provided candidate list — no prose in ids. " +
            "Prefer whole playsets when the listing qty is 4. Stay within the budget in SGD. " +
            "List anything the goal asks for that is not in the catalogue under gaps. " +
            'Return ONLY JSON: {"lines": [{"id": string, "qty": number}], "note": string, "gaps": string[]}.',
        },
        {
          role: "user",
          content: `Goal: ${goal}\nBudget: S$${budget.toFixed(2)}\n\nCandidates JSON:\n${JSON.stringify(
            candidateList
          )}`,
        },
      ],
      700
    )) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "NO_FIT", gaps: ["bundle generation failed"] });
  }

  const note = typeof raw.note === "string" ? raw.note : "";
  const gaps = Array.isArray(raw.gaps)
    ? raw.gaps.filter((g): g is string => typeof g === "string")
    : [];

  // Server-side validation: never trust model numbers.
  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  const lines: { id: string; qty: number; unitPrice: number }[] = [];
  for (const rl of rawLines) {
    const o = (typeof rl === "object" && rl !== null ? rl : {}) as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const listing = byId.get(id);
    if (!listing) continue;
    const requested = typeof o.qty === "number" ? o.qty : Number.parseInt(String(o.qty), 10);
    const qty = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), listing.qty);
    lines.push({ id: listing.id, qty, unitPrice: listing.priceSgd });
  }

  let total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  while (total > budget && lines.length > 0) {
    // Drop the most expensive line (by line total, then unit price).
    let worst = 0;
    for (let i = 1; i < lines.length; i++) {
      const a = lines[i].unitPrice * lines[i].qty;
      const b = lines[worst].unitPrice * lines[worst].qty;
      if (a > b || (a === b && lines[i].unitPrice > lines[worst].unitPrice)) worst = i;
    }
    total -= lines[worst].unitPrice * lines[worst].qty;
    lines.splice(worst, 1);
  }

  if (lines.length < 2) {
    return Response.json({ error: "NO_FIT", gaps });
  }

  total = Math.round(total * 100) / 100;
  // Model numbers are never trusted: strip any currency figures from the note
  // so the server-computed total stays the single source of truth.
  const cleanNote = note
    .replace(/[^.!?]*[$≈]\s?\d[\d.,]*[^.!?]*[.!?]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return Response.json({ lines, total, note: cleanNote, gaps });
}
