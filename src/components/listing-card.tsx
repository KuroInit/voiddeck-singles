"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardFrame } from "@/components/card-frame";
import { findCard } from "@/data/cards";
import type { Listing } from "@/data/listings";
import { pressable } from "@/lib/motion";
import { conditionLabel, printingLabel, rarityClass, typeLabel } from "@/lib/rarity";
import { cn } from "@/lib/utils";

function ListingArt({ listing }: { listing: Listing }) {
  const card = findCard(listing.cardCode);
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(card?.imageUrl) && !failed;
  return (
    <div className="relative">
      {showImg ? (
        <img
          src={card!.imageUrl!}
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
      {listing.type === "sealed" || listing.type === "bulk" ? (
        <span className="absolute right-1.5 bottom-1.5 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] text-zinc-300">
          {typeLabel(listing.type)}
        </span>
      ) : null}
    </div>
  );
}

export function ListingCard({
  listing,
  onAddToCart,
}: {
  listing: Listing;
  onAddToCart?: (listing: Listing) => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (ref.current) pressable(ref.current);
  }, []);

  return (
    <Link
      ref={ref}
      href={`/listing/${listing.id}`}
      data-anim="item"
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
    >
      <Card
        className={cn(
          "gap-2 overflow-hidden p-0 py-0",
          listing.printing === "signature" && "bg-gradient-to-r from-amber-500/10"
        )}
      >
        <ListingArt listing={listing} />
        <div className="flex flex-col gap-1.5 p-3">
          <div className="flex items-start justify-between gap-1">
            <p className="line-clamp-1 text-sm font-medium text-zinc-100">{listing.cardName}</p>
            {listing.source === "user" ? (
              <Badge variant="outline" className="shrink-0 border-amber-700 text-[10px] text-amber-400">
                your listing
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className={cn("text-[10px]", rarityClass(listing.rarity))}>
              {printingLabel(listing.printing)}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px]", rarityClass(listing.rarity))}>
              {listing.rarity}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-zinc-400">
              {conditionLabel(listing.condition)}
            </Badge>
            {listing.qty === 4 ? (
              <Badge variant="outline" className="text-[10px] text-zinc-400">
                ×4
              </Badge>
            ) : null}
          </div>
          <p className="line-clamp-2 text-xs text-zinc-400">{listing.note}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-amber-400">
                S${listing.priceSgd.toFixed(2)}
              </span>
              <span className="truncate text-[10px] text-zinc-500">@{listing.seller}</span>
            </div>
            {onAddToCart ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2.5 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddToCart(listing);
                }}
              >
                Add to cart
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
