/** Shared listing/rarity microcopy + the single rarity color language. */

export const RARITY_CLASSES: Record<string, string> = {
  common: "text-zinc-400 border-zinc-600",
  uncommon: "text-sky-400 border-sky-800",
  rare: "text-violet-400 border-violet-800",
  epic: "text-fuchsia-400 border-fuchsia-800",
  showcase: "text-amber-400 border-amber-700",
};

export function rarityClass(rarity: string | null | undefined): string {
  if (!rarity) return "text-zinc-400 border-zinc-600";
  return RARITY_CLASSES[rarity.toLowerCase()] ?? "text-zinc-400 border-zinc-600";
}

export const PRINTING_LABELS: Record<string, string> = {
  standard: "Standard",
  alt_art: "Alt Art",
  signature: "Signature",
};

export function printingLabel(p: string | null | undefined): string {
  if (!p) return "";
  return PRINTING_LABELS[p] ?? p;
}

export const CONDITION_LABELS: Record<string, string> = {
  nm: "NM",
  lp: "LP",
  mp: "MP",
  psa9: "PSA 9",
};

export function conditionLabel(c: string | null | undefined): string {
  if (!c) return "";
  return CONDITION_LABELS[c] ?? c;
}

export const LISTING_TYPES = [
  "legend",
  "unit",
  "spell",
  "rune",
  "battlefield",
  "gear",
  "token",
  "sealed",
  "bulk",
] as const;

export const TYPE_LABELS: Record<string, string> = {
  legend: "Legend",
  unit: "Unit",
  spell: "Spell",
  rune: "Rune",
  battlefield: "Battlefield",
  gear: "Gear",
  token: "Token",
  sealed: "Sealed",
  bulk: "Bulk",
  wtb: "Want",
};

export function typeLabel(t: string | null | undefined): string {
  if (!t) return "";
  return TYPE_LABELS[t] ?? t;
}

export const PICKUP_LABELS: Record<string, string> = {
  "games-haven-pl": "Games Haven PL",
  hobbystation: "Hobby Station",
  "jurong-east-mrt": "Jurong East MRT",
  mail: "Mail",
};

export function pickupLabel(p: string | null | undefined): string {
  if (!p) return "";
  return PICKUP_LABELS[p] ?? p;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "EN",
  zh: "简中 (ZH)",
};

export function languageLabel(l: string | null | undefined): string {
  if (!l) return "—";
  return LANGUAGE_LABELS[l] ?? l;
}
