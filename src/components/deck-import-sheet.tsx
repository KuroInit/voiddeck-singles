"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { findCard } from "@/data/cards";
import { addWtbPost, addToCart } from "@/lib/marketplace";
import { revealStagger, bump } from "@/lib/motion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type DeckImportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrefillBundle?: (goal: string, budgetSgd?: number) => void;
};

type DeckLine = {
  cardCode: string;
  name: string;
  qty: number;
  inDb: boolean;
  bestListing: { id: string; priceSgd: number } | null;
};
type DeckResult = { name: string; lines: DeckLine[] };

export function DeckImportSheet({
  open,
  onOpenChange,
  onPrefillBundle,
}: DeckImportSheetProps) {
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pending, setPending] = useState(false);
  const [deck, setDeck] = useState<DeckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantFor, setWantFor] = useState<number | null>(null); // deck line index with the inline want form open
  const [wantBudget, setWantBudget] = useState("");
  const [wantNote, setWantNote] = useState("");
  const linesRef = useRef<HTMLDivElement | null>(null);
  const cartBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setPasted("");
      setPasteMode(false);
      setDeck(null);
      setError(null);
      setPending(false);
      setWantFor(null);
      setWantBudget("");
      setWantNote("");
    }
  }, [open]);

  useEffect(() => {
    if (deck && linesRef.current) revealStagger(linesRef.current);
  }, [deck]);

  const importDeck = async () => {
    if (pending) return;
    if (!pasteMode && url.trim().length === 0) return;
    if (pasteMode && pasted.trim().length === 0) return;
    setPending(true);
    setDeck(null);
    setError(null);
    setWantFor(null);
    try {
      const body = pasteMode
        ? JSON.stringify({ text: pasted })
        : JSON.stringify({ url: url.trim() });
      const res = await fetch("/api/deck-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.status === 400) {
        setError("That doesn't look like a riftdecks.com deck link");
        return;
      }
      if (res.status === 422) {
        setError("Could not fetch that deck — try pasting the decklist instead");
        return;
      }
      if (!res.ok) {
        setError("Import failed — try again");
        return;
      }
      const data = (await res.json()) as DeckResult;
      setDeck(data);
    } catch {
      setError("Import failed — try again");
    } finally {
      setPending(false);
    }
  };

  const stocked = deck ? deck.lines.filter((l) => l.bestListing !== null) : [];
  const availableTotal = stocked.reduce(
    (sum, l) => sum + l.qty * (l.bestListing?.priceSgd ?? 0),
    0
  );

  const addAllAvailable = () => {
    for (const line of stocked) {
      if (line.bestListing) addToCart(line.bestListing.id, line.qty);
    }
    if (cartBtnRef.current) bump(cartBtnRef.current);
    toast.success("Available lines added to cart — demo only, stored in your browser");
  };

  const composeWithAi = () => {
    if (!deck) return;
    onPrefillBundle?.(deck.name, Math.ceil(availableTotal));
    onOpenChange(false);
  };

  const postWant = (line: DeckLine) => {
    const budgetNum = Number(wantBudget);
    addWtbPost({
      cardName: line.name,
      cardCode: line.inDb ? line.cardCode : null,
      qty: line.qty,
      budgetSgd: Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 0,
      note: wantNote || "from imported deck",
    });
    toast.success("Want posted — visible in your browser");
    setWantFor(null);
    setWantBudget("");
    setWantNote("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle>Import a deck</SheetTitle>
          <SheetDescription>
            Paste a riftdecks.com link, or paste the decklist text directly. (demo)
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          {pasteMode ? (
            <div className="space-y-1.5">
              <Label htmlFor="deck-pasted">Decklist text</Label>
              <Textarea
                id="deck-pasted"
                rows={5}
                placeholder={"4 Jinx\n2 Legends Runeterra\n…"}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="deck-url">Deck URL</Label>
              <Input
                id="deck-url"
                type="url"
                placeholder="https://riftdecks.com/deck/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => setPasteMode((m) => !m)}
          >
            {pasteMode ? "Use a riftdecks.com link instead" : "Paste decklist text instead"}
          </button>

          <Button
            onClick={() => void importDeck()}
            disabled={pending}
            className="w-full"
          >
            {pending ? "Importing…" : "Import deck"}
          </Button>

          {pending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : null}

          {error ? <p className="text-sm text-amber-400">{error}</p> : null}

          {deck && !pending ? (
            <div ref={linesRef} className="space-y-3">
              <div data-anim="item" className="space-y-1">
                <h3 className="text-sm font-medium">{deck.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Available total: {`S$${availableTotal.toFixed(2)}`} · {stocked.length} of{" "}
                  {deck.lines.length} lines in stock
                </p>
              </div>

              <div data-anim="item" className="space-y-2">
                {deck.lines.map((line, i) => {
                  const card = line.inDb ? findCard(line.cardCode) : null;
                  return (
                    <div
                      key={`${line.cardCode}-${line.name}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      {card?.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={line.name}
                          className="h-12 w-9 shrink-0 rounded object-cover ring-1 ring-foreground/10"
                        />
                      ) : (
                        <div className="h-12 w-9 shrink-0 rounded bg-zinc-800 ring-1 ring-foreground/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          {line.qty}× {line.name}
                          {!line.inDb ? (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              (not in catalogue)
                            </span>
                          ) : null}
                        </div>
                        {line.bestListing ? (
                          <div className="text-xs text-muted-foreground">
                            {`S$${line.bestListing.priceSgd.toFixed(2)}`} ·{" "}
                            <Link
                              href={`/listing/${line.bestListing.id}`}
                              className="text-amber-400 underline underline-offset-2"
                            >
                              view
                            </Link>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            No stock ·{" "}
                            <button
                              type="button"
                              className="text-amber-400 underline underline-offset-2"
                              onClick={() => {
                                setWantFor(wantFor === i ? null : i);
                                setWantBudget("");
                                setWantNote("");
                              }}
                            >
                              Post to Looking For
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {wantFor !== null && deck.lines[wantFor] ? (
                <form
                  className="space-y-2 rounded-xl border border-amber-700/40 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    postWant(deck.lines[wantFor]);
                  }}
                >
                  <div className="text-xs text-amber-400">
                    Want: {deck.lines[wantFor].name} ×{deck.lines[wantFor].qty}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="want-budget">Budget (S$)</Label>
                    <Input
                      id="want-budget"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={wantBudget}
                      onChange={(e) => setWantBudget(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="want-note">Note</Label>
                    <Input
                      id="want-note"
                      maxLength={90}
                      placeholder="e.g. from imported deck"
                      value={wantNote}
                      onChange={(e) => setWantNote(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={!(Number(wantBudget) > 0)}
                  >
                    Post want
                  </Button>
                </form>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  ref={cartBtnRef}
                  onClick={addAllAvailable}
                  disabled={stocked.length === 0}
                >
                  Add all available to cart
                </Button>
                <Button
                  variant="secondary"
                  onClick={composeWithAi}
                  disabled={stocked.length === 0}
                >
                  Compose closest buy with AI
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
