import { hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { ensureCustomerAccountSchema } from "@/lib/customer-profiles";
import { expireStalePendingOrders } from "@/lib/stripe-checkout";

export type AccountOrderSummary = {
  orderId: string;
  status: string;
  totalCents: number;
  giftCardRedeemedCents: number;
  stripeAmountCents: number;
  currency: string;
  createdAt: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  fulfilmentMethod: string;
  scheduledDate: string;
  collectionAddress: string;
  collectionWindow: string;
  items: AccountOrderItem[];
};

export type AccountOrderItem = {
  slug: string;
  name: string;
  image: string;
  imageAlt: string;
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

type AccountOrderRow = {
  id: number;
  public_id: string;
  status: string;
  total_cents: number;
  gift_card_redeemed_cents: number | null;
  stripe_amount_cents: number | null;
  currency: string;
  created_at: string;
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
  supabase_user_id: string | null;
  items_json: string | null;
};

type AccountOrderItemRow = {
  order_id: number;
  product_slug: string | null;
  product_name: string | null;
  unit_price_cents: number | null;
  quantity: number | null;
  line_total_cents: number | null;
  image_path: string | null;
  image_alt: string | null;
  gifting_card_id: string | null;
  gifting_card_label: string | null;
  gifting_card_price_cents: number | null;
  gifting_message: string | null;
};

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOrderItems(itemsJson: string | null | undefined): AccountOrderItem[] {
  const normalizedJson = normalizeText(itemsJson);

  if (!normalizedJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalizedJson) as { lines?: unknown };
    const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];

    return lines
      .map((line) => {
        if (!line || typeof line !== "object") {
          return null;
        }

        const item = line as {
          slug?: unknown;
          name?: unknown;
          image?: unknown;
          imageAlt?: unknown;
          quantity?: unknown;
          unitPriceCents?: unknown;
          lineTotalCents?: unknown;
          gifting?: unknown;
        };

        const name = normalizeText(typeof item.name === "string" ? item.name : null);

        if (!name) {
          return null;
        }

        return {
          slug: normalizeText(typeof item.slug === "string" ? item.slug : null),
          name,
          image: normalizeText(typeof item.image === "string" ? item.image : null),
          imageAlt: normalizeText(typeof item.imageAlt === "string" ? item.imageAlt : null),
          quantity: Math.max(0, normalizeInteger(item.quantity)),
          unitPriceCents: Math.max(0, normalizeInteger(item.unitPriceCents)),
          lineTotalCents: Math.max(0, normalizeInteger(item.lineTotalCents)),
          ...(item.gifting && typeof item.gifting === "object"
            ? (() => {
                const gifting = item.gifting as {
                  cardId?: unknown;
                  cardLabel?: unknown;
                  cardPriceCents?: unknown;
                  message?: unknown;
                };
                const cardId = normalizeText(
                  typeof gifting.cardId === "string" ? gifting.cardId : null,
                );
                const cardLabel = normalizeText(
                  typeof gifting.cardLabel === "string" ? gifting.cardLabel : null,
                );

                return cardId && cardLabel
                  ? {
                      gifting: {
                        cardId,
                        cardLabel,
                        cardPriceCents: Math.max(
                          0,
                          normalizeInteger(gifting.cardPriceCents),
                        ),
                        message: normalizeText(
                          typeof gifting.message === "string" ? gifting.message : null,
                        ),
                      },
                    }
                  : {};
              })()
            : {}),
        };
      })
      .filter((item): item is AccountOrderItem => item !== null);
  } catch {
    return [];
  }
}

function mapItemRow(row: AccountOrderItemRow): AccountOrderItem | null {
  const name = normalizeText(row.product_name);

  if (!name) {
    return null;
  }

  return {
    slug: normalizeText(row.product_slug),
    name,
    image: normalizeText(row.image_path),
    imageAlt: normalizeText(row.image_alt),
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
    return new Map<number, AccountOrderItem[]>();
  }

  const placeholders = orderIds.map(() => "?").join(", ");
  const itemRows = await queryCloudflareD1<AccountOrderItemRow>(
    `SELECT
       oi.order_id,
       oi.product_slug,
       oi.product_name,
       oi.unit_price_cents,
       oi.quantity,
       oi.line_total_cents,
       p.image_path,
       p.alt_text AS image_alt,
       oi.gifting_card_id,
       oi.gifting_card_label,
       oi.gifting_card_price_cents,
       oi.gifting_message
     FROM order_items oi
     LEFT JOIN products p ON p.slug = oi.product_slug
     WHERE oi.order_id IN (${placeholders})
     ORDER BY oi.order_id ASC, oi.id ASC`,
    orderIds,
    { cache: "no-store" },
  );

  const itemsByOrderId = new Map<number, AccountOrderItem[]>();

  for (const row of itemRows) {
    const item = mapItemRow(row);

    if (!item) {
      continue;
    }

    const existing = itemsByOrderId.get(row.order_id) ?? [];
    existing.push(item);
    itemsByOrderId.set(row.order_id, existing);
  }

  return itemsByOrderId;
}

