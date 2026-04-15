export const GIFT_CARD_PRESET_AMOUNTS_CENTS = [2000, 4000, 6000] as const;
export const MIN_GIFT_CARD_AMOUNT_CENTS = 2000;

export type GiftCardAmountValidation = {
  amountCents: number;
  error: string;
};

function normalizeAmountText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^GBP\s*/i, "")
    .replace(/^£\s*/, "")
    .trim();
}

export function formatGiftCardAmount(cents: number) {
  const amount = Number.isFinite(cents) ? cents : 0;
  const pounds = amount / 100;

  if (Number.isInteger(pounds)) {
    return `£${pounds}`;
  }

  return `£${pounds.toFixed(2)}`;
}

export function validateGiftCardAmountCents(value: unknown): GiftCardAmountValidation {
  const amountCents =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return {
      amountCents: 0,
      error: "Enter a gift card amount.",
    };
  }

  if (amountCents % 100 !== 0) {
    return {
      amountCents: 0,
      error: "Enter a whole pound amount.",
    };
  }

  if (amountCents < MIN_GIFT_CARD_AMOUNT_CENTS) {
    return {
      amountCents: 0,
      error: `Gift card amount must be at least ${formatGiftCardAmount(MIN_GIFT_CARD_AMOUNT_CENTS)}.`,
    };
  }

  return {
    amountCents,
    error: "",
  };
}

export function parseCustomGiftCardAmount(value: unknown): GiftCardAmountValidation {
  const normalized = normalizeAmountText(value);

  if (!normalized) {
    return {
      amountCents: 0,
      error: "Enter a gift card amount.",
    };
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      amountCents: 0,
      error: "Enter a whole pound amount.",
    };
  }

  const pounds = Number.parseInt(normalized, 10);

  if (!Number.isSafeInteger(pounds)) {
    return {
      amountCents: 0,
      error: "Enter a valid gift card amount.",
    };
  }

  return validateGiftCardAmountCents(pounds * 100);
}
