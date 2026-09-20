"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Card } from "@/data/cards";
import type { CatalogFacets, WantPost } from "@/components/home-tabs";
import { revealStagger, bump } from "@/lib/motion";
import { CardPicker } from "@/components/card-picker";
import { Button } from "@/components/ui/button";
import { Card as WtbCard, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function WtbBoard({
  posts,
  catalog,
}: {
  posts: WantPost[];
  catalog: CatalogFacets;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Card | null>(null);
  const [qty, setQty] = useState(1);
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");
  const [pendingPost, setPendingPost] = useState<{
    cardCode: string;
    cardName: string;
    qty: number;
    budgetSgd: number;
    note: string;
  } | null>(null);
  const [handle, setHandle] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const badgeEls = useRef<Map<string, HTMLElement>>(new Map());
  const bumped = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (posts.length > 0 && boardRef.current) revealStagger(boardRef.current);
  }, [posts]);

  // Bump each match badge once, the first time it mounts with a match.
  // The match itself was computed on the server and arrives on the post.
  useEffect(() => {
    for (const p of posts) {
      if (p.cardCode === null || !p.match || bumped.current.has(p.id)) continue;
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

  const submitWant = async () => {
    if (!picked || !canPost) return;
    const payload = {
      kind: "want" as const,
      cardCode: picked.cardCode,
      cardName: picked.fullName,
      qty: Math.max(1, Math.floor(qty) || 1),
      budgetSgd: Math.round(budgetNum * 100) / 100,
      note,
    };
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      // No current user — prompt the inline mini-signup, then retry.
      setPendingPost(payload);
      return;
    }
    if (!res.ok) {
      toast.error("Could not post the want — try again");
      return;
    }
    toast.success("Want posted — visible in the board");
    setPicked(null);
    setBudget("");
    setNote("");
    setPendingPost(null);
    router.refresh();
  };

  const signUp = async (retry: NonNullable<typeof pendingPost>) => {
    const trimmed = handle.trim();
    if (!trimmed || signingIn) return;
    setSigningIn(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: trimmed }),
      });
      if (!res.ok) {
        toast.error("Could not create that handle — try another");
        return;
      }
      toast.success(`Signed in as @${trimmed}`);
      setHandle("");
      setPendingPost(null);
      router.refresh();
      const post = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retry),
      });
      if (post.ok) {
        toast.success("Want posted — visible in the board");
        setPicked(null);
        setBudget("");
        setNote("");
        router.refresh();
      } else {
        toast.error("Could not post the want — try again");
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Looking for something? Post a want and see if it matches live listings.
        </p>
        <Button onClick={() => setPickerOpen(true)}>Post a want</Button>
      </div>

      <CardPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={pickCard} facets={catalog} />

      {picked ? (
        <form
          className="space-y-3 rounded-xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitWant();
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

      {pendingPost ? (
        <div className="space-y-2 rounded-xl border border-amber-700/50 p-4">
          <p className="text-sm text-amber-400">
            Post as a local demo account — one click, no password.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="pick a handle, e.g. voiddeck_reg"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              aria-label="Handle for your local demo account"
            />
            <Button
              type="button"
              disabled={!handle.trim() || signingIn}
              onClick={() => void signUp(pendingPost)}
            >
              Sign in
            </Button>
          </div>
        </div>
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
            const match = post.match;
            return (
              <WtbCard key={post.id} data-anim="item" className="py-3">
                <CardContent className="px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">{post.cardName}</span>
                        {post.source === "ai_proposed" ? (
                          <Badge
                            variant="outline"
                            className="border-sky-800 text-[10px] font-normal text-sky-400"
                            title="Proposed by the deck-import assistant and confirmed by a user"
                          >
                            proposed by assistant
                          </Badge>
                        ) : null}
                      </div>
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
