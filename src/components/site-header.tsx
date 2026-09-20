"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CartSheet } from "@/components/cart-sheet";
import { bump } from "@/lib/motion";
import { cartCount } from "@/lib/marketplace";

export function SiteHeader() {
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(0);

  const refresh = useCallback(() => setCount(cartCount()), []);

  useEffect(() => {
    setMounted(true);
    setCount(cartCount());
    const onCartChanged = () => refresh();
    window.addEventListener("vds:cart-changed", onCartChanged);
    window.addEventListener("storage", onCartChanged);
    return () => {
      window.removeEventListener("vds:cart-changed", onCartChanged);
      window.removeEventListener("storage", onCartChanged);
    };
  }, [refresh]);

  useEffect(() => {
    if (mounted && count !== prevCount.current) {
      if (badgeRef.current) bump(badgeRef.current);
    }
    prevCount.current = count;
  }, [count, mounted]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
            Voiddeck <span className="text-amber-400">Singles</span>
          </Link>
          <p className="hidden text-xs text-zinc-500 sm:block">
            the void-deck card market for Runeterra
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/notes"
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Notes
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="relative gap-1.5"
            onClick={() => setCartOpen(true)}
          >
            Cart
            {mounted && count > 0 ? (
              <span
                ref={badgeRef}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-zinc-950"
              >
                {count}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
