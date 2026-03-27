import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { attachOrderToCustomerProfile, ensureCustomerAccountSchema } from "@/lib/customer-profiles";
import {
  CHECKOUT_CURRENCY,
  buildCheckoutQuote,
} from "@/lib/checkout-quote";
import type { BasketQuoteLine, BasketStoredItem, BasketTipInput } from "@/lib/basket";
import { DEFAULT_DELIVERY_COST_CENTS } from "@/lib/store-settings";

const STRIPE_CHECKOUT_ORDER_PREFIX = "order";

export const STRIPE_CHECKOUT_COSTS = {
  currency: CHECKOUT_CURRENCY,
  defaultShippingCents: DEFAULT_DELIVERY_COST_CENTS,
} as const;

export const STRIPE_CHECKOUT_ORDER_STATUS = {
  pending: "pending",
  paid: "paid",
  failed: "failed",
} as const;

export type StripeCheckoutOrderStatus = (typeof STRIPE_CHECKOUT_ORDER_STATUS)[keyof typeof STRIPE_CHECKOUT_ORDER_STATUS];

export type StripeCheckoutLineInput = {
  slug: string;
  quantity: number;
};

export type StripeCheckoutContactInput = {
  email: string;
  phone?: string;
};

export type StripeCheckoutDeliveryInput = {
  firstName: string;
  lastName: string;
  address: string;
  flatNumber?: string;
  city: string;
  postcode: string;
  country: string;
};

export type StripeCheckoutPayload = {
  items: BasketStoredItem[];
  contact: StripeCheckoutContactInput;
  delivery: StripeCheckoutDeliveryInput;
  tip: BasketTipInput;
  customer?: {
    supabaseUserId: string;
    customerProfileId: number;
  };
};

export type StripeCheckoutOrderDraft = {
  orderPublicId: string;
  subtotalCents: number;
  shippingCents: number;
  tipCents: number;
  totalCents: number;
  lines: BasketQuoteLine[];
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function generateOrderPublicId() {
  const suffix = (globalThis.crypto?.randomUUID?.() || `${Math.random()}`).replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return `${STRIPE_CHECKOUT_ORDER_PREFIX}_${Date.now()}_${suffix}`;
}

function sanitizeDelivery(input: StripeCheckoutDeliveryInput) {
  return {
    firstName: normalizeText(input.firstName),
    lastName: normalizeText(input.lastName),
    address: normalizeText(input.address),
    flatNumber: normalizeText(input.flatNumber),
    city: normalizeText(input.city),
    postcode: normalizeText(input.postcode),
    country: normalizeText(input.country),
  };
}

export async function createPendingStripeOrder(payload: StripeCheckoutPayload): Promise<StripeCheckoutOrderDraft> {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  const contactEmail = normalizeText(payload.contact.email);
  if (!contactEmail) {
    throw new Error("Email or phone is required.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Your basket is empty.");
  }

  const delivery = sanitizeDelivery(payload.delivery);
  const quote = await buildCheckoutQuote({
    items: payload.items,
    tip: payload.tip,
  });

  await ensureCustomerAccountSchema();

  const orderPublicId = generateOrderPublicId();
  const itemsSnapshot = JSON.stringify({
    lines: quote.lines,
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    tipCents: quote.tipCents,
    totalCents: quote.totalCents,
    tipCurrency: quote.currency,
    contact: {
      email: contactEmail,
      phone: normalizeText(payload.contact.phone),
    },
    delivery,
  });

  await executeCloudflareD1(
    `INSERT INTO orders (
       public_id,
       status,
       currency,
       subtotal_cents,
       shipping_cents,
       tip_cents,
       total_cents,
       email,
       phone,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country,
       items_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderPublicId,
      STRIPE_CHECKOUT_ORDER_STATUS.pending,
      CHECKOUT_CURRENCY,
      quote.subtotalCents,
      quote.shippingCents,
      quote.tipCents,
      quote.totalCents,
      contactEmail,
      normalizeText(payload.contact.phone),
      delivery.firstName,
      delivery.lastName,
      delivery.address,
      delivery.flatNumber,
      delivery.city,
      delivery.postcode,
      delivery.country,
      itemsSnapshot,
    ],
  );

  if (payload.customer?.supabaseUserId && payload.customer.customerProfileId) {
    await attachOrderToCustomerProfile({
      orderPublicId,
      supabaseUserId: normalizeText(payload.customer.supabaseUserId),
      customerProfileId: payload.customer.customerProfileId,
    });
  }

  const orderRows = await queryCloudflareD1<{ id: number }>(`SELECT id FROM orders WHERE public_id = ? LIMIT 1`, [
    orderPublicId,
  ]);
  const orderId = orderRows[0]?.id;

  if (!orderId) {
    throw new Error("The order could not be created.");
  }

  for (const line of quote.lines) {
    await executeCloudflareD1(
      `INSERT INTO order_items (
         order_id,
         product_slug,
         product_name,
         unit_price_cents,
         quantity,
         line_total_cents
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, line.slug, line.name, line.unitPriceCents, line.quantity, line.lineTotalCents],
    );
  }

  return {
    orderPublicId,
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    tipCents: quote.tipCents,
    totalCents: quote.totalCents,
    lines: quote.lines,
  };
}

export async function setOrderPaymentIntentId(orderPublicId: string, paymentIntentId: string) {
  await ensureCustomerAccountSchema();

  await executeCloudflareD1(
    `UPDATE orders
     SET stripe_payment_intent_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE public_id = ?`,
    [paymentIntentId, orderPublicId],
  );
}

export async function updateOrderStatusByIdentifiers(params: {
  orderPublicId?: string;
  paymentIntentId?: string;
  status: StripeCheckoutOrderStatus;
}) {
  const { orderPublicId, paymentIntentId, status } = params;

  if (!orderPublicId && !paymentIntentId) {
    return false;
  }

  await ensureCustomerAccountSchema();

  const rows = await queryCloudflareD1<{ id: number; status: string }>(
    `SELECT id, status
     FROM orders
     WHERE public_id = ? OR stripe_payment_intent_id = ?
     LIMIT 1`,
    [normalizeText(orderPublicId), normalizeText(paymentIntentId)],
  );

  if (rows.length === 0) {
    return false;
  }

  const row = rows[0];
  if (status === STRIPE_CHECKOUT_ORDER_STATUS.failed && row.status === STRIPE_CHECKOUT_ORDER_STATUS.paid) {
    return true;
  }

  await executeCloudflareD1(
    `UPDATE orders
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, row.id],
  );

  return true;
}

export async function registerWebhookEvent(input: {
  stripeEventId: string;
  orderPublicId?: string;
  eventType: string;
  payload: unknown;
}) {
  await ensureCustomerAccountSchema();

  const eventId = normalizeText(input.stripeEventId);
  if (!eventId) {
    return false;
  }

  const existing = await queryCloudflareD1<{ id: number }>(
    `SELECT id FROM order_webhook_events WHERE stripe_event_id = ? LIMIT 1`,
    [eventId],
  );

  if (existing.length > 0) {
    return false;
  }

  await executeCloudflareD1(
    `INSERT INTO order_webhook_events (stripe_event_id, order_public_id, event_type, payload_json)
     VALUES (?, ?, ?, ?)`,
    [
      eventId,
      normalizeText(input.orderPublicId),
      normalizeText(input.eventType),
      JSON.stringify(input.payload),
    ],
  );

  return true;
}
