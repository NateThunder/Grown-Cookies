export type BasketItem = {
  slug: string;
  name: string;
  price: string;
  image?: string;
  imageAlt?: string;
  isGiftCard?: boolean;
  quantity: number;
};

const BASKET_STORAGE_KEY = "grown-cookies-basket";
export const BASKET_UPDATED_EVENT = "grown-cookies:basket-updated";

function readBasketRaw() {
  if (typeof window === "undefined") {
    return "[]";
  }

  return window.localStorage.getItem(BASKET_STORAGE_KEY) ?? "[]";
}

function sanitizeBasket(items: unknown) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item): BasketItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Partial<BasketItem>;
      const quantity = Number(candidate.quantity);

      if (
        typeof candidate.slug !== "string" ||
        !candidate.slug ||
        typeof candidate.name !== "string" ||
        typeof candidate.price !== "string" ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        return null;
      }

      return {
        slug: candidate.slug,
        name: candidate.name,
        price: candidate.price,
        image: typeof candidate.image === "string" ? candidate.image : undefined,
        imageAlt: typeof candidate.imageAlt === "string" ? candidate.imageAlt : undefined,
        isGiftCard: typeof candidate.isGiftCard === "boolean" ? candidate.isGiftCard : false,
        quantity: Math.floor(quantity),
      };
    })
    .filter((item): item is BasketItem => item !== null);
}

function writeBasketRaw(value: BasketItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(BASKET_UPDATED_EVENT));
}

export function getBasket() {
  return sanitizeBasket(JSON.parse(readBasketRaw()));
}

export function getBasketQuantity() {
  return getBasket().reduce((total, item) => total + item.quantity, 0);
}

export function parsePrice(price: string) {
  const normalized = price.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getBasketSubtotal(items = getBasket()) {
  return items.reduce((total, item) => total + parsePrice(item.price) * item.quantity, 0);
}

export function formatPrice(value: number) {
  return `GBP ${value.toFixed(2)}`;
}

export function addToBasket(product: Omit<BasketItem, "quantity">, quantity: number) {
  const nextQuantity = Math.floor(quantity);

  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return;
  }

  const current = getBasket();
  const existing = current.find((item) => item.slug === product.slug);

  const next = existing
    ? current.map((item) =>
        item.slug === product.slug ? { ...item, quantity: item.quantity + nextQuantity } : item,
      )
    : [...current, { ...product, quantity: nextQuantity }];

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
