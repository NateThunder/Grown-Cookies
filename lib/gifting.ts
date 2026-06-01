export const NO_GIFTING_CARD_ID = "none";
export const GIFTING_MESSAGE_MAX_LENGTH = 300;

export const GIFTING_CARD_OPTIONS = [
  {
    id: "notecard",
    label: "Notecard",
    selectLabel: "Notecard (+ \u00a33.50 GBP)",
    priceCents: 350,
  },
] as const;

export type GiftingCardId = (typeof GIFTING_CARD_OPTIONS)[number]["id"];

export type BasketLineGifting = {
  cardId: GiftingCardId;
  message?: string;
};

export type ResolvedBasketLineGifting = BasketLineGifting & {
  cardLabel: string;
  cardPriceCents: number;
};

export function getGiftingCardOption(cardId: unknown) {
  return GIFTING_CARD_OPTIONS.find((option) => option.id === cardId) ?? null;
}

export function normalizeGiftingMessage(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, GIFTING_MESSAGE_MAX_LENGTH)
    : "";
}

export function normalizeBasketLineGifting(raw: unknown): BasketLineGifting | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const cardId = (raw as { cardId?: unknown }).cardId;
  const option = getGiftingCardOption(cardId);

  if (!option) {
    return null;
  }

  const message = normalizeGiftingMessage((raw as { message?: unknown }).message);

  return {
    cardId: option.id,
    ...(message ? { message } : {}),
  };
}

export function resolveBasketLineGifting(raw: unknown): ResolvedBasketLineGifting | null {
  const gifting = normalizeBasketLineGifting(raw);

  if (!gifting) {
    return null;
  }

  const option = getGiftingCardOption(gifting.cardId);

  if (!option) {
    return null;
  }

  return {
    ...gifting,
    cardLabel: option.label,
    cardPriceCents: option.priceCents,
  };
}