export async function getAccountOrderSummariesForCustomer(params: {
  supabaseUserId: string;
  email: string;
}): Promise<AccountOrderSummary[]> {
  const normalizedUserId = normalizeText(params.supabaseUserId);
  const normalizedEmail = normalizeText(params.email).toLowerCase();

  if ((!normalizedUserId && !normalizedEmail) || !hasCloudflareD1Config()) {
    return [];
  }

  await ensureCustomerAccountSchema();
  await expireStalePendingOrders();

  const rows = await queryCloudflareD1<AccountOrderRow>(
    `SELECT
       id,
       public_id,
       status,
       total_cents,
       gift_card_redeemed_cents,
       stripe_amount_cents,
       currency,
       created_at,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country,
       fulfilment_method,
       dispatch_date,
       collection_venue,
       collection_address_line1,
       collection_city,
       collection_postcode,
       collection_window_start,
       collection_window_end,
       supabase_user_id,
       items_json
     FROM orders
     WHERE supabase_user_id = ?
        OR (lower(email) = ? AND (supabase_user_id IS NULL OR trim(supabase_user_id) = ''))
     ORDER BY datetime(created_at) DESC, id DESC`,
    [normalizedUserId, normalizedEmail],
    { cache: "no-store" },
  );

  const itemsByOrderId = await getOrderItemsByOrderId(
    rows.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0),
  );

  return rows.map((row) => ({
    orderId: normalizeText(row.public_id),
    status: normalizeText(row.status),
    totalCents: Number.isFinite(row.total_cents) ? row.total_cents : 0,
    giftCardRedeemedCents: Math.max(0, normalizeInteger(row.gift_card_redeemed_cents)),
    stripeAmountCents: Math.max(0, normalizeInteger(row.stripe_amount_cents ?? row.total_cents)),
    currency: normalizeText(row.currency) || "gbp",
    createdAt: normalizeText(row.created_at),
    fullName: [normalizeText(row.first_name), normalizeText(row.last_name)].filter(Boolean).join(" "),
    addressLine1: normalizeText(row.address_line1),
    addressLine2: normalizeText(row.address_line2),
    city: normalizeText(row.city),
    postcode: normalizeText(row.postcode),
    country: normalizeText(row.country),
    fulfilmentMethod: normalizeText(row.fulfilment_method),
    scheduledDate: normalizeText(row.dispatch_date),
    collectionAddress: [row.collection_venue, row.collection_address_line1, row.collection_city, row.collection_postcode].map(normalizeText).filter(Boolean).join(", "),
    collectionWindow: [row.collection_window_start, row.collection_window_end].map(normalizeText).filter(Boolean).join("–"),
    items: itemsByOrderId.get(row.id) ?? parseOrderItems(row.items_json),
  }));
}

export async function getAccountOrderSummariesByEmail(email: string): Promise<AccountOrderSummary[]> {
  const normalizedEmail = normalizeText(email).toLowerCase();

  if (!normalizedEmail || !hasCloudflareD1Config()) {
    return [];
  }

  await ensureCustomerAccountSchema();
  await expireStalePendingOrders();

  const rows = await queryCloudflareD1<AccountOrderRow>(
    `SELECT
       id,
       public_id,
       status,
       total_cents,
       gift_card_redeemed_cents,
       stripe_amount_cents,
       currency,
       created_at,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country,
       fulfilment_method,
       dispatch_date,
       collection_venue,
       collection_address_line1,
       collection_city,
       collection_postcode,
       collection_window_start,
       collection_window_end,
       supabase_user_id,
       items_json
     FROM orders
     WHERE lower(email) = ?
     ORDER BY datetime(created_at) DESC, id DESC`,
    [normalizedEmail],
    { cache: "no-store" },
  );

  const itemsByOrderId = await getOrderItemsByOrderId(
    rows.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0),
  );

  return rows.map((row) => ({
    orderId: normalizeText(row.public_id),
    status: normalizeText(row.status),
    totalCents: Number.isFinite(row.total_cents) ? row.total_cents : 0,
    giftCardRedeemedCents: Math.max(0, normalizeInteger(row.gift_card_redeemed_cents)),
    stripeAmountCents: Math.max(0, normalizeInteger(row.stripe_amount_cents ?? row.total_cents)),
    currency: normalizeText(row.currency) || "gbp",
    createdAt: normalizeText(row.created_at),
    fullName: [normalizeText(row.first_name), normalizeText(row.last_name)].filter(Boolean).join(" "),
    addressLine1: normalizeText(row.address_line1),
    addressLine2: normalizeText(row.address_line2),
    city: normalizeText(row.city),
    postcode: normalizeText(row.postcode),
    country: normalizeText(row.country),
    fulfilmentMethod: normalizeText(row.fulfilment_method),
    scheduledDate: normalizeText(row.dispatch_date),
    collectionAddress: [row.collection_venue, row.collection_address_line1, row.collection_city, row.collection_postcode].map(normalizeText).filter(Boolean).join(", "),
    collectionWindow: [row.collection_window_start, row.collection_window_end].map(normalizeText).filter(Boolean).join("–"),
    items: itemsByOrderId.get(row.id) ?? parseOrderItems(row.items_json),
  }));
}
