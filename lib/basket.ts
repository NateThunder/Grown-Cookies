export type BasketStoredItem = {
  slug: string;
  quantity: number;
};

export const TIP_PRESET_OPTIONS = [10, 15, 20] as const;

export type BasketTipPercent = (typeof TIP_PRESET_OPTIONS)[number];

export type BasketTipInput =
  | { mode: "none" }
  | { mode: "percent"; percent: BasketTipPercent }
  | { mode: "custom"; amount: string };

export type BasketTipOption = {
  percent: BasketTipPercent;
  amountCents: number;
};

export type BasketQuoteLine = {
  slug: string;
  name: string;
  image?: string;
  imageAlt?: string;
  isGiftCard: boolean;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type BasketQuote = {
  currency: string;
  lines: BasketQuoteLine[];
  subtotalCents: number;
  shippingCents: number;
  tipCents: number;
  totalCents: number;
  tipOptions: BasketTipOption[];
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeStoredBasketItems(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item): BasketStoredItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const slug = normalizeText((item as { slug?: unknown }).slug);
      const quantity = normalizeInteger((item as { quantity?: unknown }).quantity);

      if (!slug || quantity <= 0) {
        return null;
      }

      return {
        slug,
        quantity: Math.floor(quantity),
      };
    })
    .filter((item): item is BasketStoredItem => item !== null);
}

export function parseMoneyTextToCents(value: unknown) {
  const normalized = normalizeText(value).replace(/[^0-9.]/g, "");

  if (!normalized) {
    return 0;
  }

  const parts = normalized.split(".");
  if (parts.length > 2) {
    return 0;
  }

  const whole = Number.parseInt(parts[0] ?? "0", 10);

  if (!Number.isFinite(whole) || whole < 0) {
    return 0;
  }

  const decimals = (parts[1] ?? "").padEnd(2, "0").slice(0, 2);
  const minorUnits = Number.parseInt(decimals || "0", 10);

  return whole * 100 + minorUnits;
}

export function formatPrice(value: number) {
  return `GBP ${value.toFixed(2)}`;
}

export function formatPriceFromCents(cents: number) {
  return formatPrice(cents / 100);
}
