export type BasketStoredItem = {
  lineId: string;
  slug: string;
  quantity: number;
  giftCardAmountCents?: number;
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
  lineId: string;
  slug: string;
  name: string;
  image?: string;
  imageAlt?: string;
  isGiftCard: boolean;
  giftCardAmountCents?: number;
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

function normalizeStrictInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }

  const normalized = normalizeText(value);

  if (!/^-?\d+$/.test(normalized)) {
    return 0;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function normalizeStoredBasketItems(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item, index): BasketStoredItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const slug = normalizeText((item as { slug?: unknown }).slug);
      const quantity = normalizeInteger((item as { quantity?: unknown }).quantity);
      const rawGiftCardAmountCents = (item as { giftCardAmountCents?: unknown })
        .giftCardAmountCents;
      const hasGiftCardAmount = rawGiftCardAmountCents !== undefined;
      const giftCardAmountCents = hasGiftCardAmount
        ? normalizeStrictInteger(rawGiftCardAmountCents)
        : 0;

      if (!slug || quantity <= 0) {
        return null;
      }

      const fallbackLineId =
        giftCardAmountCents > 0 ? `${slug}:${giftCardAmountCents}:${index}` : slug;
      const lineId =
        normalizeText((item as { lineId?: unknown }).lineId) || fallbackLineId;

      return {
        lineId,
        slug,
        quantity: giftCardAmountCents > 0 ? 1 : Math.floor(quantity),
        ...(hasGiftCardAmount ? { giftCardAmountCents } : {}),
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
  return `£${value.toFixed(2)}`;
}

export function formatPriceFromCents(cents: number) {
  return formatPrice(cents / 100);
}
