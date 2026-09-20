import {
  fetchDeck,
  parseDeckText,
  DeckImportError,
  DECK_URL_RE,
} from "@/lib/deckimport";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { url?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (text) {
    try {
      return Response.json(parseDeckText(text));
    } catch {
      return Response.json({ error: "DECK_FETCH_FAILED" }, { status: 422 });
    }
  }

  if (!url || !DECK_URL_RE.test(url)) {
    return Response.json({ error: "INVALID_URL" }, { status: 400 });
  }

  try {
    return Response.json(await fetchDeck(url));
  } catch (e) {
    if (e instanceof DeckImportError && e.code === "INVALID_URL") {
      return Response.json({ error: "INVALID_URL" }, { status: 400 });
    }
    return Response.json({ error: "DECK_FETCH_FAILED" }, { status: 422 });
  }
}
