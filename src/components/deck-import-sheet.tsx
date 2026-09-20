"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findCard } from "@/data/cards";
import { FoilArt } from "@/components/foil-art";
import { addToCart } from "@/lib/cart";
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

type DeckProposal = {
  cardCode: string;
  cardName: string;
  qty: number;
  budgetSgd: number;
  note: string;
  inDb: boolean;
};

type DeckResult = { name: string; lines: DeckLine[]; proposals?: DeckProposal[] };

type ProposalRow = DeckProposal & {
  checked: boolean;
  budget: string;
  noteDraft: string;
};

export function DeckImportSheet({
  open,
  onOpenChange,
  onPrefillBundle,
}: DeckImportSheetProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pending, setPending] = useState(false);
  const [deck, setDeck] = useState<DeckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantFor, setWantFor] = useState<number | null>(null); // deck line index with the inline want form open
  const [wantBudget, setWantBudget] = useState("");
  const [wantNote, setWantNote] = useState("");
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [needSignup, setNeedSignup] = useState(false);
  const [signupHandle, setSignupHandle] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const pendingRowsRef = useRef<ProposalRow[] | null>(null);
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
      setProposals([]);
      setCreating(false);
      setCreatedCount(null);
      setNeedSignup(false);
      setSignupHandle("");
      setSigningUp(false);
      pendingRowsRef.current = null;
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
      setProposals(
        (data.proposals ?? []).map((p) => ({
          ...p,
          checked: true,
          budget: p.budgetSgd.toFixed(2),
          noteDraft: p.note,
        }))
      );
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
  const checkedCount = proposals.filter((p) => p.checked).length;

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

  const fallbackNote = `Auto-proposed from deck import: ${deck?.name ?? "deck"}`;

  /**
   * Creates one want post per checked proposal row. On 401 NO_USER the pending
   * rows are parked and the inline signup shows; after signup the same rows
   * are retried — nothing is silently dropped.
   */
  const createWants = async (rows: ProposalRow[]): Promise<boolean> => {
    setCreating(true);
    try {
      let made = 0;
      for (const row of rows) {
        const budgetNum = Number(row.budget);
        try {
          const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "want",
              cardCode: row.cardCode,
              cardName: row.cardName,
              qty: row.qty,
              budgetSgd: Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 0,
              note: row.noteDraft.trim() || fallbackNote,
              source: "ai_proposed",
            }),
          });
          if (res.status === 401) {
            pendingRowsRef.current = rows.slice(made);
            setNeedSignup(true);
            return false;
          }
          if (!res.ok) {
            toast.error(
              made > 0
                ? `${made} want posts created, but ${row.cardName} failed — the rest were skipped`
                : `Could not create the want post for ${row.cardName} — try again`
            );
            return false;
          }
          made++;
        } catch {
          toast.error(
            made > 0
              ? `${made} want posts created, but the rest failed — network error`
              : "Could not create want posts — network error, try again"
          );
          return false;
        }
      }
      setCreatedCount(made);
      setProposals((prev) => prev.map((p) => ({ ...p, checked: false })));
      toast.success(`${made} want posts created — see the Looking for tab`);
      router.refresh();
      return true;
    } finally {
      setCreating(false);
    }
  };

  const signUpAndRetry = async () => {
    const handle = signupHandle.trim();
    if (handle.length === 0 || signingUp) return;
    setSigningUp(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        toast.error(
          typeof data.error === "string" && data.error !== "NO_USER"
            ? data.error
            : "Could not create that account — try another handle"
        );
        return;
      }
      setNeedSignup(false);
      setSignupHandle("");
      const rows = pendingRowsRef.current;
      pendingRowsRef.current = null;
      if (rows && rows.length > 0) {
        await createWants(rows);
      } else {
        toast.success(`Demo account created — you're signed in as ${handle}`);
      }
    } catch {
      toast.error("Could not create that account — try again");
    } finally {
      setSigningUp(false);
    }
  };

  const postWant = async (line: DeckLine) => {
    const budgetNum = Number(wantBudget);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "want",
          cardCode: line.inDb ? line.cardCode : null,
          cardName: line.name,
          qty: line.qty,
          budgetSgd: Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 0,
          note: wantNote || "from imported deck",
          source: "user",
        }),
      });
      if (res.status === 401) {
        pendingRowsRef.current = null;
        setNeedSignup(true);
        return;
      }
      if (!res.ok) {
        toast.error("Could not post the want — try again");
        return;
      }
      toast.success("Want posted — see the Looking for tab");
      setWantFor(null);
      setWantBudget("");
      setWantNote("");
    } catch {
      toast.error("Could not post the want — try again");
    }
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
                placeholder={"4 Jinx\n2 Shield of Dawn\n…"}
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
                      <FoilArt cardCode={line.inDb ? line.cardCode : null} className="h-12 w-9 shrink-0 rounded ring-1 ring-foreground/10">
                        {card?.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={line.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-800" />
                        )}
                      </FoilArt>
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

              {proposals.length > 0 ? (
                <div
                  data-anim="item"
                  className="space-y-2 rounded-xl border border-amber-700/40 p-3"
                >
                  <p className="text-sm font-medium">
                    The assistant proposed these Looking-for posts — nothing is created
                    until you confirm.
                  </p>
                  {proposals.map((row) => (
                    <div
                      key={row.cardCode}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-border px-3 py-2"
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-amber-500"
                          checked={row.checked}
                          disabled={createdCount !== null || creating}
                          onChange={(e) =>
                            setProposals((prev) =>
                              prev.map((p) =>
                                p.cardCode === row.cardCode
                                  ? { ...p, checked: e.target.checked }
                                  : p
                              )
                            )
                          }
                        />
                        <span className="truncate">
                          {row.qty}× {row.cardName}
                        </span>
                      </label>
                      <Label
                        htmlFor={`prop-budget-${row.cardCode}`}
                        className="text-xs text-muted-foreground"
                      >
                        Budget S$
                      </Label>
                      <Input
                        id={`prop-budget-${row.cardCode}`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="h-8 w-24"
                        value={row.budget}
                        disabled={createdCount !== null || creating}
                        onChange={(e) =>
                          setProposals((prev) =>
                            prev.map((p) =>
                              p.cardCode === row.cardCode
                                ? { ...p, budget: e.target.value }
                                : p
                            )
                          )
                        }
                      />
                      <Input
                        className="h-8 w-full sm:w-auto sm:min-w-[14rem] sm:flex-1"
                        maxLength={90}
                        placeholder="want note"
                        value={row.noteDraft}
                        disabled={createdCount !== null || creating}
                        onChange={(e) =>
                          setProposals((prev) =>
                            prev.map((p) =>
                              p.cardCode === row.cardCode
                                ? { ...p, noteDraft: e.target.value }
                                : p
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                  {createdCount !== null ? (
                    <p className="text-xs text-emerald-400">
                      {createdCount} want posts created — see the Looking for tab on the
                      home board.
                    </p>
                  ) : (
                    <Button
                      onClick={() => void createWants(proposals.filter((p) => p.checked))}
                      disabled={creating || checkedCount === 0}
                      className="w-full"
                    >
                      Create {checkedCount} want posts
                    </Button>
                  )}
                </div>
              ) : null}

              {needSignup ? (
                <form
                  data-anim="item"
                  className="space-y-2 rounded-xl border border-border bg-zinc-900/40 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void signUpAndRetry();
                  }}
                >
                  <p className="text-xs text-muted-foreground">
                    local demo account — one click, no password
                  </p>
                  <div className="flex gap-2">
                    <Input
                      aria-label="Handle"
                      placeholder="pick a handle, e.g. mrtan"
                      maxLength={32}
                      value={signupHandle}
                      onChange={(e) => setSignupHandle(e.target.value)}
                    />
                    <Button
                      type="submit"
                      disabled={signingUp || signupHandle.trim().length === 0}
                    >
                      {signingUp ? "Creating…" : "Create account & retry"}
                    </Button>
                  </div>
                </form>
              ) : null}

              {wantFor !== null && deck.lines[wantFor] ? (
                <form
                  className="space-y-2 rounded-xl border border-amber-700/40 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void postWant(deck.lines[wantFor]);
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
