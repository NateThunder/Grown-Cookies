import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { ensureCustomerAccountSchema } from "@/lib/customer-profiles";
import type { BasketGiftCardApplication } from "@/lib/basket";

const GIFT_CARD_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GIFT_CARD_CODE_BODY_LENGTH = 12;
const GIFT_CARD_CODE_GROUP_SIZE = 4;
const MAX_GIFT_CARD_CODE_INSERT_ATTEMPTS = 10;

export const GIFT_CARD_REDEMPTION_STATUS = {
  reserved: "reserved",
  finalized: "finalized",
  released: "released",
  restored: "restored",
} as const;

type GiftCardRedemptionStatus =
  (typeof GIFT_CARD_REDEMPTION_STATUS)[keyof typeof GIFT_CARD_REDEMPTION_STATUS];

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

type GiftCardRedemptionRow = {
  id: number;
  gift_card_id: number;
  order_id: number;
  order_public_id: string;
  code: string;
  amount_pence: number;
  status: GiftCardRedemptionStatus;
  created_at: string;
  finalized_at: string | null;
  released_at: string | null;
  restored_at: string | null;
};

export type GiftCardRedemptionApplication = BasketGiftCardApplication & {
  giftCardId: number;
};

export type GiftCardRedemptionSummary = BasketGiftCardApplication & {
  id: number;
  status: GiftCardRedemptionStatus;
  createdAt: string;
  finalizedAt: string;
  releasedAt: string;
  restoredAt: string;
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

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getChangedRows(result: Awaited<ReturnType<typeof executeCloudflareD1>>) {
  const changes =
    typeof result.meta?.changes === "number"
      ? result.meta.changes
      : typeof result.meta?.changes === "string"
        ? Number.parseInt(result.meta.changes, 10)
        : 0;

  return Number.isFinite(changes) ? changes : 0;
}

export function normalizeGiftCardCodeInput(value: unknown) {
  const normalized = normalizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return "";
  }

  const body = normalized.startsWith("GC") ? normalized.slice(2) : normalized;

  if (body.length !== GIFT_CARD_CODE_BODY_LENGTH) {
    throw new Error("Enter a valid gift card code.");
  }

  if (!new RegExp(`^[${GIFT_CARD_CODE_ALPHABET}]+$`).test(body)) {
    throw new Error("Enter a valid gift card code.");
  }

  const groups = body.match(new RegExp(`.{1,${GIFT_CARD_CODE_GROUP_SIZE}}`, "g")) ?? [];
  return `GC-${groups.join("-")}`;
}

