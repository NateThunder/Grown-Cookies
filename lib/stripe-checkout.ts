import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { getAllProducts } from "@/lib/products";

const STRIPE_CHECKOUT_ORDER_PREFIX = "order";
const STRIPE_CHECKOUT_CURRENCY = "gbp";
const STRIPE_CHECKOUT_SHIPPING_CENTS = 1000;

export const STRIPE_CHECKOUT_COSTS = {
  currency: STRIPE_CHECKOUT_CURRENCY,
  shippingCents: STRIPE_CHECKOUT_SHIPPING_CENTS,
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
  items: StripeCheckoutLineInput[];
  contact: StripeCheckoutContactInput;
  delivery: StripeCheckoutDeliveryInput;
  tipCents: number;
};

export type StripeCheckoutOrderLine = {
  slug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type StripeCheckoutOrderDraft = {
  orderPublicId: string;
  subtotalCents: number;
  shippingCents: number;
  tipCents: number;
  totalCents: number;
  lines: StripeCheckoutOrderLine[];
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCents(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function generateOrderPublicId() {
  const suffix = (globalThis.crypto?.randomUUID?.() || `${Math.random()}`).replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return `${STRIPE_CHECKOUT_ORDER_PREFIX}_${Date.now()}_${suffix}`;
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

async function ensureOrderSchema() {
  if (!hasCloudflareD1Config()) {
    throw new Error("Database is not configured.");
  }

  await executeCloudflareD1(
    `CREATE TABLE IF NOT EXISTS orders (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       public_id TEXT NOT NULL UNIQUE,
       status TEXT NOT NULL DEFAULT 'pending',
       currency TEXT NOT NULL,
       subtotal_cents INTEGER NOT NULL,
       shipping_cents INTEGER NOT NULL,
       tip_cents INTEGER NOT NULL DEFAULT 0,
       total_cents INTEGER NOT NULL,
       email TEXT NOT NULL,
       phone TEXT,
       first_name TEXT,
       last_name TEXT,
       address_line1 TEXT,
       address_line2 TEXT,
       city TEXT,
       postcode TEXT,
       country TEXT,
       stripe_payment_intent_id TEXT,
       items_json TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );

  await executeCloudflareD1(
    `CREATE TABLE IF NOT EXISTS order_items (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       order_id INTEGER NOT NULL,
       product_slug TEXT NOT NULL,
       product_name TEXT NOT NULL,
       unit_price_cents INTEGER NOT NULL,
       quantity INTEGER NOT NULL,
       line_total_cents INTEGER NOT NULL,
       FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
     )`,
  );

  await executeCloudflareD1(
    `CREATE TABLE IF NOT EXISTS order_webhook_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       stripe_event_id TEXT NOT NULL UNIQUE,
       order_public_id TEXT,
       event_type TEXT NOT NULL,
       payload_json TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );

  await executeCloudflareD1(
    `CREATE INDEX IF NOT EXISTS idx_orders_public_id
       ON orders(public_id)`,
  );

  await executeCloudflareD1(
    `CREATE INDEX IF NOT EXISTS idx_orders_payment_intent
       ON orders(stripe_payment_intent_id)`,
  );
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

  const parsedItems = new Map<string, number>();

  for (const item of payload.items) {
    const slug = normalizeText(item.slug);
    const quantity = Math.floor(Number(item.quantity));
    if (!slug || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Invalid cart item.");
    }

    const existing = parsedItems.get(slug) ?? 0;
    parsedItems.set(slug, existing + quantity);
  }

  const tipCents = Math.max(0, normalizeCents(payload.tipCents));
  const shippingCents = STRIPE_CHECKOUT_SHIPPING_CENTS;
  const delivery = sanitizeDelivery(payload.delivery);

  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [product.slug, product]));
  const lines: StripeCheckoutOrderLine[] = [];

  for (const [slug, quantity] of parsedItems) {
    const product = productMap.get(slug);
    if (!product) {
      throw new Error("Your basket contains invalid products.");
    }

    const unitPriceCents = parsePriceToMinorUnits(product.price);
    const lineTotalCents = unitPriceCents * quantity;

    if (!Number.isFinite(unitPriceCents) || lineTotalCents < 0) {
      throw new Error("Invalid product price.");
    }

    lines.push({
      slug,
      name: product.name,
      unitPriceCents,
      quantity,
      lineTotalCents,
    });
  }

  if (lines.length === 0) {
    throw new Error("Your basket is empty.");
  }

  const subtotalCents = lines.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const totalCents = subtotalCents + shippingCents + tipCents;

  await ensureOrderSchema();

  const orderPublicId = generateOrderPublicId();
  const itemsSnapshot = JSON.stringify({
    lines,
    subtotalCents,
    shippingCents,
    tipCents,
    totalCents,
    tipCurrency: STRIPE_CHECKOUT_CURRENCY,
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
      STRIPE_CHECKOUT_CURRENCY,
      subtotalCents,
      shippingCents,
      tipCents,
      totalCents,
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

  const orderRows = await queryCloudflareD1<{ id: number }>(`SELECT id FROM orders WHERE public_id = ? LIMIT 1`, [
    orderPublicId,
  ]);
  const orderId = orderRows[0]?.id;

  if (!orderId) {
    throw new Error("The order could not be created.");
  }

  for (const line of lines) {
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
    subtotalCents,
    shippingCents,
    tipCents,
    totalCents,
    lines,
  };
}

export async function setOrderPaymentIntentId(orderPublicId: string, paymentIntentId: string) {
  await ensureOrderSchema();

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

  await ensureOrderSchema();

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
  await ensureOrderSchema();

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
