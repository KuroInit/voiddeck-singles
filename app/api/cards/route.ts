import { getDb, rowToCard } from "@/lib/db";

export const runtime = "nodejs";

const MAX_RESULTS = 200;

const CARD_SELECT = `
  SELECT card_code, name, full_name, subtitle, set_code, card_set, card_number,
         rarity, domain, domains, card_type, energy, power, might, ability, image_url
  FROM cards`;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const set = (params.get("set") ?? "").trim();
  const rarity = (params.get("rarity") ?? "").trim();
  const domain = (params.get("domain") ?? "").trim();
  const cardType = (params.get("cardType") ?? "").trim();

  const clauses: string[] = [];
  const values: unknown[] = [];
  if (q.length > 0) {
    const like = `%${q.toLowerCase()}%`;
    clauses.push(
      "(LOWER(name) LIKE ? OR LOWER(full_name) LIKE ? OR LOWER(COALESCE(subtitle, '')) LIKE ? OR LOWER(card_code) LIKE ?)",
    );
    values.push(like, like, like, like);
  }
  if (set.length > 0) {
    clauses.push("LOWER(set_code) = ?");
    values.push(set.toLowerCase());
  }
  if (rarity.length > 0) {
    clauses.push("LOWER(rarity) = ?");
    values.push(rarity.toLowerCase());
  }
  if (domain.length > 0) {
    clauses.push("(LOWER(domain) = ? OR LOWER(COALESCE(domains, '[]')) LIKE ?)");
    values.push(domain.toLowerCase(), `%"${domain.toLowerCase()}"%`);
  }
  if (cardType.length > 0) {
    clauses.push("LOWER(card_type) = ?");
    values.push(cardType.toLowerCase());
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`${CARD_SELECT} ${where} ORDER BY card_code ASC LIMIT ${MAX_RESULTS}`)
    .all(...values) as Record<string, unknown>[];

  return Response.json({ cards: rows.map(rowToCard) });
}
