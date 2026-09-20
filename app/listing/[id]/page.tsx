"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AskPanel } from "@/components/ask-panel";
import { CardFrame } from "@/components/card-frame";
import { FoilArt } from "@/components/foil-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { findCard } from "@/data/cards";
import type { Listing } from "@/data/listings";
import { addToCart, getAllListings } from "@/lib/marketplace";
import { isFoil } from "@/lib/foil";
import { bump, pressable } from "@/lib/motion";
import {
  conditionLabel,
  languageLabel,
  pickupLabel,
  printingLabel,
  rarityClass,
  typeLabel,
} from "@/lib/rarity";
import { getPriceFor } from "@/lib/prices";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  "bilgewater-market": "Bilgewater Market",
  "tcgplayer-mirror": "TCGplayer mirror",
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[13px] text-zinc-500 sm:text-sm">{label}</span>
      <span className="text-right text-sm text-zinc-200 sm:text-[15px]">{value}</span>
    </div>
  );
}

function DetailArt({ listing }: { listing: Listing }) {
  const card = findCard(listing.cardCode);
  const [failed, setFailed] = useState(false);
  return (
    <FoilArt
      cardCode={listing.cardCode}
      className="w-full max-w-xs shrink-0 rounded-xl lg:max-w-sm"
    >
      {card?.imageUrl && !failed ? (
        <img
          src={card.imageUrl}
          alt={listing.cardName}
          loading="lazy"
          className="aspect-[744/1039] w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <CardFrame
          name={listing.cardName}
          rarity={listing.rarity}
          className="aspect-[744/1039] w-full"
        />
      )}
    </FoilArt>
  );
}

export default function ListingPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : undefined;
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [askOpen, setAskOpen] = useState(false);
  const cartBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) return;
    const found = getAllListings().find((l) => l.id === id) ?? null;
    setListing(found);
  }, [id]);

  useEffect(() => {
    if (cartBtnRef.current) pressable(cartBtnRef.current);
  }, [listing]);

  if (listing === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="aspect-[744/1039] w-full max-w-xs rounded-xl" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (listing === null) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 px-4 py-16">
        <p className="text-lg font-medium text-zinc-200">Listing not found</p>
        <p className="text-sm text-zinc-500">
          It may have been sold, or it belongs to this browser only.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to the market</Link>
        </Button>
      </div>
    );
  }

  const card = findCard(listing.cardCode);
  const price = getPriceFor(listing.cardCode);
  const isWtb = listing.mode === "wtb";

  function handleAdd() {
    addToCart(listing!.id);
    if (cartBtnRef.current) bump(cartBtnRef.current);
    window.dispatchEvent(new CustomEvent("vds:cart-changed"));
    toast.success("Added to cart");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/" className="text-[13px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">
        ← Back to the market
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <DetailArt listing={listing} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {isWtb ? (
                <Badge variant="outline" className="border-amber-700 text-amber-400">
                  Wanted to buy
                </Badge>
              ) : null}
              {listing.source === "user" ? (
                <Badge variant="outline" className="border-amber-700 text-amber-400">
                  your listing
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">{listing.cardName}</h1>
            {card ? (
              <p className="text-[13px] text-zinc-500 sm:text-sm">
                {card.fullName !== card.name ? `${card.fullName} · ` : ""}
                {card.cardSet} · {card.cardNumber}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={rarityClass(listing.rarity)}>
                {printingLabel(listing.printing)}
              </Badge>
              <Badge variant="outline" className={rarityClass(listing.rarity)}>
                {listing.rarity}
              </Badge>
              <Badge variant="outline" className="text-zinc-400">
                {typeLabel(listing.type)}
              </Badge>
              {listing.grade ? (
                <Badge variant="outline" className="border-amber-700 text-amber-400">
                  {listing.grade}
                </Badge>
              ) : null}
            </div>
          </div>

          <p className="text-3xl font-semibold tracking-tight text-amber-400 tabular-nums sm:text-4xl">
            {isWtb ? `S$${listing.budgetSgd?.toFixed(2)}` : `S$${listing.priceSgd.toFixed(2)}`}
            <span className="ml-2 text-[13px] font-normal text-zinc-500 sm:text-sm">
              {isWtb ? "want to buy" : "asking price, not market value"}
            </span>
          </p>

          <Card className="flex flex-col p-4">
            {(
              [
                <Field key="printing" label="Printing" value={printingLabel(listing.printing)} />,
                <Field key="rarity" label="Rarity" value={listing.rarity} />,
                <Field key="type" label="Type" value={typeLabel(listing.type)} />,
                <Field key="condition" label="Condition" value={conditionLabel(listing.condition)} />,
                <Field
                  key="language"
                  label="Language"
                  value={
                    listing.language === null
                      ? "not stated in this listing"
                      : languageLabel(listing.language)
                  }
                />,
                ...(listing.grade
                  ? [<Field key="grade" label="Grade" value={listing.grade} />]
                  : []),
                <Field key="qty" label="Qty" value={`×${listing.qty}`} />,
                <Field key="seller" label="Seller" value={`@${listing.seller}`} />,
                <Field key="pickup" label="Pickup" value={pickupLabel(listing.pickup)} />,
                <Field key="id" label="Listing ID" value={listing.id} />,
                <Field key="mode" label="Mode" value={listing.mode} />,
              ] as ReactNode[]
            ).map((field, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                {i > 0 ? <Separator /> : null}
                {field}
              </div>
            ))}
          </Card>

          {listing.note ? (
            <div className="rounded-lg border border-zinc-800 p-3">
              <p className="text-[10px] tracking-wide text-zinc-500 uppercase">Seller note</p>
              <p className="mt-1 text-sm text-zinc-300">{listing.note}</p>
            </div>
          ) : null}

          {price ? (
            <p className="text-xs text-zinc-500">
              Reference: US${price.usd.toFixed(2)} ≈ S${(price.usd * 1.35).toFixed(2)} —{" "}
              {SOURCE_LABELS[price.source] ?? price.source}, {price.asOf}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">No reference price available.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {!isWtb ? (
              <Button ref={cartBtnRef} onClick={handleAdd}>
                Add to cart
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setAskOpen(true)}>
              Ask about this listing
            </Button>
          </div>
        </div>
      </div>

      <AskPanel open={askOpen} onOpenChange={setAskOpen} listingId={listing.id} />
    </div>
  );
}
