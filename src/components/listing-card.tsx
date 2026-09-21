"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardFrame } from "@/components/card-frame";
import { FoilArt } from "@/components/foil-art";
import type { Listing } from "@/data/listings";
import { isFoil } from "@/lib/foil";
import { pressable } from "@/lib/motion";
import { conditionLabel, printingLabel, rarityClass } from "@/lib/rarity";
import { cn } from "@/lib/utils";

function ListingArt({ listing }: { listing: Listing }) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(listing.imageUrl) && !failed;
  const holo = isFoil(listing.cardCode);
  return (
    <FoilArt cardCode={listing.cardCode} className="w-full">
      {showImg ? (
        <img
          src={listing.imageUrl!}
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
      {holo ? (
        <span className="absolute top-2 left-2 z-[2] inline-flex items-center gap-1 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-300 backdrop-blur-sm">
          <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor" aria-hidden>
            <path d="M6 0l1.4 4.6L12 6 7.4 7.4 6 12 4.6 7.4 0 6l4.6-1.4L6 0z" />
          </svg>
          Foil
        </span>
      ) : null}
      {listing.type === "sealed" || listing.type === "bulk" ? (
        <span className="absolute right-2 bottom-2 z-[2] rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] text-zinc-300">
          {listing.type === "sealed" ? "Sealed" : "Bulk"}
        </span>
      ) : null}
    </FoilArt>
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
      className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <Card
        className={cn(
          "hextech-frame chamfer gap-0 overflow-hidden rounded-none p-0 py-0",
          listing.printing === "signature" && "sig"
        )}
      >
        <ListingArt listing={listing} />
        <div className="flex flex-col gap-2 p-3 sm:p-3.5">
          <p className="line-clamp-2 min-h-10 text-sm leading-snug font-medium text-gold-bright sm:text-[15px]">
            {listing.cardName}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className={cn("text-[10px] sm:text-[11px]", rarityClass(listing.rarity))}>
              {printingLabel(listing.printing)}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] capitalize sm:text-[11px]", rarityClass(listing.rarity))}>
              {listing.rarity}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-muted-foreground sm:text-[11px]">
              {conditionLabel(listing.condition)}
            </Badge>
            {listing.qty === 4 ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground sm:text-[11px]">
                ×4
              </Badge>
            ) : null}
            {listing.source === "user" ? (
              <Badge variant="outline" className="border-magic/60 text-[10px] text-magic sm:text-[11px]">
                your listing
              </Badge>
            ) : null}
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground sm:text-[13px]">{listing.note}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <span className="text-base font-semibold tracking-tight text-gold tabular-nums sm:text-lg">
                S${listing.priceSgd.toFixed(2)}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">@{listing.seller}</span>
            </div>
            {onAddToCart ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 px-3 text-xs sm:text-[13px]"
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
