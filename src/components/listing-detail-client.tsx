"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AskPanel } from "@/components/ask-panel";
import { CardFrame } from "@/components/card-frame";
import { FoilArt } from "@/components/foil-art";
import { Button } from "@/components/ui/button";
import type { Listing } from "@/data/listings";
import { addToCart } from "@/lib/cart";
import { bump, pressable } from "@/lib/motion";

/** Detail art for one listing: server-joined imageUrl, CardFrame fallback on NULL/failure. */
export function DetailArt({ listing }: { listing: Listing }) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(listing.imageUrl) && !failed;
  return (
    <FoilArt
      cardCode={listing.cardCode}
      className="w-full max-w-xs shrink-0 rounded-xl lg:max-w-sm"
    >
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
    </FoilArt>
  );
}

/**
 * Client island for the listing detail page: add-to-cart button + the Ask
 * assistant mount. The rest of the page renders server-side.
 */
export function ListingActions({ listing }: { listing: Listing }) {
  const [askOpen, setAskOpen] = useState(false);
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const isWtb = listing.mode === "wtb";

  useEffect(() => {
    if (cartBtnRef.current) pressable(cartBtnRef.current);
  }, []);

  function handleAdd() {
    addToCart(listing.id, 1, { maxQty: listing.qty });
    if (cartBtnRef.current) bump(cartBtnRef.current);
    window.dispatchEvent(new CustomEvent("vds:cart-changed"));
    toast.success("Added to cart");
  }

  return (
    <>
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

      <AskPanel open={askOpen} onOpenChange={setAskOpen} listingId={listing.id} />
    </>
  );
}
