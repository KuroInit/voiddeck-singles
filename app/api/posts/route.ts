import { addSellListing, addWtbPost, NoUserError } from "@/lib/marketplace";

export const runtime = "nodejs";

const PRINTINGS = new Set(["standard", "alt_art", "signature"]);
const RARITIES = new Set(["common", "uncommon", "rare", "epic", "showcase"]);
const TYPES = new Set(["legend", "unit", "spell", "rune", "battlefield", "gear", "token", "sealed", "bulk"]);
const CONDITIONS = new Set(["nm", "lp", "mp", "psa9"]);
const PICKUPS = new Set(["games-haven-pl", "hobbystation", "jurong-east-mrt", "mail"]);
const LANGUAGES = new Set(["en", "zh"]);

type Body = Record<string, unknown>;

function pickEnum<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bad(error: string) {
  return Response.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("INVALID_JSON");
  }

  const kind = body.kind;
  if (kind !== "sell" && kind !== "want") return bad("INVALID_KIND");
  if (typeof body.cardName !== "string" || body.cardName.trim().length === 0) return bad("INVALID_CARD_NAME");
  if (body.note !== undefined && typeof body.note !== "string") return bad("INVALID_NOTE");

  const qty = body.qty === undefined ? 1 : asNumber(body.qty);
  if (qty === null || qty < 1 || !Number.isInteger(qty)) return bad("INVALID_QTY");

  const cardCode = body.cardCode === null || body.cardCode === undefined ? null : String(body.cardCode);
  const cardName = body.cardName;
  const note = typeof body.note === "string" ? body.note : "";
  const grade = typeof body.grade === "string" && body.grade.length > 0 ? body.grade : null;
  const source = body.source === "ai_proposed" ? "ai_proposed" : "user";

  const shared = {
    cardCode,
    cardName,
    qty,
    note,
    grade,
    source,
    printing: pickEnum(body.printing, PRINTINGS, "standard"),
    rarity: pickEnum(body.rarity, RARITIES, "common"),
    type: pickEnum(body.type, TYPES, "unit"),
    condition: pickEnum(body.condition, CONDITIONS, "nm"),
    language:
      typeof body.language === "string" && LANGUAGES.has(body.language)
        ? (body.language as "en" | "zh")
        : null,
    pickup: pickEnum(body.pickup, PICKUPS, "mail"),
  } as const;

  try {
    if (kind === "sell") {
      const priceSgd = asNumber(body.priceSgd);
      if (priceSgd === null || priceSgd < 0) return bad("INVALID_PRICE");
      const listing = await addSellListing({ ...shared, priceSgd });
      return Response.json({ listing });
    }
    const budgetSgd = asNumber(body.budgetSgd);
    if (budgetSgd === null || budgetSgd < 0) return bad("INVALID_BUDGET");
    const listing = await addWtbPost({ ...shared, budgetSgd });
    return Response.json({ listing });
  } catch (err) {
    if (err instanceof NoUserError) return Response.json({ error: "NO_USER" }, { status: 401 });
    throw err;
  }
}
