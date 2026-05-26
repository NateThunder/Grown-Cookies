import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { ensureCustomerAccountSchema } from "@/lib/customer-profiles";
import {
  CHECKOUT_CURRENCY,
  buildCheckoutQuote,
} from "@/lib/checkout-quote";
import type { BasketQuoteLine, BasketStoredItem, BasketTipInput } from "@/lib/basket";
import {
  finalizeGiftCardRedemptionsForOrder,
  getGiftCardApplicationsForQuote,
  releaseGiftCardRedemptionsForOrder,
  reserveGiftCardRedemptionsForOrder,
  restoreFinalizedGiftCardRedemptionsForOrder,
} from "@/lib/gift-cards";
import {
  UK_POSTAL_SHIPPING_METHOD,
  type DispatchSelection,
} from "@/lib/dispatch";
import { validateDispatchSelectionWithHolidayExclusions } from "@/lib/dispatch-availability";
import { DEFAULT_DELIVERY_COST_CENTS, getDispatchSettings } from "@/lib/store-settings";

const STRIPE_CHECKOUT_ORDER_PREFIX = "order";

export const STRIPE_CHECKOUT_COSTS = {
  currency: CHECKOUT_CURRENCY,
  defaultShippingCents: DEFAULT_DELIVERY_COST_CENTS,
} as const;

export const STRIPE_CHECKOUT_ORDER_STATUS = {
  pending: "pending",
  paid: "paid",
  failed: "failed",
  expired: "expired",
  refunded: "refunded",
} as const;

export const PENDING_ORDER_WARNING_MINUTES = 2;
export const PENDING_ORDER_EXPIRY_MINUTES = 5;

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
  dispatch?: DispatchSelection | null;
  giftCardCodes?: string[];
  initialStatus?: typeof STRIPE_CHECKOUT_ORDER_STATUS.pending | typeof STRIPE_CHECKOUT_ORDER_STATUS.paid;
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
  giftCardRedeemedCents: number;
  stripeAmountCents: number;
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

