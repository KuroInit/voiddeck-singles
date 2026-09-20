/**
 * Client-safe cart persistence (localStorage).
 *
 * Deliberately separate from `@/lib/marketplace`, which is server-only: the
 * cart is the one piece of state that still lives in the browser. The listing
 * catalogue it validates against now comes from the server (props or the
 * listings API), so `addToCart` takes an optional `maxQty` instead of looking
 * listings up itself.
 */

export type CartLine = { listingId: string; qty: number };

const CART_KEY = "vds_cart";

// wrapped — a corrupted localStorage entry must never throw in render paths.
function readStore(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(value));
  } catch {
    // storage full or blocked: cart writes are best-effort
  }
}

export function getCart(): CartLine[] {
  return readStore().filter(
    (line): line is CartLine =>
      typeof line === "object" &&
      line !== null &&
      typeof (line as CartLine).listingId === "string" &&
      typeof (line as CartLine).qty === "number",
  );
}

export function addToCart(
  listingId: string,
  qty = 1,
  opts?: { maxQty?: number },
): void {
  if (qty <= 0) return;
  const maxQty = opts?.maxQty;
  if (maxQty !== undefined && maxQty <= 0) return;
  const cap = maxQty !== undefined ? maxQty : Number.POSITIVE_INFINITY;
  const cart = getCart();
  const line = cart.find((c) => c.listingId === listingId);
  if (line) {
    line.qty = Math.min(line.qty + qty, cap);
  } else {
    cart.push({ listingId, qty: Math.min(qty, cap) });
  }
  writeStore(cart);
}

export function removeFromCart(listingId: string): void {
  writeStore(getCart().filter((c) => c.listingId !== listingId));
}

export function clearCart(): void {
  writeStore([]);
}

export function cartCount(): number {
  return getCart().reduce((sum, line) => sum + line.qty, 0);
}

export function checkoutCart(): { orderId: string } {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const orderId = `VDS-${suffix}`;
  clearCart();
  return { orderId };
}
