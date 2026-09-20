import cardsJson from "./cards.json";

export type Card = {
  cardCode: string;
  fullName: string;
  name: string;
  subtitle: string | null;
  setCode: string;
  cardSet: string;
  cardNumber: string;
  rarity: string;
  domain: string;
  domains: string[];
  cardType: string;
  energy: number | null;
  power: number | null;
  might: number | null;
  ability: string | null;
  imageUrl: string | null;
};

type RawCard = Card & { rarity: string; cardType: string };

export const CARDS: Card[] = (cardsJson as RawCard[]).map((raw) => ({
  ...raw,
  rarity: raw.rarity.toLowerCase(),
  cardType: raw.cardType.toLowerCase(),
  domains: raw.domains ?? [],
}));

const CARDS_BY_CODE = new Map(CARDS.map((card) => [card.cardCode, card]));

export function findCard(cardCode: string | null): Card | null {
  if (cardCode === null) return null;
  return CARDS_BY_CODE.get(cardCode) ?? null;
}
