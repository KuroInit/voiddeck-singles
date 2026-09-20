"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Card } from "@/data/cards";
import type { Listing } from "@/data/listings";
import { addWtbPost, bestListingFor, getWtbPosts } from "@/lib/marketplace";
import { revealStagger, bump } from "@/lib/motion";
import { CardPicker } from "@/components/card-picker";
import { Button } from "@/components/ui/button";
import { Card as WtbCard, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function WtbBoard() {
  const [posts, setPosts] = useState<Listing[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Card | null>(null);
  const [qty, setQty] = useState(1);
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");
  const boardRef = useRef<HTMLDivElement | null>(null);
  const badgeEls = useRef<Map<string, HTMLElement>>(new Map());
  const bumped = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPosts(getWtbPosts());
  }, []);

  useEffect(() => {
    if (posts.length > 0 && boardRef.current) revealStagger(boardRef.current);
  }, [posts]);

  // Bump each match badge once, the first time it mounts with a match.
  useEffect(() => {
    for (const p of posts) {
      if (p.cardCode === null || bumped.current.has(p.id)) continue;
      const match = bestListingFor(p.cardCode, p.budgetSgd);
      if (!match) continue;
      const el = badgeEls.current.get(p.id);
      if (el) {
        bumped.current.add(p.id);
        bump(el);
      }
    }
  });

  const pickCard = (c: Card) => setPicked(c);

  const budgetNum = Number(budget);
  const canPost =
    picked !== null && Number.isFinite(budgetNum) && budgetNum > 0 && qty >= 1;

  const submitWant = () => {
    if (!picked || !canPost) return;
    const post = addWtbPost({
      cardName: picked.fullName,
      cardCode: picked.cardCode,
      qty: Math.max(1, Math.floor(qty) || 1),
      budgetSgd: Math.round(budgetNum * 100) / 100,
      note,
    });
    toast.success("Want posted — visible in your browser");
    setPosts(getWtbPosts());
    setPicked(null);
    setBudget("");
    setNote("");
    void post;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Looking for something? Post a want and see if it matches live listings.
        </p>
        <Button onClick={() => setPickerOpen(true)}>Post a want</Button>
      </div>

      <CardPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={pickCard} />

      {picked ? (
        <form
          className="space-y-3 rounded-xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitWant();
          }}
        >
          <div className="text-sm font-medium">{picked.fullName}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wtb-qty">Quantity</Label>
              <Input
                id="wtb-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wtb-budget">Budget (S$)</Label>
              <Input
                id="wtb-budget"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wtb-note">Note</Label>
            <Textarea
              id="wtb-note"
              maxLength={90}
              rows={2}
              placeholder="e.g. chasing the alt art, can meet weekend"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!canPost} className="w-full">
            Post want
          </Button>
        </form>
      ) : null}

      <p className="text-xs text-muted-foreground">
        A want for a category (e.g. &ldquo;25 random OGN rares&rdquo;) has no specific
        card, so it can&rsquo;t auto-match singles — it stays &ldquo;No matches
        yet&rdquo;.
      </p>

      <div ref={boardRef} className="space-y-3">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No wants posted yet.
          </p>
        ) : (
          posts.map((post) => {
            const match =
              post.cardCode !== null
                ? bestListingFor(post.cardCode, post.budgetSgd)
                : null;
            return (
              <WtbCard key={post.id} data-anim="item" className="py-3">
                <CardContent className="px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{post.cardName}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        qty {post.qty} · budget{" "}
                        {post.budgetSgd !== undefined
                          ? `S$${post.budgetSgd.toFixed(2)}`
                          : "not set"}{" "}
                        · by{" "}
                        <span className="text-amber-400">{post.seller}</span>
                      </div>
                      {post.note ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          &ldquo;{post.note}&rdquo;
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      {match ? (
                        <div>
                          <Badge
                            ref={(el: HTMLElement | null) => {
                              if (el) badgeEls.current.set(post.id, el);
                              else badgeEls.current.delete(post.id);
                            }}
                            variant="outline"
                            className="border-emerald-700 text-emerald-400"
                          >
                            Match: {`S$${match.priceSgd.toFixed(2)}`}
                          </Badge>
                          <div className="mt-1.5">
                            <Link
                              href={`/listing/${match.id}`}
                              className="text-xs text-amber-400 underline underline-offset-2"
                            >
                              view listing
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No matches yet
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </WtbCard>
            );
          })
        )}
      </div>
    </div>
  );
}
