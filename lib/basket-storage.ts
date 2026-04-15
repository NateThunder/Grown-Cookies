import { normalizeStoredBasketItems, type BasketStoredItem } from "@/lib/basket";

const BASKET_STORAGE_KEY = "grown-cookies-basket";
export const BASKET_UPDATED_EVENT = "grown-cookies:basket-updated";

function readBasketRaw() {
  if (typeof window === "undefined") {
    return "[]";
  }

  return window.localStorage.getItem(BASKET_STORAGE_KEY) ?? "[]";
}

function writeBasketRaw(value: BasketStoredItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(BASKET_UPDATED_EVENT));
}

function createBasketLineId(slug: string) {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${slug}:${randomId}`;
}

export function getBasket() {
  const rawValue = readBasketRaw();
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    parsedValue = [];
  }

  const basket = normalizeStoredBasketItems(parsedValue);
  const normalizedRaw = JSON.stringify(basket);

  if (typeof window !== "undefined" && rawValue !== normalizedRaw) {
    writeBasketRaw(basket);
  }

  return basket;
}

export function getBasketQuantity() {
  return getBasket().reduce((total, item) => total + item.quantity, 0);
}

export function addToBasket(slug: string, quantity: number) {
  const nextQuantity = Math.floor(quantity);

  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return;
  }

  const current = getBasket();
  const existing = current.find((item) => item.slug === slug && !item.giftCardAmountCents);

  const next = existing
    ? current.map((item) =>
        item.lineId === existing.lineId
          ? { ...item, quantity: item.quantity + nextQuantity }
          : item,
      )
    : [...current, { lineId: slug, slug, quantity: nextQuantity }];

  writeBasketRaw(next);
}

export function addGiftCardToBasket(slug: string, amountCents: number) {
  const giftCardAmountCents = Math.floor(amountCents);

  if (!Number.isFinite(giftCardAmountCents) || giftCardAmountCents <= 0) {
    return;
  }

  writeBasketRaw([
    ...getBasket(),
    {
      lineId: createBasketLineId(slug),
      slug,
      quantity: 1,
      giftCardAmountCents,
    },
  ]);
}

export function setBasketQuantity(slug: string, quantity: number) {
  const nextQuantity = Math.floor(quantity);

  if (nextQuantity <= 0) {
    removeFromBasket(slug);
    return;
  }

  const next = getBasket().map((item) =>
    item.slug === slug && !item.giftCardAmountCents
      ? { ...item, quantity: nextQuantity }
      : item,
  );

  writeBasketRaw(next);
}

export function setBasketLineQuantity(lineId: string, quantity: number) {
  const nextQuantity = Math.floor(quantity);

  if (nextQuantity <= 0) {
    removeBasketLine(lineId);
    return;
  }

  const next = getBasket().map((item) =>
    item.lineId === lineId
      ? { ...item, quantity: item.giftCardAmountCents ? 1 : nextQuantity }
      : item,
  );

  writeBasketRaw(next);
}

export function removeFromBasket(slug: string) {
  const next = getBasket().filter((item) => item.slug !== slug);
  writeBasketRaw(next);
}

export function removeBasketLine(lineId: string) {
  const next = getBasket().filter((item) => item.lineId !== lineId);
  writeBasketRaw(next);
}

export function clearBasket() {
  writeBasketRaw([]);
}