export function parseGiftCardCodes(raw: unknown) {
  if (raw === undefined || raw === null) {
    return [];
  }

  const values = Array.isArray(raw) ? raw : [raw];
  const codes = values
    .map((value) => normalizeGiftCardCodeInput(value))
    .filter(Boolean);
  const seen = new Set<string>();

  for (const code of codes) {
    if (seen.has(code)) {
      throw new Error("This gift card code has already been applied.");
    }

    seen.add(code);
  }

  return codes;
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

function mapGiftCardRedemptionRow(row: GiftCardRedemptionRow): GiftCardRedemptionSummary {
  return {
    id: Number(row.id),
    code: row.code,
    appliedCents: Number(row.amount_pence),
    balanceBeforeCents: 0,
    balanceAfterCents: 0,
    status: row.status,
    createdAt: row.created_at,
    finalizedAt: normalizeText(row.finalized_at),
    releasedAt: normalizeText(row.released_at),
    restoredAt: normalizeText(row.restored_at),
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

      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS gift_card_redemptions (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           gift_card_id INTEGER NOT NULL,
           order_id INTEGER NOT NULL,
           order_public_id TEXT NOT NULL,
           code TEXT NOT NULL,
           amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
           status TEXT NOT NULL CHECK (status IN ('reserved', 'finalized', 'released', 'restored')),
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           finalized_at TEXT,
           released_at TEXT,
           restored_at TEXT,
           FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id),
           FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
         )`,
      );

      await executeCloudflareD1(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_card_redemptions_order_card
         ON gift_card_redemptions(order_id, gift_card_id)`,
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_order ON gift_card_redemptions(order_id)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_order_public ON gift_card_redemptions(order_public_id)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_status ON gift_card_redemptions(status)",
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

async function getGiftCardsByCodes(codes: string[]) {
  await ensureGiftCardsSchema();

  if (codes.length === 0) {
    return new Map<string, GiftCard>();
  }

  const placeholders = codes.map(() => "?").join(", ");
  const rows = await queryCloudflareD1<GiftCardRow>(
    `SELECT
       id,
       code,
       initial_amount_pence,
       balance_pence,
       order_item_id,
       created_at
     FROM gift_cards
     WHERE code IN (${placeholders})`,
    codes,
    { cache: "no-store" },
  );

  return new Map(rows.map((row) => [row.code, mapGiftCardRow(row)]));
}

export async function getGiftCardApplicationsForQuote({
  codes,
  applicableCents,
}: {
  codes: string[];
  applicableCents: number;
}): Promise<GiftCardRedemptionApplication[]> {
  const normalizedCodes = parseGiftCardCodes(codes);

  if (normalizedCodes.length === 0) {
    return [];
  }

  if (!hasCloudflareD1Config()) {
    throw new Error("Gift card redemption is not available right now.");
  }

  if (!Number.isFinite(applicableCents) || applicableCents <= 0) {
    throw new Error("Gift cards cannot be used for this basket.");
  }

  const giftCardsByCode = await getGiftCardsByCodes(normalizedCodes);
  let remainingCents = Math.floor(applicableCents);
  const applications: GiftCardRedemptionApplication[] = [];

  for (const code of normalizedCodes) {
    if (remainingCents <= 0) {
      throw new Error("This order is already fully covered by the applied gift cards.");
    }

    const giftCard = giftCardsByCode.get(code);

    if (!giftCard) {
      throw new Error(`Gift card ${code} was not found.`);
    }

    if (giftCard.balancePence <= 0) {
      throw new Error(`Gift card ${code} has no remaining balance.`);
    }

    const appliedCents = Math.min(remainingCents, giftCard.balancePence);
    applications.push({
      giftCardId: giftCard.id,
      code: giftCard.code,
      appliedCents,
      balanceBeforeCents: giftCard.balancePence,
      balanceAfterCents: giftCard.balancePence - appliedCents,
    });
    remainingCents -= appliedCents;
  }

  return applications;
}

function toPublicGiftCardApplications(applications: GiftCardRedemptionApplication[]) {
  return applications.map(
    ({ code, appliedCents, balanceBeforeCents, balanceAfterCents }): BasketGiftCardApplication => ({
      code,
      appliedCents,
      balanceBeforeCents,
      balanceAfterCents,
    }),
  );
}

export async function getPublicGiftCardApplicationsForQuote(params: {
  codes: string[];
  applicableCents: number;
}) {
  return toPublicGiftCardApplications(await getGiftCardApplicationsForQuote(params));
}

export async function reserveGiftCardRedemptionsForOrder({
  orderId,
  orderPublicId,
  applications,
}: {
  orderId: number;
  orderPublicId: string;
  applications: GiftCardRedemptionApplication[];
}) {
  await ensureGiftCardsSchema();

  const normalizedOrderPublicId = normalizeText(orderPublicId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !normalizedOrderPublicId) {
    throw new Error("Gift card redemption order is invalid.");
  }

  const adjustedCards: Array<{ giftCardId: number; amountCents: number; inserted: boolean }> = [];

  try {
    for (const application of applications) {
      const amountCents = Math.floor(application.appliedCents);

      if (!Number.isSafeInteger(application.giftCardId) || application.giftCardId <= 0 || amountCents <= 0) {
        continue;
      }

      const updateResult = await executeCloudflareD1(
        `UPDATE gift_cards
         SET balance_pence = balance_pence - ?
         WHERE id = ?
           AND balance_pence >= ?`,
        [amountCents, application.giftCardId, amountCents],
      );

      if (getChangedRows(updateResult) !== 1) {
        throw new Error(`Gift card ${application.code} balance changed. Review your total and try again.`);
      }

      const adjustedCard = {
        giftCardId: application.giftCardId,
        amountCents,
        inserted: false,
      };
      adjustedCards.push(adjustedCard);

      await executeCloudflareD1(
        `INSERT INTO gift_card_redemptions (
           gift_card_id,
           order_id,
           order_public_id,
           code,
           amount_pence,
           status
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          application.giftCardId,
          orderId,
          normalizedOrderPublicId,
          application.code,
          amountCents,
          GIFT_CARD_REDEMPTION_STATUS.reserved,
        ],
      );
      adjustedCard.inserted = true;
    }
  } catch (error) {
    for (const adjustedCard of adjustedCards) {
      await executeCloudflareD1(
        `UPDATE gift_cards
         SET balance_pence = MIN(initial_amount_pence, balance_pence + ?)
         WHERE id = ?`,
        [adjustedCard.amountCents, adjustedCard.giftCardId],
      );
    }

    await executeCloudflareD1(
      `UPDATE gift_card_redemptions
       SET status = ?,
           released_at = COALESCE(released_at, CURRENT_TIMESTAMP)
       WHERE order_public_id = ?
         AND status = ?`,
      [
        GIFT_CARD_REDEMPTION_STATUS.released,
        normalizedOrderPublicId,
        GIFT_CARD_REDEMPTION_STATUS.reserved,
      ],
    );

    throw error;
  }
}

async function restoreGiftCardRedemptionBalances({
  orderPublicId,
  fromStatus,
  toStatus,
  timestampColumn,
}: {
  orderPublicId: string;
  fromStatus: GiftCardRedemptionStatus;
  toStatus: GiftCardRedemptionStatus;
  timestampColumn: "released_at" | "restored_at";
}) {
  await ensureGiftCardsSchema();
  const normalizedOrderPublicId = normalizeText(orderPublicId);

  if (!normalizedOrderPublicId) {
    return 0;
  }

  const rows = await queryCloudflareD1<GiftCardRedemptionRow>(
    `SELECT
       id,
       gift_card_id,
       order_id,
       order_public_id,
       code,
       amount_pence,
       status,
       created_at,
       finalized_at,
       released_at,
       restored_at
     FROM gift_card_redemptions
     WHERE order_public_id = ?
       AND status = ?`,
    [normalizedOrderPublicId, fromStatus],
    { cache: "no-store" },
  );

  let restoredCount = 0;

  for (const row of rows) {
    const updateResult = await executeCloudflareD1(
      `UPDATE gift_card_redemptions
       SET status = ?,
           ${timestampColumn} = COALESCE(${timestampColumn}, CURRENT_TIMESTAMP)
       WHERE id = ?
         AND status = ?`,
      [toStatus, row.id, fromStatus],
    );

    if (getChangedRows(updateResult) !== 1) {
      continue;
    }

    await executeCloudflareD1(
      `UPDATE gift_cards
       SET balance_pence = MIN(initial_amount_pence, balance_pence + ?)
       WHERE id = ?`,
      [Math.max(0, Number(row.amount_pence)), row.gift_card_id],
    );
    restoredCount += 1;
  }

  return restoredCount;
}

export async function finalizeGiftCardRedemptionsForOrder(orderPublicId: string) {
  await ensureGiftCardsSchema();
  const normalizedOrderPublicId = normalizeText(orderPublicId);

  if (!normalizedOrderPublicId) {
    return 0;
  }

  const result = await executeCloudflareD1(
    `UPDATE gift_card_redemptions
     SET status = ?,
         finalized_at = COALESCE(finalized_at, CURRENT_TIMESTAMP)
     WHERE order_public_id = ?
       AND status = ?`,
    [
      GIFT_CARD_REDEMPTION_STATUS.finalized,
      normalizedOrderPublicId,
      GIFT_CARD_REDEMPTION_STATUS.reserved,
    ],
  );

  return getChangedRows(result);
}

export function releaseGiftCardRedemptionsForOrder(orderPublicId: string) {
  return restoreGiftCardRedemptionBalances({
    orderPublicId,
    fromStatus: GIFT_CARD_REDEMPTION_STATUS.reserved,
    toStatus: GIFT_CARD_REDEMPTION_STATUS.released,
    timestampColumn: "released_at",
  });
}

export function restoreFinalizedGiftCardRedemptionsForOrder(orderPublicId: string) {
  return restoreGiftCardRedemptionBalances({
    orderPublicId,
    fromStatus: GIFT_CARD_REDEMPTION_STATUS.finalized,
    toStatus: GIFT_CARD_REDEMPTION_STATUS.restored,
    timestampColumn: "restored_at",
  });
}

export async function getGiftCardRedemptionsForOrder(orderPublicId: string) {
  await ensureGiftCardsSchema();
  const normalizedOrderPublicId = normalizeText(orderPublicId);

  if (!normalizedOrderPublicId) {
    return [];
  }

  const rows = await queryCloudflareD1<GiftCardRedemptionRow>(
    `SELECT
       id,
       gift_card_id,
       order_id,
       order_public_id,
       code,
       amount_pence,
       status,
       created_at,
       finalized_at,
       released_at,
       restored_at
     FROM gift_card_redemptions
     WHERE order_public_id = ?
     ORDER BY id ASC`,
    [normalizedOrderPublicId],
    { cache: "no-store" },
  );

  return rows.map(mapGiftCardRedemptionRow);
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
    if (
      row.gift_card_id &&
      row.code &&
      row.initial_amount_pence !== null &&
      row.balance_pence !== null
    ) {
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
