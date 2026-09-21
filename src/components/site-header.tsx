"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CartSheet } from "@/components/cart-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { bump } from "@/lib/motion";
import { cartCount } from "@/lib/cart";

type VdsUser = { id: string; handle: string; kind: string };

export function SiteHeader() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<VdsUser | null | undefined>(undefined);
  const [userOpen, setUserOpen] = useState(false);
  const [users, setUsers] = useState<VdsUser[]>([]);
  const [handle, setHandle] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(0);

  const refresh = useCallback(() => setCount(cartCount()), []);

  useEffect(() => {
    setMounted(true);
    setCount(cartCount());
    // Current user via the API; `undefined` (placeholder) until it resolves,
    // so nothing flashes between server render and hydration.
    fetch("/api/users/me")
      .then(async (res) => {
        if (!res.ok) return { user: null };
        return (await res.json()) as { user: VdsUser | null };
      })
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
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

  // Existing handles for the switcher, loaded when the dialog opens.
  useEffect(() => {
    if (!userOpen) return;
    fetch("/api/users")
      .then(async (res) => {
        if (!res.ok) return { users: [] as VdsUser[] };
        return (await res.json()) as { users: VdsUser[] };
      })
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch(() => setUsers([]));
  }, [userOpen]);

  const signIn = async (picked: string) => {
    const trimmed = picked.trim();
    if (!trimmed || signingIn) return;
    setSigningIn(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: trimmed }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { user?: VdsUser };
      setUser(data.user ?? { id: trimmed, handle: trimmed, kind: "user" });
      setUserOpen(false);
      setHandle("");
      router.refresh();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gold/25 bg-hex-deep/90 shadow-[0_1px_0_0_rgba(200,170,110,0.12),0_10px_30px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md">
      <div
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-transparent via-gold/60 to-transparent"
      />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="chamfer flex size-9 shrink-0 items-center justify-center bg-[linear-gradient(160deg,#c8aa6e,#785a28)] text-base font-black text-[#081018] shadow-[0_0_14px_-4px_rgba(200,170,110,0.7)]">
            V
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-heading text-[15px] leading-tight font-semibold tracking-[0.06em] text-gold-bright uppercase sm:text-base">
              Voiddeck <span className="text-gold">Singles</span>
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              the void-deck card market for Riftbound
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/notes"
            className="text-[13px] text-muted-foreground underline-offset-2 transition-colors hover:text-gold-bright hover:underline sm:text-sm"
          >
            Notes
          </Link>
          {user === undefined ? (
            // Hydration-safe placeholder until /api/users/me resolves.
            <span
              aria-hidden
              className="h-9 w-16 rounded-full border border-border/60 sm:w-20"
            />
          ) : user !== null ? (
            <button
              type="button"
              onClick={() => setUserOpen(true)}
              title="Local demo account — click to switch"
              className="rounded-full border border-gold/50 px-3 py-1.5 text-[13px] font-medium text-gold transition-colors hover:border-gold hover:text-gold-bright sm:text-sm"
            >
              @{user.handle}
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-gold/40 px-3.5 text-[13px] hover:border-gold hover:text-gold-bright sm:text-sm"
              onClick={() => setUserOpen(true)}
            >
              Sign in
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="relative h-10 gap-2 border-gold/40 px-3.5 text-[13px] hover:border-gold hover:text-gold-bright sm:text-sm"
            onClick={() => setCartOpen(true)}
          >
            Cart
            {mounted && count > 0 ? (
              <span
                ref={badgeRef}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
              >
                {count}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>
              Local demo accounts — one click, no password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {users.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  Existing handles
                </p>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={signingIn}
                      onClick={() => void signIn(u.handle)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-amber-700 hover:text-amber-400 ${
                        user?.handle === u.handle
                          ? "border-amber-700/60 text-amber-400"
                          : "border-border text-zinc-300"
                      }`}
                    >
                      @{u.handle}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void signIn(handle);
              }}
            >
              <Input
                placeholder="or create a handle, e.g. voiddeck_reg"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                aria-label="New handle"
              />
              <Button type="submit" size="sm" disabled={!handle.trim() || signingIn}>
                {signingIn ? "Signing in…" : "Create"}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
