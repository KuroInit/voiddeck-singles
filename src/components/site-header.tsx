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
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 text-base font-black text-zinc-950 shadow-sm shadow-amber-900/40">
            V
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] leading-tight font-semibold tracking-tight text-zinc-100 sm:text-base">
              Voiddeck <span className="text-amber-400">Singles</span>
            </span>
            <span className="hidden text-xs text-zinc-500 sm:block">
              the void-deck card market for Riftbound
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/notes"
            className="text-[13px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline sm:text-sm"
          >
            Notes
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="relative h-10 gap-2 border-zinc-700 px-3.5 text-[13px] sm:text-sm"
            onClick={() => setCartOpen(true)}
          >
            Cart
            {mounted && count > 0 ? (
              <span
                ref={badgeRef}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-zinc-950"
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
