import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { ensureCustomerAccountSchema } from "@/lib/customer-profiles";

const GIFT_CARD_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GIFT_CARD_CODE_BODY_LENGTH = 12;
const GIFT_CARD_CODE_GROUP_SIZE = 4;
const MAX_GIFT_CARD_CODE_INSERT_ATTEMPTS = 10;

export type GiftCard = {
  id: number;
  code: string;
  initialAmountPence: number;
  balancePence: number;
  orderItemId?: number;
  createdAt: string;
};

type GiftCardRow = {
  id: number;
  code: string;
  initial_amount_pence: number;
  balance_pence: number;
  order_item_id: number | null;
  created_at: string;
};

type GiftCardOrderItemRow = {
  order_item_id: number;
  unit_price_cents: number;
  line_total_cents: number;
  quantity: number;
  gift_card_id: number | null;
  code: string | null;
  initial_amount_pence: number | null;
  balance_pence: number | null;
  created_at: string | null;
};

let schemaReadyPromise: Promise<void> | null = null;

function getSecureRandomBytes(length: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generation is not available.");
  }

  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function getSecureRandomIndex(maxExclusive: number) {
  const maxByte = 256;
  const unbiasedLimit = maxByte - (maxByte % maxExclusive);

  while (true) {
    const byte = getSecureRandomBytes(1)[0];

    if (byte < unbiasedLimit) {
      return byte % maxExclusive;
    }
  }
}

export function generateGiftCardCode() {
  let body = "";

  for (let index = 0; index < GIFT_CARD_CODE_BODY_LENGTH; index += 1) {
    body += GIFT_CARD_CODE_ALPHABET[getSecureRandomIndex(GIFT_CARD_CODE_ALPHABET.length)];
  }

  const groups = body.match(new RegExp(`.{1,${GIFT_CARD_CODE_GROUP_SIZE}}`, "g")) ?? [];
  return `GC-${groups.join("-")}`;
}

function normalizeGiftCardAmountPence(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Gift card amount must be a positive whole number of pence.");
  }

  return value;
}

function normalizeOrderItemId(value: number | undefined) {
  if (value === undefined) {
    return null;
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Gift card order item id is invalid.");
  }

  return value;
}

function isGiftCardCodeCollision(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint/i.test(message) && /gift_cards/i.test(message) && /code/i.test(message);
}

function isGiftCardOrderItemCollision(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint/i.test(message) && /gift_cards/i.test(message) && /order_item/i.test(message);
}

function mapGiftCardRow(row: GiftCardRow): GiftCard {
  return {
    id: Number(row.id),
    code: row.code,
    initialAmountPence: Number(row.initial_amount_pence),
    balancePence: Number(row.balance_pence),
    orderItemId: row.order_item_id ? Number(row.order_item_id) : undefined,
    createdAt: row.created_at,
  };
}

async function getTableColumnNames(tableName: string) {
  const rows = await queryCloudflareD1<{ name: string }>(`PRAGMA table_info(${tableName})`, [], {
    cache: "no-store",
  });

  return new Set(rows.map((row) => row.name.trim()).filter(Boolean));
}