export async function expireStalePendingOrders() {
  if (!hasCloudflareD1Config()) {
    return 0;
  }

  await ensureCustomerAccountSchema();

  const staleOrders = await queryCloudflareD1<{ id: number; public_id: string }>(
    `SELECT id, public_id
     FROM orders
     WHERE status = ?
        OR (status = ? AND datetime(created_at) <= datetime('now', ?))`,
    [
      STRIPE_CHECKOUT_ORDER_STATUS.expired,
      STRIPE_CHECKOUT_ORDER_STATUS.pending,
      `-${PENDING_ORDER_EXPIRY_MINUTES} minutes`,
    ],
    { cache: "no-store" },
  );

  if (staleOrders.length === 0) {
    return 0;
  }

  const orderIds = staleOrders
    .map((order) => order.id)
    .filter((id) => Number.isFinite(id) && id > 0);

  if (orderIds.length === 0) {
    return 0;
  }

  const orderPlaceholders = orderIds.map(() => "?").join(", ");

  const result = await executeCloudflareD1(
    `UPDATE orders
     SET status = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE status = ?
       AND id IN (${orderPlaceholders})`,
    [
      STRIPE_CHECKOUT_ORDER_STATUS.expired,
      STRIPE_CHECKOUT_ORDER_STATUS.pending,
      ...orderIds,
    ],
  );

  await Promise.all(staleOrders.map((order) => releaseGiftCardRedemptionsForOrder(order.public_id)));

  const changedRows =
    typeof result.meta?.changes === "number"
      ? result.meta.changes
      : typeof result.meta?.changes === "string"
        ? Number.parseInt(result.meta.changes, 10)
        : 0;

  return Number.isFinite(changedRows) ? changedRows : 0;
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
  const quotePromise = buildCheckoutQuote({
    items: payload.items,
    tip: payload.tip,
    dispatch: payload.dispatch,
    giftCardCodes: payload.giftCardCodes,
  });
  const schemaPromise = ensureCustomerAccountSchema();
  const quote = await quotePromise;
  const requiresDispatch = quote.lines.some((line) => !line.isGiftCard);
  const redemptionApplications = await getGiftCardApplicationsForQuote({
    codes: payload.giftCardCodes ?? [],
    applicableCents: quote.giftCardApplicableCents,
  });
  const giftCardRedeemedCents = redemptionApplications.reduce(
    (sum, application) => sum + application.appliedCents,
    0,
  );
  const stripeAmountCents = Math.max(0, quote.totalCents - giftCardRedeemedCents);

  if (giftCardRedeemedCents !== quote.giftCardAppliedCents) {
    throw new Error("Gift card balance changed. Review your total and try again.");
  }

  const dispatchSettings = requiresDispatch ? await getDispatchSettings() : null;
  const dispatch = dispatchSettings
    ? await validateDispatchSelectionWithHolidayExclusions(payload.dispatch ?? null, dispatchSettings, {
        required: true,
      })
    : null;

  await schemaPromise;

  const orderPublicId = generateOrderPublicId();
  const initialStatus = payload.initialStatus ?? STRIPE_CHECKOUT_ORDER_STATUS.pending;
  const itemsSnapshot = JSON.stringify({
    lines: quote.lines,
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    tipCents: quote.tipCents,
    totalCents: quote.totalCents,
    giftCardApplicableCents: quote.giftCardApplicableCents,
    giftCardRedeemedCents,
    stripeAmountCents,
    giftCardApplications: quote.giftCardApplications,
    tipCurrency: quote.currency,
    contact: {
      email: contactEmail,
      phone: normalizeText(payload.contact.phone),
    },
    delivery,
    fulfilmentMethod: dispatch?.method ?? null,
    dispatchDate: dispatch?.dispatchDate ?? null,
  });

  const orderInsertResult = await executeCloudflareD1(
    `INSERT INTO orders (
       public_id,
       status,
       currency,
       subtotal_cents,
       shipping_cents,
       tip_cents,
       total_cents,
       gift_card_redeemed_cents,
       stripe_amount_cents,
       email,
       phone,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country,
       fulfilment_method,
       dispatch_date,
       supabase_user_id,
       customer_profile_id,
       items_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderPublicId,
      initialStatus,
      CHECKOUT_CURRENCY,
      quote.subtotalCents,
      quote.shippingCents,
      quote.tipCents,
      quote.totalCents,
      giftCardRedeemedCents,
      stripeAmountCents,
      contactEmail,
      normalizeText(payload.contact.phone),
      delivery.firstName,
      delivery.lastName,
      delivery.address,
      delivery.flatNumber,
      delivery.city,
      delivery.postcode,
      delivery.country,
      dispatch?.method ?? (requiresDispatch ? UK_POSTAL_SHIPPING_METHOD : null),
      dispatch?.dispatchDate ?? null,
      normalizeText(payload.customer?.supabaseUserId) || null,
      payload.customer?.customerProfileId ?? null,
      itemsSnapshot,
    ],
  );

  const insertedOrderId =
    typeof orderInsertResult.meta?.last_row_id === "number"
      ? orderInsertResult.meta.last_row_id
      : typeof orderInsertResult.meta?.last_row_id === "string"
        ? Number.parseInt(orderInsertResult.meta.last_row_id, 10)
        : NaN;

  let orderId = Number.isFinite(insertedOrderId) ? insertedOrderId : 0;

  if (!orderId) {
    const orderRows = await queryCloudflareD1<{ id: number }>(
      `SELECT id FROM orders WHERE public_id = ? LIMIT 1`,
      [orderPublicId],
    );
    orderId = orderRows[0]?.id ?? 0;
  }

  if (!orderId) {
    throw new Error("The order could not be created.");
  }

  if (quote.lines.length > 0) {
    await executeCloudflareD1(
      `INSERT INTO order_items (
         order_id,
         product_slug,
         product_name,
         unit_price_cents,
         quantity,
         line_total_cents
       )
       VALUES ${quote.lines.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
      quote.lines.flatMap((line) => [
        orderId,
        line.slug,
        line.name,
        line.unitPriceCents,
        line.quantity,
        line.lineTotalCents,
      ]),
    );
  }

  try {
    await reserveGiftCardRedemptionsForOrder({
      orderId,
      orderPublicId,
      applications: redemptionApplications,
    });

    if (initialStatus === STRIPE_CHECKOUT_ORDER_STATUS.paid) {
      await finalizeGiftCardRedemptionsForOrder(orderPublicId);
    }
  } catch (error) {
    await releaseGiftCardRedemptionsForOrder(orderPublicId);
    await executeCloudflareD1(
      `UPDATE orders
       SET status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [STRIPE_CHECKOUT_ORDER_STATUS.failed, orderId],
    );
    throw error;
  }

  return {
    orderPublicId,
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    tipCents: quote.tipCents,
    totalCents: quote.totalCents,
    giftCardRedeemedCents,
    stripeAmountCents,
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

  const rows = await queryCloudflareD1<{ id: number; public_id: string; status: string }>(
    `SELECT id, public_id, status
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

  const resolvedOrderPublicId = normalizeText(row.public_id) || normalizeText(orderPublicId);

  if (status === STRIPE_CHECKOUT_ORDER_STATUS.paid) {
    await finalizeGiftCardRedemptionsForOrder(resolvedOrderPublicId);
  } else if (
    status === STRIPE_CHECKOUT_ORDER_STATUS.failed ||
    status === STRIPE_CHECKOUT_ORDER_STATUS.expired
  ) {
    await releaseGiftCardRedemptionsForOrder(resolvedOrderPublicId);
  } else if (status === STRIPE_CHECKOUT_ORDER_STATUS.refunded) {
    await restoreFinalizedGiftCardRedemptionsForOrder(resolvedOrderPublicId);
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
