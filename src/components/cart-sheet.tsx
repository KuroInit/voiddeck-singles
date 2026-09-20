"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CardFrame } from "@/components/card-frame";
import { FoilArt } from "@/components/foil-art";
import type { Listing } from "@/data/listings";
import { checkoutCart, getCart, removeFromCart } from "@/lib/cart";
import { bump } from "@/lib/motion";
import { toast } from "sonner";

type CartLine = { listing: Listing; qty: number };

function CartThumb({ listing }: { listing: Listing }) {
  return (
    <FoilArt
      cardCode={listing.cardCode}
      className="w-9 shrink-0 rounded ring-1 ring-foreground/10"
    >
      {listing.imageUrl ? (
        <img
          src={listing.imageUrl}
          alt={listing.cardName}
          loading="lazy"
          className="aspect-[744/1039] w-full object-cover"
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

export function CartSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const totalRef = useRef<HTMLSpanElement>(null);
  const prevTotal = useRef<number | null>(null);

  // The cart itself stays in localStorage; its lines are validated against
  // the live sale catalogue from the server every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const cart = getCart();
    fetch("/api/listings?mode=sale")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { listings?: Listing[] };
        if (cancelled) return;
        const byId = new Map((data.listings ?? []).map((l: Listing) => [l.id, l] as const));
        const next: CartLine[] = [];
        for (const entry of cart) {
          const listing = byId.get(entry.listingId);
          if (listing) next.push({ listing, qty: entry.qty });
        }
        setLoadError(false);
        setLines(next);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setLines([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const total = lines.reduce((sum: number, l: CartLine) => sum + l.listing.priceSgd * l.qty, 0);

  useEffect(() => {
    if (prevTotal.current !== null && total !== prevTotal.current && totalRef.current) {
      bump(totalRef.current);
    }
    prevTotal.current = total;
  }, [total]);

  function remove(listingId: string) {
    removeFromCart(listingId);
    setLines((ls) => ls.filter((l) => l.listing.id !== listingId));
    window.dispatchEvent(new CustomEvent("vds:cart-changed"));
  }

  function checkout() {
    const { orderId: id } = checkoutCart();
    setLines([]);
    setOrderId(id);
    setCheckoutOpen(true);
    window.dispatchEvent(new CustomEvent("vds:cart-changed"));
    toast.success(`Order ${id} placed`);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Your cart</SheetTitle>
            <SheetDescription>
              {lines.length === 0
                ? "Your cart is empty."
                : `${lines.length} line(s) reserved locally.`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {loadError ? (
              <p className="py-6 text-center text-sm text-amber-400">
                Could not load the catalogue to validate your cart — try again.
              </p>
            ) : lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                Nothing here yet — add something from the market.
              </p>
            ) : (
              lines.map(({ listing, qty }) => (
                <div key={listing.id} className="flex items-center gap-3">
                  <CartThumb listing={listing} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-100">{listing.cardName}</p>
                    <p className="text-xs text-zinc-500">
                      ×{qty} · S${listing.priceSgd.toFixed(2)} each
                    </p>
                  </div>
                  <span className="text-sm font-medium text-amber-400">
                    S${(listing.priceSgd * qty).toFixed(2)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-zinc-400 hover:text-red-400"
                    onClick={() => remove(listing.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
            {lines.length > 0 ? (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Total</span>
                  <span ref={totalRef} className="text-base font-semibold text-amber-400">
                    S${total.toFixed(2)}
                  </span>
                </div>
                <Button onClick={checkout}>Checkout</Button>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demo checkout — no real payment is processed</DialogTitle>
            <DialogDescription>
              Order {orderId} confirmed.
              <br />
              Your cart is demo data stored in your browser; your listings live in
              your local database.
            </DialogDescription>
          </DialogHeader>
          <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
