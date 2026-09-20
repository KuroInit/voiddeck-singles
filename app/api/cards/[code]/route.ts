import { getDb, rowToCard } from "@/lib/db";
import { getCardVariations } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const row = getDb().prepare("SELECT * FROM cards WHERE card_code = ?").get(code) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const variations = await getCardVariations(code);
  return Response.json({ card: rowToCard(row), variations });
}
