"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Card } from "@/data/cards";
import type { Listing } from "@/data/listings";
import type { CatalogFacets, VdsUser } from "@/components/home-tabs";
import { CardPicker } from "@/components/card-picker";
import { VariationPriceList } from "@/components/variation-price-list";
import { FoilArt } from "@/components/foil-art";
import { CardFrame } from "@/components/card-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LISTING_TYPES, pickupLabel } from "@/lib/rarity";
import { toast } from "sonner";

const CONDITIONS = ["nm", "lp", "mp", "psa9"] as const;
const PICKUPS = ["games-haven-pl", "hobbystation", "jurong-east-mrt", "mail"] as const;

type SellPayload = {
  kind: "sell";
  cardCode: string;
  cardName: string;
  printing: Listing["printing"];
  rarity: string;
  type: Listing["type"];
  condition: Listing["condition"];
  language: Listing["language"];
  qty: number;
  priceSgd: number;
  grade: string | null;
  pickup: Listing["pickup"];
  note: string;
};

export function SellPanel({
  listings,
  user,
  catalog,
}: {
  listings: Listing[];
  user: VdsUser | null;
  catalog: CatalogFacets;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [printing, setPrinting] = useState<Listing["printing"]>("standard");
  const [condition, setCondition] = useState<Listing["condition"]>("nm");
  const [language, setLanguage] = useState<"en" | "zh" | "null">("null");
  const [qty, setQty] = useState(1);
  const [pickup, setPickup] = useState<Listing["pickup"]>("games-haven-pl");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [pendingPost, setPendingPost] = useState<SellPayload | null>(null);
  const [handle, setHandle] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Your active listings = posts where the seller is you (source "user"),
  // derived from the listings prop after each server refresh.
  const mine = useMemo(
    () => listings.filter((l) => l.source === "user"),
    [listings],
  );

  const pickCard = (c: Card) => {
    setCard(c);
    setPrice("");
  };

  // Prefill the asking price from the card's reference price (normal
  // variation, else cheapest priced variation). Never invented — only fires
  // when a priced variation exists.
  const handlePrices = useCallback((minUsd: number | null) => {
    if (minUsd !== null) setPrice(minUsd.toFixed(2));
  }, []);

  const priceNum = Number(price);
  const canPost = card !== null && Number.isFinite(priceNum) && priceNum > 0;

  const noteWords = note.trim() ? note.trim().split(/\s+/).length : 0;

  const submit = async () => {
    if (!card || !canPost) return;
    const payload: SellPayload = {
      kind: "sell",
      cardCode: card.cardCode,
      cardName: card.fullName,
      printing,
      rarity: (card.rarity as Listing["rarity"]) ?? "common",
      type: (LISTING_TYPES.find((t) => t === card.cardType) ?? "unit") as Listing["type"],
      condition,
      language: language === "null" ? null : (language as "en" | "zh"),
      qty: Math.min(4, Math.max(1, Math.floor(qty) || 1)),
      priceSgd: Math.round(priceNum * 100) / 100,
      grade: condition === "psa9" ? "PSA 9" : null,
      pickup,
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
      toast.error("Could not post the listing — try again");
      return;
    }
    toast.success("Listing posted — visible in the market");
    setCard(null);
    setPrice("");
    setNote("");
    setPendingPost(null);
    router.refresh();
  };

  const signUp = async (retry: SellPayload | null) => {
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
      if (retry) {
        await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(retry),
        });
        toast.success("Listing posted — visible in the market");
        setCard(null);
        setPrice("");
        setNote("");
        router.refresh();
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick a real Riftbound card from the full catalogue — every listing maps to a
        valid card.
      </p>

      <Button onClick={() => setPickerOpen(true)} variant={card ? "secondary" : "default"}>
        {card ? `Card: ${card.fullName}` : "Pick a card"}
      </Button>

      <CardPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={pickCard} facets={catalog} />

      {card ? (
        <form
          className="space-y-4 rounded-xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex gap-3">
            <FoilArt cardCode={card.cardCode} className="h-20 w-14 shrink-0 rounded-md ring-1 ring-foreground/10">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <CardFrame name={card.fullName} rarity={card.rarity} className="h-full w-full" />
              )}
            </FoilArt>
            <div className="min-w-0">
              <div className="text-sm font-medium">{card.fullName}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{card.cardCode}</span>
                <span>{card.cardSet}</span>
                <Badge variant="outline" className="border capitalize">
                  {card.rarity}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sell-printing">Printing</Label>
              <Select
                value={printing}
                onValueChange={(v) => setPrinting(v as Listing["printing"])}
              >
                <SelectTrigger className="w-full" id="sell-printing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="alt_art">Alt Art</SelectItem>
                  <SelectItem value="signature">Signature</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sell-condition">Condition</Label>
              <Select
                value={condition}
                onValueChange={(v) => setCondition(v as Listing["condition"])}
              >
                <SelectTrigger className="w-full" id="sell-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "psa9" ? "PSA 9 (slab)" : c.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sell-language">Language</Label>
              <Select
                value={language}
                onValueChange={(v) =>
                  setLanguage(v as "en" | "zh" | "null")
                }
              >
                <SelectTrigger className="w-full" id="sell-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="zh">简中 (ZH)</SelectItem>
                  <SelectItem value="null">Not stated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sell-qty">Quantity (1–4)</Label>
              <Input
                id="sell-qty"
                type="number"
                min={1}
                max={4}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sell-pickup">Pickup / delivery</Label>
            <Select value={pickup} onValueChange={(v) => setPickup(v as Listing["pickup"])}>
              <SelectTrigger className="w-full" id="sell-pickup">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PICKUPS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {pickupLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sell-price">Your asking price (S$)</Label>
            <VariationPriceList cardCode={card.cardCode} onPrices={handlePrices} />
            <Input
              id="sell-price"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sell-note">Note</Label>
            <Textarea
              id="sell-note"
              maxLength={90}
              rows={2}
              placeholder="e.g. sleeved since release, meet at Bugis"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {noteWords} word{noteWords === 1 ? "" : "s"} · {note.length}/90
            </p>
          </div>

          <Button type="submit" disabled={!canPost} className="w-full">
            Post listing
          </Button>
          {!canPost ? (
            <p className="text-xs text-muted-foreground">
              Pick a card and set a price above S$0 to post.
            </p>
          ) : null}
        </form>
      ) : null}

      {pendingPost && user === null ? (
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

      <div ref={listRef} className="space-y-2">
        <h3 className="text-sm font-medium">Your active listings</h3>
        <p className="text-xs text-muted-foreground">
          demo — stored in your local database
          {user !== null ? ` · posting as @${user.handle}` : ""}
        </p>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings yet.</p>
        ) : (
          mine.map((l) => (
            <div
              key={l.id}
              data-anim="item"
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{l.cardName}</div>
                <div className="text-xs text-muted-foreground">
                  {l.condition.toUpperCase()} · qty {l.qty} ·{" "}
                  {languageLabelShort(l.language)} · {pickupLabel(l.pickup)}
                </div>
              </div>
              <div className="text-sm font-medium">{`S$${l.priceSgd.toFixed(2)}`}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function languageLabelShort(l: Listing["language"]): string {
  if (l === "en") return "EN";
  if (l === "zh") return "ZH";
  return "lang not stated";
}
