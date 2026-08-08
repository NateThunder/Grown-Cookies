import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { ensureCustomerAccountSchema } from "@/lib/customer-profiles";
import { sendCollectedOrderEmail, sendDeliveredOrderEmail } from "@/lib/order-notifications";
import { BAKERY_COLLECTION_METHOD, formatDispatchDate, formatDispatchMethod } from "@/lib/dispatch";
import {
  expireStalePendingOrders,
  PENDING_ORDER_WARNING_MINUTES,
  STRIPE_CHECKOUT_ORDER_STATUS,
} from "@/lib/stripe-checkout";
import { parseStoredOrderJourney, type OrderJourneySnapshot } from "@/lib/order-journey";

export type AdminOrderSummary = {
  orderId: string;
  status: string;
  email: string;
  customerName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  deliveryAddress: string;
  fulfilmentMethod: string;
  fulfilmentMethodLabel: string;
  dispatchDate: string;
  dispatchDateLabel: string;
  collectionAddress: string;
  collectionWindow: string;
  itemCount: number;
  itemsSummary: string;
  totalCents: number;
  giftCardRedeemedCents: number;
  stripeAmountCents: number;
  currency: string;
  createdAt: string;
  paidAt: string;
  deliveredAt: string;
  collectedAt: string;
  isPendingWarning: boolean;
  items: AdminOrderItem[];
  giftCardRedemptions: AdminOrderGiftCardRedemption[];
  orderJourney: OrderJourneySnapshot | null;
};

export type AdminOrderItem = {
  slug: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  gifting?: {
    cardId: string;
    cardLabel: string;
    cardPriceCents: number;
    message: string;
  };
};

export type AdminOrderGiftCardRedemption = {
  code: string;
  amountCents: number;
  status: string;
};

type AdminOrderRow = {
  id: number;
  public_id: string;
  status: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  fulfilment_method: string | null;
  dispatch_date: string | null;
  collection_venue: string | null;
  collection_address_line1: string | null;
  collection_city: string | null;
  collection_postcode: string | null;
  collection_window_start: string | null;
  collection_window_end: string | null;
  collected_at: string | null;
  total_cents: number;
  gift_card_redeemed_cents: number | null;
  stripe_amount_cents: number | null;
  currency: string;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  item_count: number | null;
  items_summary: string | null;
  order_journey_json: string | null;
};

type AdminOrderGiftCardRedemptionRow = {
  order_id: number;
  code: string | null;
  amount_pence: number | null;
  status: string | null;
};