async function ensureGiftCardsSchema() {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await ensureCustomerAccountSchema();

      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS gift_cards (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           code TEXT NOT NULL UNIQUE,
           initial_amount_pence INTEGER NOT NULL CHECK (initial_amount_pence > 0),
           balance_pence INTEGER NOT NULL CHECK (
             balance_pence >= 0
             AND balance_pence <= initial_amount_pence
           ),
           order_item_id INTEGER,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );

      const columns = await getTableColumnNames("gift_cards");
      if (!columns.has("order_item_id")) {
        await executeCloudflareD1("ALTER TABLE gift_cards ADD COLUMN order_item_id INTEGER");
      }

      await executeCloudflareD1(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_order_item
         ON gift_cards(order_item_id)
         WHERE order_item_id IS NOT NULL`,
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

async function getGiftCardByOrderItemId(orderItemId: number) {
  const rows = await queryCloudflareD1<GiftCardRow>(
    `SELECT
       id,
       code,
       initial_amount_pence,
       balance_pence,
       order_item_id,
       created_at
     FROM gift_cards
     WHERE order_item_id = ?
     LIMIT 1`,
    [orderItemId],
    { cache: "no-store" },
  );

  return rows[0] ? mapGiftCardRow(rows[0]) : null;
}

export async function createGiftCard({
  initialAmountPence,
  orderItemId,
}: {
  initialAmountPence: number;
  orderItemId?: number;
}): Promise<GiftCard> {
  await ensureGiftCardsSchema();
  const amountPence = normalizeGiftCardAmountPence(initialAmountPence);
  const normalizedOrderItemId = normalizeOrderItemId(orderItemId);

  if (normalizedOrderItemId) {
    const existing = await getGiftCardByOrderItemId(normalizedOrderItemId);
    if (existing) {
      return existing;
    }
  }

  for (let attempt = 1; attempt <= MAX_GIFT_CARD_CODE_INSERT_ATTEMPTS; attempt += 1) {
    const code = generateGiftCardCode();

    try {
      await executeCloudflareD1(
        `INSERT INTO gift_cards (
           code,
           initial_amount_pence,
           balance_pence,
           order_item_id
         )
         VALUES (?, ?, ?, ?)`,
        [code, amountPence, amountPence, normalizedOrderItemId],
      );

      const rows = await queryCloudflareD1<GiftCardRow>(
        `SELECT
           id,
           code,
           initial_amount_pence,
           balance_pence,
           order_item_id,
           created_at
         FROM gift_cards
         WHERE code = ?
         LIMIT 1`,
        [code],
        { cache: "no-store" },
      );

      if (!rows[0]) {
        throw new Error("Gift card was created but could not be loaded.");
      }

      return mapGiftCardRow(rows[0]);
    } catch (error) {
      if (normalizedOrderItemId && isGiftCardOrderItemCollision(error)) {
        const existing = await getGiftCardByOrderItemId(normalizedOrderItemId);
        if (existing) {
          return existing;
        }
      }

      if (isGiftCardCodeCollision(error) && attempt < MAX_GIFT_CARD_CODE_INSERT_ATTEMPTS) {
        continue;
      }

      if (isGiftCardCodeCollision(error)) {
        throw new Error("Could not generate a unique gift card code. Try again.", {
          cause: error,
        });
      }

      throw error;
    }
  }

  throw new Error("Could not generate a unique gift card code. Try again.");
}

export async function issueGiftCardsForPaidOrder(orderPublicId: string) {
  await ensureGiftCardsSchema();

  const rows = await queryCloudflareD1<GiftCardOrderItemRow>(
    `SELECT
       item.id AS order_item_id,
       item.unit_price_cents,
       item.line_total_cents,
       item.quantity,
       card.id AS gift_card_id,
       card.code,
       card.initial_amount_pence,
       card.balance_pence,
       card.created_at
     FROM order_items item
     INNER JOIN orders ord ON ord.id = item.order_id
     LEFT JOIN products product ON product.slug = item.product_slug
     LEFT JOIN gift_cards card ON card.order_item_id = item.id
     WHERE ord.public_id = ?
       AND lower(ord.status) = 'paid'
       AND (product.is_gift_card = 1 OR item.product_slug = 'gift-card')
     ORDER BY item.id ASC`,
    [orderPublicId],
    { cache: "no-store" },
  );

  const giftCards: GiftCard[] = [];

  for (const row of rows) {
    if (row.gift_card_id && row.code && row.initial_amount_pence && row.balance_pence) {
      giftCards.push(
        mapGiftCardRow({
          id: row.gift_card_id,
          code: row.code,
          initial_amount_pence: row.initial_amount_pence,
          balance_pence: row.balance_pence,
          order_item_id: row.order_item_id,
          created_at: row.created_at ?? "",
        }),
      );
      continue;
    }

    giftCards.push(
      await createGiftCard({
        initialAmountPence: Math.max(row.unit_price_cents, row.line_total_cents),
        orderItemId: row.order_item_id,
      }),
    );
  }

  return giftCards;
}
