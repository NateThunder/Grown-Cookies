import type { BasketQuoteLine } from "@/lib/basket";

export const ORDER_JOURNEY_CONSENT = {
  accepted: "accepted",
  denied: "denied",
} as const;

export type OrderJourneyEventType = "source" | "shop" | "product_added" | "basket" | "checkout";

export type OrderJourneyEvent = {
  type: OrderJourneyEventType;
  label: string;
  occurredAt: string;
  productSlug?: string;
};

export type OrderJourneySnapshot = {
  consent: (typeof ORDER_JOURNEY_CONSENT)[keyof typeof ORDER_JOURNEY_CONSENT];
  dayKey?: string;
  events?: OrderJourneyEvent[];
};

const EVENT_LABELS: Record<Exclude<OrderJourneyEventType, "source" | "product_added">, string> = {
  shop: "Shop",
  basket: "Basket",
  checkout: "Checkout",
};

function normalizeText(value: unknown, maxLength = 80) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidTimestamp(value: string) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

export function sanitizeOrderJourney(
  input: unknown,
  purchasedLines: BasketQuoteLine[],
): OrderJourneySnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as { consent?: unknown; dayKey?: unknown; events?: unknown };

  if (raw.consent === ORDER_JOURNEY_CONSENT.denied) {
    return { consent: ORDER_JOURNEY_CONSENT.denied };
  }

  if (raw.consent !== ORDER_JOURNEY_CONSENT.accepted) {
    return null;
  }

  const dayKey = normalizeText(raw.dayKey, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || !Array.isArray(raw.events)) {
    return null;
  }

  const purchasedProducts = new Map(
    purchasedLines.map((line) => [normalizeText(line.slug, 120), normalizeText(line.name, 120)]),
  );
  const events: OrderJourneyEvent[] = [];
  const seen = new Set<string>();

  for (const candidate of raw.events.slice(0, 30)) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const event = candidate as {
      type?: unknown;
      label?: unknown;
      occurredAt?: unknown;
      productSlug?: unknown;
    };
    const type = normalizeText(event.type, 30) as OrderJourneyEventType;
    const occurredAt = normalizeText(event.occurredAt, 40);

    if (!isValidTimestamp(occurredAt)) {
      continue;
    }

    let normalizedEvent: OrderJourneyEvent | null = null;

    if (type === "source") {
      const label = normalizeText(event.label, 50);
      if (label) {
        normalizedEvent = { type, label, occurredAt };
      }
    } else if (type === "product_added") {
      const productSlug = normalizeText(event.productSlug, 120);
      const productName = purchasedProducts.get(productSlug);
      if (productSlug && productName) {
        normalizedEvent = {
          type,
          label: `Added ${productName}`,
          occurredAt,
          productSlug,
        };
      }
    } else if (type === "shop" || type === "basket" || type === "checkout") {
      normalizedEvent = { type, label: EVENT_LABELS[type], occurredAt };
    }

    if (!normalizedEvent) {
      continue;
    }

    const dedupeKey = `${normalizedEvent.type}:${normalizedEvent.productSlug ?? normalizedEvent.label}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    events.push(normalizedEvent);
  }

  events.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));

  return {
    consent: ORDER_JOURNEY_CONSENT.accepted,
    dayKey,
    events: events.slice(0, 20),
  };
}

export function parseStoredOrderJourney(value: unknown): OrderJourneySnapshot | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as OrderJourneySnapshot;
    return parsed?.consent === ORDER_JOURNEY_CONSENT.accepted ||
      parsed?.consent === ORDER_JOURNEY_CONSENT.denied
      ? parsed
      : null;
  } catch {
    return null;
  }
}
