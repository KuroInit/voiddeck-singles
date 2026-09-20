import {
  fetchDeck,
  parseDeckText,
  buildProposals,
  DeckImportError,
  DECK_URL_RE,
  type ImportedDeck,
  type DeckProposal,
} from "@/lib/deckimport";
import { aiConfigured, chatJSON } from "@/lib/ai";

export const runtime = "nodejs";

const AI_NOTE_TIMEOUT_MS = 20_000;
const MAX_NOTE_CHARS = 140;
const MAX_NOTE_WORDS = 14;

function sanitizeNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const note = raw.replace(/\s+/g, " ").trim();
  if (note.length === 0 || note.length > MAX_NOTE_CHARS) return null;
  const words = note.split(" ");
  return words.length <= MAX_NOTE_WORDS ? note : words.slice(0, MAX_NOTE_WORDS).join(" ");
}

/**
 * One batched gateway call drafting want notes for every gap card at once.
 * Never blocks the response for long (raced against a short timeout) and never
 * fails the import: on any error, slow gateway, or missing env the caller
 * keeps the deterministic template notes.
 */
async function aiNotes(
  deckName: string,
  proposals: DeckProposal[]
): Promise<Record<string, string> | null> {
  if (!aiConfigured() || proposals.length === 0) return null;
  try {
    const cards = proposals.map((p) => `${p.cardCode}: ${p.cardName}`).join("\n");
    const result = await Promise.race([
      chatJSON(
        [
          {
            role: "system",
            content:
              "You draft short notes for trading-card want posts. Reply with JSON only.",
          },
          {
            role: "user",
            content:
              `A deck called "${deckName}" is missing these cards. For each cardCode, ` +
              "draft a casual want-post note of at most 14 words that mentions the card. " +
              `Reply exactly as {"notes": {"<cardCode>": "<note>"}}.\n${cards}`,
          },
        ],
        1600
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI note timeout")), AI_NOTE_TIMEOUT_MS)
      ),
    ]);
    const notes = (result as { notes?: unknown } | null)?.notes;
    if (!notes || typeof notes !== "object") return null;
    const byCode = notes as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const p of proposals) {
      const note = sanitizeNote(byCode[p.cardCode]);
      if (note) out[p.cardCode] = note;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Shared response shape for both import modes: deck lines as today, plus the
 * deterministic want-post proposals (template notes, optionally upgraded with
 * gateway-drafted notes when the gateway is configured and responsive).
 */
async function respond(deck: ImportedDeck): Promise<Response> {
  const proposals = buildProposals(deck.lines, deck.name);
  const notes = await aiNotes(deck.name, proposals);
  return Response.json({
    name: deck.name,
    lines: deck.lines,
    proposals: notes
      ? proposals.map((p) => (notes[p.cardCode] ? { ...p, note: notes[p.cardCode] } : p))
      : proposals,
  });
}

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
      return respond(await parseDeckText(text));
    } catch {
      return Response.json({ error: "DECK_FETCH_FAILED" }, { status: 422 });
    }
  }

  if (!url || !DECK_URL_RE.test(url)) {
    return Response.json({ error: "INVALID_URL" }, { status: 400 });
  }

  try {
    return await respond(await fetchDeck(url));
  } catch (e) {
    if (e instanceof DeckImportError && e.code === "INVALID_URL") {
      return Response.json({ error: "INVALID_URL" }, { status: 400 });
    }
    return Response.json({ error: "DECK_FETCH_FAILED" }, { status: 422 });
  }
}
