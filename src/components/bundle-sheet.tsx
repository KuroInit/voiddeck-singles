"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/data/listings";
import { addToCart, getAllListings } from "@/lib/marketplace";
import { findCard } from "@/data/cards";
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
import { toast } from "sonner";

type BundleSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillGoal?: string;
  prefillBudget?: number;
};

type Line = { id: string; qty: number; unitPrice: number };
type BundleOk = { lines: Line[]; total: number; note: string; gaps: string[] };
type BundleNoFit = { error: "NO_FIT"; gaps: string[] };

const EXAMPLES: { goal: string; budget: number }[] = [
  { goal: "noxus aggro core under $30", budget: 30 },
  { goal: "lee sin buff core under $40", budget: 40 },
  { goal: "starter deck for a new player under $25", budget: 25 },
];

export function BundleSheet({
  open,
  onOpenChange,
  prefillGoal,
  prefillBudget,
}: BundleSheetProps) {
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");
  const [pending, setPending] = useState(false);
  const [bundle, setBundle] = useState<BundleOk | null>(null);
  const [noFit, setNoFit] = useState<BundleNoFit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const linesRef = useRef<HTMLDivElement | null>(null);
  const cartBtnRef = useRef<HTMLButtonElement | null>(null);

  // Prefill when the sheet opens (covers both explicit props and the apply-chip flow).
  useEffect(() => {
    if (open) {
      setGoal(prefillGoal ?? "");
      setBudget(prefillBudget !== undefined ? String(prefillBudget) : "");
      setBundle(null);
      setNoFit(null);
      setError(null);
      setPending(false);
      setListings(getAllListings());
    }
  }, [open, prefillGoal, prefillBudget]);

  useEffect(() => {
    if (bundle && linesRef.current) revealStagger(linesRef.current);
  }, [bundle]);

  const budgetNum = Number(budget);
  const canSubmit = goal.trim().length > 0 && Number.isFinite(budgetNum) && budgetNum > 0;

  const submit = async () => {
    if (!canSubmit || pending) return;
    setPending(true);
    setBundle(null);
    setNoFit(null);
    setError(null);
    try {
      const res = await fetch("/api/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), budgetSgd: budgetNum }),
      });
      if (res.status === 503) {
        setError("AI unavailable — server env not set");
        return;
      }
      if (!res.ok) {
        setError("Could not build a bundle — try again");
        return;
      }
      const data = (await res.json()) as BundleOk | BundleNoFit;
      if ("error" in data && data.error === "NO_FIT") {
        setNoFit(data);
      } else if ("lines" in data) {
        setBundle(data);
      } else {
        setError("Could not build a bundle — try again");
      }
    } catch {
      setError("Could not build a bundle — try again");
    } finally {
      setPending(false);
    }
  };

  const addAll = () => {
    if (!bundle) return;
    for (const line of bundle.lines) addToCart(line.id, line.qty);
    if (cartBtnRef.current) bump(cartBtnRef.current);
    toast.success("Bundle added to cart — demo only, stored in your browser");
  };

  const listingById = new Map(listings.map((l) => [l.id, l] as const));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle>Build a bundle</SheetTitle>
          <SheetDescription>
            Describe what you want and a budget — we pick from live listings only.
            (demo)
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="bundle-goal">Goal</Label>
            <Input
              id="bundle-goal"
              placeholder="e.g. noxus aggro core under $30"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bundle-budget">Budget (S$)</Label>
            <Input
              id="bundle-budget"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.goal}
                type="button"
                onClick={() => {
                  setGoal(ex.goal);
                  setBudget(String(ex.budget));
                }}
                className="rounded-4xl border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-400"
              >
                {ex.goal}
              </button>
            ))}
          </div>

          <Button onClick={() => void submit()} disabled={!canSubmit || pending} className="w-full">
            {pending ? "Building…" : "Build bundle"}
          </Button>

          {pending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : null}

          {error ? <p className="text-sm text-amber-400">{error}</p> : null}

          {noFit ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-400">
                Nothing fits {`S$${budgetNum.toFixed(2)}`} with at least two lines —
                raise the budget or drop a constraint.
              </p>
              {noFit.gaps.length > 0 ? <Gaps gaps={noFit.gaps} /> : null}
            </div>
          ) : null}

          {bundle && !pending ? (
            <div ref={linesRef} className="space-y-2">
              <div data-anim="item" className="space-y-2">
                {bundle.lines.map((line) => {
                  const listing = listingById.get(line.id) ?? null;
                  const card = listing ? findCard(listing.cardCode) : null;
                  return (
                    <div
                      key={line.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      {card?.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.fullName}
                          className="h-12 w-9 shrink-0 rounded object-cover ring-1 ring-foreground/10"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{listing?.cardName ?? line.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {line.qty} × {`S$${line.unitPrice.toFixed(2)}`}
                        </div>
                      </div>
                      <Link
                        href={`/listing/${line.id}`}
                        className="shrink-0 text-xs text-amber-400 underline underline-offset-2"
                      >
                        view
                      </Link>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{`S$${bundle.total.toFixed(2)}`}</span>
              </div>

              {bundle.note ? (
                <p className="text-xs text-muted-foreground">{bundle.note}</p>
              ) : null}

              {bundle.gaps.length > 0 ? <Gaps gaps={bundle.gaps} /> : null}

              <Button ref={cartBtnRef} onClick={addAll} className="w-full">
                Add all to cart
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Gaps({ gaps }: { gaps: string[] }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">Not in the catalogue</h4>
      <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
        {gaps.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
    </div>
  );
}
