import {
  TIP_PRESET_OPTIONS,
  normalizeStoredBasketItems,
  parseMoneyTextToCents,
  type BasketQuote,
  type BasketQuoteLine,
  type BasketStoredItem,
  type BasketTipInput,
  type BasketTipPercent,
} from "@/lib/basket";
import { validateGiftCardAmountCents } from "@/lib/gift-card-amounts";
import { getAllProducts } from "@/lib/products";
import { getDeliveryCostCents } from "@/lib/store-settings";

export const CHECKOUT_CURRENCY = "gbp";

const allowedTipPercents = new Set<number>(TIP_PRESET_OPTIONS);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseQuoteItems(raw: unknown) {
  const items = normalizeStoredBasketItems(raw);

  if (items.length === 0) {
    throw new Error("Your basket is empty.");
  }

  return items;
}

export function parseQuoteTip(raw: unknown): BasketTipInput {
  if (!raw || typeof raw !== "object") {
    return { mode: "none" };
  }

  const tip = raw as { mode?: unknown; percent?: unknown; amount?: unknown };
  const mode = normalizeText(tip.mode).toLowerCase();

  if (mode === "percent") {
    const percent = normalizeInteger(tip.percent);

    if (!allowedTipPercents.has(percent)) {
      throw new Error("Tip option is invalid.");
    }

    return {
      mode: "percent",
      percent: percent as BasketTipPercent,
    };
  }

  if (mode === "custom") {
    return {
      mode: "custom",
      amount: String(tip.amount ?? ""),
    };
  }

  return { mode: "none" };
}

function getTipCents(subtotalCents: number, tip: BasketTipInput) {
  if (tip.mode === "percent") {
    return Math.round(subtotalCents * (tip.percent / 100));
  }

  if (tip.mode === "custom") {
    return Math.max(0, parseMoneyTextToCents(tip.amount));
  }

  return 0;
}

export function parsePriceToMinorUnits(priceText: string) {
  const normalized = normalizeText(priceText).replace(/[^0-9.]/g, "");

  if (!normalized) {
    return 0;
  }

  const parts = normalized.split(".");
  const whole = Number.parseInt(parts[0] ?? "0", 10) || 0;
  const decimals = (parts[1] ?? "").padEnd(2, "0").slice(0, 2);
  const minorUnits = Number.parseInt(decimals || "0", 10);

  return whole * 100 + minorUnits;
}

export async function buildCheckoutQuote({
  items,
  tip,
}: {
  items: BasketStoredItem[];
  tip: BasketTipInput;
}): Promise<BasketQuote> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Your basket is empty.");
  }

  const [products, deliveryShippingCents] = await Promise.all([
    getAllProducts(),
    getDeliveryCostCents(),
  ]);
  const productMap = new Map(products.map((product) => [product.slug, product]));
  const lines: BasketQuoteLine[] = [];
  const standardItems = new Map<string, { lineId: string; quantity: number }>();

  for (const item of items) {
    const slug = normalizeText(item.slug);
    const rawLineId = normalizeText(item.lineId);
    const lineId = rawLineId || slug;
    const quantity = Math.floor(Number(item.quantity));
    const hasGiftCardAmount = item.giftCardAmountCents !== undefined;

    if (!slug || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Invalid basket item.");
    }

    const product = productMap.get(slug);

    if (!product) {
      throw new Error("Your basket contains invalid products.");
    }

    if (product.isGiftCard) {
      if (!hasGiftCardAmount) {
        throw new Error("Select a gift card amount before checkout.");
      }

      const validation = validateGiftCardAmountCents(item.giftCardAmountCents);

      if (validation.error) {
        throw new Error(validation.error);
      }

      lines.push({
        lineId: rawLineId || `${slug}:${validation.amountCents}:${lines.length}`,
        slug,
        name: product.name,
        image: product.image,
        imageAlt: product.imageAlt,
        isGiftCard: true,
        giftCardAmountCents: validation.amountCents,
        unitPriceCents: validation.amountCents,
        quantity: 1,
        lineTotalCents: validation.amountCents,
      });
      continue;
    }

    if (hasGiftCardAmount) {
      throw new Error("Gift card amount is only valid for gift card products.");
    }

    const existing = standardItems.get(slug);
    standardItems.set(slug, {
      lineId: existing?.lineId ?? lineId,
      quantity: (existing?.quantity ?? 0) + quantity,
    });
  }

  for (const [slug, item] of standardItems) {
    const product = productMap.get(slug);

    if (!product) {
      throw new Error("Your basket contains invalid products.");
    }

    const unitPriceCents = parsePriceToMinorUnits(product.price);
    const lineTotalCents = unitPriceCents * item.quantity;

    if (!Number.isFinite(unitPriceCents) || lineTotalCents < 0) {
      throw new Error("Invalid product price.");
    }

    lines.push({
      lineId: item.lineId,
      slug,
      name: product.name,
      image: product.image,
      imageAlt: product.imageAlt,
      isGiftCard: false,
      unitPriceCents,
      quantity: item.quantity,
      lineTotalCents,
    });
  }

  if (lines.length === 0) {
    throw new Error("Your basket is empty.");
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const hasPhysicalProducts = lines.some((line) => !line.isGiftCard);
  const shippingCents = hasPhysicalProducts ? deliveryShippingCents : 0;
  const tipCents = getTipCents(subtotalCents, tip);

  return {
    currency: CHECKOUT_CURRENCY,
    lines,
    subtotalCents,
    shippingCents,
    tipCents,
    totalCents: subtotalCents + shippingCents + tipCents,
    tipOptions: TIP_PRESET_OPTIONS.map((percent) => ({
      percent,
      amountCents: Math.round(subtotalCents * (percent / 100)),
    })),
  };
}
