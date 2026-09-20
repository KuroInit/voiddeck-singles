import { SEED_LISTINGS, type Listing } from "../data/listings";

const USER_LISTINGS_KEY = "vds_user_listings";
const USER_WTB_KEY = "vds_user_wtb";
const CART_KEY = "vds_cart";

type CartLine = { listingId: string; qty: number };

// All storage access is call-time and guarded: on the server (typeof window
// === "undefined") everything degrades to seeds / empty. JSON.parse is always
// wrapped — a corrupted localStorage entry must never throw in render paths.
function readStore(key: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: cart/user-listing writes are best-effort
  }
}

function readUserRows(mode: "sale" | "wtb"): Listing[] {
  const key = mode === "wtb" ? USER_WTB_KEY : USER_LISTINGS_KEY;
  return readStore(key).filter(
    (row): row is Listing =>
      typeof row === "object" &&
      row !== null &&
      (row as Listing).source === "user" &&
      (row as Listing).mode === mode &&
      typeof (row as Listing).id === "string",
  );
}

export function getAllListings(): Listing[] {
  return [...SEED_LISTINGS, ...readUserRows("sale"), ...readUserRows("wtb")];
}

export function getListings(mode: "sale" | "wtb"): Listing[] {
  return [...SEED_LISTINGS.filter((l) => l.mode === mode), ...readUserRows(mode)];
}

export function getWtbPosts(): Listing[] {
  return getListings("wtb");
}

// Newest-first within the user rows: new entries are unshifted to the front.
export function addListing(input: {
  cardName: string;
  cardCode: string | null;
  printing: Listing["printing"];
  rarity: Listing["rarity"];
  type: Listing["type"];
  condition: Listing["condition"];
  language: Listing["language"];
  qty: number;
  priceSgd: number;
  grade?: string | null;
  pickup: Listing["pickup"];
  note: string;
}): Listing {
  const listing: Listing = {
    id: `U-${Date.now()}`,
    cardName: input.cardName,
    cardCode: input.cardCode,
    set: "OGN",
    printing: input.printing,
    rarity: input.rarity,
    type: input.type,
    condition: input.condition,
    language: input.language,
    qty: input.qty,
    priceSgd: input.priceSgd,
    grade: input.grade ?? null,
    seller: "you",
    pickup: input.pickup,
    note: input.note,
    mode: "sale",
    source: "user",
  };
  writeStore(USER_LISTINGS_KEY, [listing, ...readUserRows("sale")]);
  return listing;
}

export function addWtbPost(input: {
  cardName: string;
  cardCode: string | null;
  qty?: number;
  budgetSgd: number;
  note: string;
}): Listing {
  const listing: Listing = {
    id: `U-${Date.now()}`,
    cardName: input.cardName,
    cardCode: input.cardCode,
    set: "OGN",
    printing: "standard",
    rarity: "common",
    type: "unit",
    condition: "nm",
    language: null,
    qty: input.qty ?? 1,
    priceSgd: 0,
    grade: null,
    seller: "you",
    pickup: "mail",
    note: input.note,
    mode: "wtb",
    source: "user",
    budgetSgd: input.budgetSgd,
  };
  writeStore(USER_WTB_KEY, [listing, ...readUserRows("wtb")]);
  return listing;
}

const CONDITION_PRIORITY: Record<Listing["condition"], number> = {
  nm: 0,
  lp: 1,
  mp: 2,
  psa9: 3,
};

export function bestListingFor(cardCode: string | null, budgetSgd?: number): Listing | null {
  if (cardCode === null) return null;
  const candidates = getListings("sale").filter(
    (l) =>
      l.cardCode === cardCode &&
      l.qty > 0 &&
      (budgetSgd === undefined || l.priceSgd <= budgetSgd),
  );
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      a.priceSgd - b.priceSgd ||
      CONDITION_PRIORITY[a.condition] - CONDITION_PRIORITY[b.condition] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return candidates[0];
}

export function getCart(): CartLine[] {
  return readStore(CART_KEY).filter(
    (line): line is CartLine =>
      typeof line === "object" &&
      line !== null &&
      typeof (line as CartLine).listingId === "string" &&
      typeof (line as CartLine).qty === "number",
  );
}

export function addToCart(listingId: string, qty = 1): void {
  if (qty <= 0) return;
  const listing = getAllListings().find((l) => l.id === listingId);
  if (!listing || listing.qty <= 0) return;
  const cart = getCart();
  const line = cart.find((c) => c.listingId === listingId);
  if (line) {
    line.qty = Math.min(line.qty + qty, listing.qty);
  } else {
    cart.push({ listingId, qty: Math.min(qty, listing.qty) });
  }
  writeStore(CART_KEY, cart);
}

export function removeFromCart(listingId: string): void {
  writeStore(CART_KEY, getCart().filter((c) => c.listingId !== listingId));
}

export function clearCart(): void {
  writeStore(CART_KEY, []);
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

export function isUserListing(l: Listing): boolean {
  return l.source === "user";
}
