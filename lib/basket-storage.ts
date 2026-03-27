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
  const existing = current.find((item) => item.slug === slug);

  const next = existing
    ? current.map((item) =>
        item.slug === slug ? { ...item, quantity: item.quantity + nextQuantity } : item,
      )
    : [...current, { slug, quantity: nextQuantity }];

  writeBasketRaw(next);
}

export function setBasketQuantity(slug: string, quantity: number) {
  const nextQuantity = Math.floor(quantity);

  if (nextQuantity <= 0) {
    removeFromBasket(slug);
    return;
  }

  const next = getBasket().map((item) =>
    item.slug === slug ? { ...item, quantity: nextQuantity } : item,
  );

  writeBasketRaw(next);
}

export function removeFromBasket(slug: string) {
  const next = getBasket().filter((item) => item.slug !== slug);
  writeBasketRaw(next);
}

export function clearBasket() {
  writeBasketRaw([]);
}
