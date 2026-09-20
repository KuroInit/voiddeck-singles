"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/data/cards";
import type { Listing } from "@/data/listings";
import {
  addListing,
  getListings,
  isUserListing,
} from "@/lib/marketplace";
import { USD_SGD, getPriceFor } from "@/lib/prices";
import { LISTING_TYPES, pickupLabel } from "@/lib/rarity";
import { revealStagger } from "@/lib/motion";
import { CardPicker } from "@/components/card-picker";
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
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  "bilgewater-market": "Bilgewater Market",
  "tcgplayer-mirror": "TCGplayer mirror",
};

const CONDITIONS = ["nm", "lp", "mp", "psa9"] as const;
const PICKUPS = ["games-haven-pl", "hobbystation", "jurong-east-mrt", "mail"] as const;

function referenceLine(cardCode: string): string | null {
  const p = getPriceFor(cardCode);
  if (!p) return null;
  const sgd = Math.round(p.usd * USD_SGD * 100) / 100;
  return `Reference: US$${p.usd.toFixed(2)} ≈ S$${sgd.toFixed(2)} — ${
    SOURCE_LABELS[p.source] ?? p.source
  }, ${p.asOf}`;
}

export function SellPanel() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [printing, setPrinting] = useState<Listing["printing"]>("standard");
  const [condition, setCondition] = useState<Listing["condition"]>("nm");
  const [language, setLanguage] = useState<"en" | "zh" | "null">("null");
  const [qty, setQty] = useState(1);
  const [pickup, setPickup] = useState<Listing["pickup"]>("games-haven-pl");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [mine, setMine] = useState<Listing[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load only in the browser to avoid SSR/hydration drift.
  useEffect(() => {
    setMine(getListings("sale").filter(isUserListing));
  }, []);

  useEffect(() => {
    if (mine.length > 0 && listRef.current) revealStagger(listRef.current);
  }, [mine]);

  const pickCard = (c: Card) => {
    setCard(c);
    const ref = getPriceFor(c.cardCode);
    if (ref) setPrice(ref.usd.toFixed(2));
  };

  const priceNum = Number(price);
  const canPost = card !== null && Number.isFinite(priceNum) && priceNum > 0;

  const noteWords = note.trim() ? note.trim().split(/\s+/).length : 0;

  const submit = () => {
    if (!card || !canPost) return;
    addListing({
      cardName: card.fullName,
      cardCode: card.cardCode,
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
    });
    toast.success("Listing posted — visible in your browser");
    setMine(getListings("sale").filter(isUserListing));
    setCard(null);
    setPrice("");
    setNote("");
  };

  const refLine = card ? referenceLine(card.cardCode) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick a real Riftbound card from the full catalogue — every listing maps to a
        valid card.
      </p>

      <Button onClick={() => setPickerOpen(true)} variant={card ? "secondary" : "default"}>
        {card ? `Card: ${card.fullName}` : "Pick a card"}
      </Button>

      <CardPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={pickCard} />

      {card ? (
        <form
          className="space-y-4 rounded-xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex gap-3">
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.fullName}
                className="h-20 w-14 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
              />
            ) : null}
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
            <Label htmlFor="sell-price">
              Your asking price (S$){" "}
              <span className="font-normal text-muted-foreground">
                {refLine ?? "no reference price available"}
              </span>
            </Label>
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

      <div ref={listRef} className="space-y-2">
        <h3 className="text-sm font-medium">Your active listings</h3>
        <p className="text-xs text-muted-foreground">
          demo — stored in your browser
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