type AdminOrderItemRow = {
  order_id: number;
  product_slug: string | null;
  product_name: string | null;
  unit_price_cents: number | null;
  quantity: number | null;
  line_total_cents: number | null;
  gifting_card_id: string | null;
  gifting_card_label: string | null;
  gifting_card_price_cents: number | null;
  gifting_message: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDeliveryAddress(row: AdminOrderRow) {
  return [
    normalizeText(row.address_line1),
    normalizeText(row.address_line2),
    normalizeText(row.city),
    normalizeText(row.postcode),
    normalizeText(row.country),
  ]
    .filter(Boolean)
    .join(", ");
}

function getPendingAgeMinutes(createdAt: string) {
  const createdAtTime = new Date(createdAt).getTime();

  if (Number.isNaN(createdAtTime)) {
    return 0;
  }

  return Math.max(0, (Date.now() - createdAtTime) / 60000);
}

function mapOrderItemRow(row: AdminOrderItemRow): AdminOrderItem | null {
  const name = normalizeText(row.product_name);

  if (!name) {
    return null;
  }

  return {
    slug: normalizeText(row.product_slug),
    name,
    quantity: Math.max(0, normalizeInteger(row.quantity)),
    unitPriceCents: Math.max(0, normalizeInteger(row.unit_price_cents)),
    lineTotalCents: Math.max(0, normalizeInteger(row.line_total_cents)),
    ...(normalizeText(row.gifting_card_id) && normalizeText(row.gifting_card_label)
      ? {
          gifting: {
            cardId: normalizeText(row.gifting_card_id),
            cardLabel: normalizeText(row.gifting_card_label),
            cardPriceCents: Math.max(0, normalizeInteger(row.gifting_card_price_cents)),
            message: normalizeText(row.gifting_message),
          },
        }
      : {}),
  };
}

async function getOrderItemsByOrderId(orderIds: number[]) {
  if (orderIds.length === 0) {
    return new Map<number, AdminOrderItem[]>();
  }

  const placeholders = orderIds.map(() => "?").join(", ");
  const rows = await queryCloudflareD1<AdminOrderItemRow>(
    `SELECT
       order_id,
       product_slug,
       product_name,
       unit_price_cents,
       quantity,
       line_total_cents,
       gifting_card_id,
       gifting_card_label,
       gifting_card_price_cents,
       gifting_message
     FROM order_items
     WHERE order_id IN (${placeholders})
     ORDER BY order_id ASC, id ASC`,
    orderIds,
    { cache: "no-store" },
  );

  const itemsByOrderId = new Map<number, AdminOrderItem[]>();

  for (const row of rows) {
    const item = mapOrderItemRow(row);

    if (!item) {
      continue;
    }

    const existing = itemsByOrderId.get(row.order_id) ?? [];
    existing.push(item);
    itemsByOrderId.set(row.order_id, existing);
  }

  return itemsByOrderId;
}

async function getGiftCardRedemptionsByOrderId(orderIds: number[]) {
  if (orderIds.length === 0) {
    return new Map<number, AdminOrderGiftCardRedemption[]>();
  }

  const placeholders = orderIds.map(() => "?").join(", ");
  const rows = await queryCloudflareD1<AdminOrderGiftCardRedemptionRow>(
    `SELECT
       order_id,
       code,
       amount_pence,
       status
     FROM gift_card_redemptions
     WHERE order_id IN (${placeholders})
     ORDER BY order_id ASC, id ASC`,
    orderIds,
    { cache: "no-store" },
  ).catch(() => [] as AdminOrderGiftCardRedemptionRow[]);

  const redemptionsByOrderId = new Map<number, AdminOrderGiftCardRedemption[]>();

  for (const row of rows) {
    const code = normalizeText(row.code);

    if (!code) {
      continue;
    }

    const existing = redemptionsByOrderId.get(row.order_id) ?? [];
    existing.push({
      code,
      amountCents: Math.max(0, normalizeInteger(row.amount_pence)),
      status: normalizeText(row.status),
    });
    redemptionsByOrderId.set(row.order_id, existing);
  }

  return redemptionsByOrderId;
}

export async function getAdminOrders(limit = 100): Promise<AdminOrderSummary[]> {
  if (!hasCloudflareD1Config()) {
    return [];
  }

  await ensureCustomerAccountSchema();
  await expireStalePendingOrders();

  const rows = await queryCloudflareD1<AdminOrderRow>(
    `SELECT
       o.id,
       o.public_id,
       o.status,
       o.email,
       o.first_name,
       o.last_name,
       o.address_line1,
       o.address_line2,
       o.city,
       o.postcode,
       o.country,
       o.fulfilment_method,
       o.dispatch_date,
       o.collection_venue,
       o.collection_address_line1,
       o.collection_city,
       o.collection_postcode,
       o.collection_window_start,
       o.collection_window_end,
       o.collected_at,
       o.total_cents,
       o.gift_card_redeemed_cents,
       o.stripe_amount_cents,
       o.currency,
       o.created_at,
       o.paid_at,
       o.delivered_at,
       o.order_journey_json,
       COALESCE(SUM(oi.quantity), 0) AS item_count,
       COALESCE(GROUP_CONCAT(oi.product_name || ' x' || oi.quantity, ', '), '') AS items_summary
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY
       o.id,
       o.public_id,
       o.status,
       o.email,
       o.first_name,
       o.last_name,
       o.address_line1,
       o.address_line2,
       o.city,
       o.postcode,
       o.country,
       o.fulfilment_method,
       o.dispatch_date,
       o.collection_venue,
       o.collection_address_line1,
       o.collection_city,
       o.collection_postcode,
       o.collection_window_start,
       o.collection_window_end,
       o.collected_at,
       o.total_cents,
       o.gift_card_redeemed_cents,
       o.stripe_amount_cents,
       o.currency,
       o.created_at,
       o.paid_at,
       o.delivered_at,
       o.order_journey_json
     ORDER BY datetime(o.created_at) DESC, o.id DESC
     LIMIT ?`,
    [limit],
    { cache: "no-store" },
  );

  const orderIds = rows.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0);
  const [itemsByOrderId, giftCardRedemptionsByOrderId] = await Promise.all([
    getOrderItemsByOrderId(orderIds),
    getGiftCardRedemptionsByOrderId(orderIds),
  ]);

  return rows.map((row) => {
    const status = normalizeText(row.status);
    const createdAt = normalizeText(row.created_at);
    const fulfilmentMethod = normalizeText(row.fulfilment_method);
    const dispatchDate = normalizeText(row.dispatch_date);

    return {
      orderId: normalizeText(row.public_id),
      status,
      email: normalizeText(row.email),
      customerName: [normalizeText(row.first_name), normalizeText(row.last_name)].filter(Boolean).join(" "),
      addressLine1: normalizeText(row.address_line1),
      addressLine2: normalizeText(row.address_line2),
      city: normalizeText(row.city),
      postcode: normalizeText(row.postcode),
      country: normalizeText(row.country),
      deliveryAddress: buildDeliveryAddress(row),
      fulfilmentMethod,
      fulfilmentMethodLabel: formatDispatchMethod(fulfilmentMethod) || "Not selected",
      dispatchDate,
      dispatchDateLabel: formatDispatchDate(dispatchDate) || "Not selected",
      collectionAddress: [
        normalizeText(row.collection_venue),
        normalizeText(row.collection_address_line1),
        normalizeText(row.collection_city),
        normalizeText(row.collection_postcode),
      ].filter(Boolean).join(", "),
      collectionWindow: [normalizeText(row.collection_window_start), normalizeText(row.collection_window_end)].filter(Boolean).join("–"),
      itemCount: Number.isFinite(row.item_count) ? Number(row.item_count) : 0,
      itemsSummary: normalizeText(row.items_summary),
      totalCents: Number.isFinite(row.total_cents) ? Number(row.total_cents) : 0,
      giftCardRedeemedCents: Math.max(0, normalizeInteger(row.gift_card_redeemed_cents)),
      stripeAmountCents:
        row.stripe_amount_cents === null || row.stripe_amount_cents === undefined
          ? Math.max(0, normalizeInteger(row.total_cents) - normalizeInteger(row.gift_card_redeemed_cents))
          : Math.max(0, normalizeInteger(row.stripe_amount_cents)),
      currency: normalizeText(row.currency) || "gbp",
      createdAt,
      paidAt: normalizeText(row.paid_at),
      deliveredAt: normalizeText(row.delivered_at),
      collectedAt: normalizeText(row.collected_at),
      isPendingWarning:
        status === STRIPE_CHECKOUT_ORDER_STATUS.pending &&
        getPendingAgeMinutes(createdAt) >= PENDING_ORDER_WARNING_MINUTES,
      items: itemsByOrderId.get(row.id) ?? [],
      giftCardRedemptions: giftCardRedemptionsByOrderId.get(row.id) ?? [],
      orderJourney: parseStoredOrderJourney(row.order_journey_json),
    };
  });
}

