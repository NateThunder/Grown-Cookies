import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { ensureCustomerAccountSchema } from "@/lib/customer-profiles";
import {
  expireStalePendingOrders,
  PENDING_ORDER_WARNING_MINUTES,
  STRIPE_CHECKOUT_ORDER_STATUS,
} from "@/lib/stripe-checkout";

export type AdminOrderSummary = {
  orderId: string;
  status: string;
  email: string;
  customerName: string;
  deliveryAddress: string;
  itemCount: number;
  itemsSummary: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  deliveredAt: string;
  isPendingWarning: boolean;
};

type AdminOrderRow = {
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
  total_cents: number;
  currency: string;
  created_at: string;
  delivered_at: string | null;
  item_count: number | null;
  items_summary: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function getAdminOrders(limit = 100): Promise<AdminOrderSummary[]> {
  if (!hasCloudflareD1Config()) {
    return [];
  }

  await ensureCustomerAccountSchema();
  await expireStalePendingOrders();

  const rows = await queryCloudflareD1<AdminOrderRow>(
    `SELECT
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
       o.total_cents,
       o.currency,
       o.created_at,
       o.delivered_at,
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
       o.total_cents,
       o.currency,
       o.created_at,
       o.delivered_at
     ORDER BY datetime(o.created_at) DESC, o.id DESC
     LIMIT ?`,
    [limit],
    { cache: "no-store" },
  );

  return rows.map((row) => {
    const status = normalizeText(row.status);
    const createdAt = normalizeText(row.created_at);

    return {
      orderId: normalizeText(row.public_id),
      status,
      email: normalizeText(row.email),
      customerName: [normalizeText(row.first_name), normalizeText(row.last_name)].filter(Boolean).join(" "),
      deliveryAddress: buildDeliveryAddress(row),
      itemCount: Number.isFinite(row.item_count) ? Number(row.item_count) : 0,
      itemsSummary: normalizeText(row.items_summary),
      totalCents: Number.isFinite(row.total_cents) ? Number(row.total_cents) : 0,
      currency: normalizeText(row.currency) || "gbp",
      createdAt,
      deliveredAt: normalizeText(row.delivered_at),
      isPendingWarning:
        status === STRIPE_CHECKOUT_ORDER_STATUS.pending &&
        getPendingAgeMinutes(createdAt) >= PENDING_ORDER_WARNING_MINUTES,
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

  const existingRows = await queryCloudflareD1<{ id: number; delivered_at: string | null; status: string }>(
    `SELECT id, delivered_at, status
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

  return { alreadyDelivered: false };
}