export async function getAdminOrderCount() {
  if (!hasCloudflareD1Config()) {
    return 0;
  }

  try {
    const rows = await queryCloudflareD1<{ total: number | string }>(
      "SELECT COUNT(1) AS total FROM orders",
      [],
      { cache: "no-store" },
    );
    const total = Number(rows[0]?.total ?? 0);
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

export async function markAdminOrderDelivered(orderPublicId: string) {
  const normalizedOrderId = normalizeText(orderPublicId);

  if (!normalizedOrderId) {
    throw new Error("The order could not be found.");
  }

  await ensureCustomerAccountSchema();

  const existingRows = await queryCloudflareD1<{ id: number; delivered_at: string | null; status: string; fulfilment_method: string | null }>(
    `SELECT id, delivered_at, status, fulfilment_method
     FROM orders
     WHERE public_id = ?
     LIMIT 1`,
    [normalizedOrderId],
    { cache: "no-store" },
  );

  const existingOrder = existingRows[0];

  if (!existingOrder) {
    throw new Error("The order could not be found.");
  }

  const existingStatus = normalizeText(existingOrder.status);

  if (normalizeText(existingOrder.fulfilment_method) === BAKERY_COLLECTION_METHOD) {
    throw new Error("Collection orders must be marked as collected.");
  }

  if (normalizeText(existingOrder.delivered_at) && existingStatus === "delivered") {
    return { alreadyDelivered: true };
  }

  if (existingStatus !== STRIPE_CHECKOUT_ORDER_STATUS.paid) {
    throw new Error("Only paid orders can be marked as delivered.");
  }

  await executeCloudflareD1(
    `UPDATE orders
     SET status = 'delivered',
         delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [existingOrder.id],
  );

  try {
    await sendDeliveredOrderEmail(normalizedOrderId);
    return { alreadyDelivered: false, emailWarning: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The delivery confirmation email could not be sent.";
    return { alreadyDelivered: false, emailWarning: message };
  }
}

export async function markAdminOrderCollected(orderPublicId: string) {
  const normalizedOrderId = normalizeText(orderPublicId);
  if (!normalizedOrderId) throw new Error("The order could not be found.");
  await ensureCustomerAccountSchema();
  const rows = await queryCloudflareD1<{
    id: number;
    status: string;
    fulfilment_method: string | null;
    collected_at: string | null;
  }>(
    `SELECT id, status, fulfilment_method, collected_at FROM orders WHERE public_id = ? LIMIT 1`,
    [normalizedOrderId],
    { cache: "no-store" },
  );
  const order = rows[0];
  if (!order) throw new Error("The order could not be found.");
  if (normalizeText(order.fulfilment_method) !== BAKERY_COLLECTION_METHOD) {
    throw new Error("Only collection orders can be marked as collected.");
  }
  const alreadyCollected = normalizeText(order.status) === "collected" && Boolean(normalizeText(order.collected_at));
  if (!alreadyCollected && normalizeText(order.status) !== STRIPE_CHECKOUT_ORDER_STATUS.paid) {
    throw new Error("Only paid orders can be marked as collected.");
  }
  if (!alreadyCollected) {
    await executeCloudflareD1(
      `UPDATE orders SET status = 'collected', collected_at = COALESCE(collected_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [order.id],
    );
  }
  try {
    await sendCollectedOrderEmail(normalizedOrderId);
    return { alreadyCollected, emailWarning: "" };
  } catch (error) {
    return {
      alreadyCollected,
      emailWarning: error instanceof Error ? error.message : "The collection confirmation email could not be sent.",
    };
  }
}
