import type { User } from "@supabase/supabase-js";
import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";

export type CustomerProfile = {
  id: number;
  supabaseUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAddress = {
  id: number;
  label: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpdateCustomerProfileInput = {
  firstName: string;
  lastName: string;
  phone: string;
  marketingOptIn: boolean;
};

export type UpsertCustomerAddressInput = {
  id?: number;
  label?: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
};

type CustomerProfileRow = {
  id: number;
  supabase_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  marketing_opt_in: number | null;
  created_at: string;
  updated_at: string;
};

type CustomerAddressRow = {
  id: number;
  label: string | null;
  first_name: string | null;
  last_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postcode: string;
  country: string;
  phone: string | null;
  is_default: number | null;
  created_at: string;
  updated_at: string;
};

let schemaReadyPromise: Promise<void> | null = null;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function toCustomerProfile(row: CustomerProfileRow): CustomerProfile {
  return {
    id: row.id,
    supabaseUserId: normalizeText(row.supabase_user_id),
    email: normalizeText(row.email),
    firstName: normalizeText(row.first_name),
    lastName: normalizeText(row.last_name),
    phone: normalizeText(row.phone),
    marketingOptIn: normalizeBoolean(row.marketing_opt_in, true),
    createdAt: normalizeText(row.created_at),
    updatedAt: normalizeText(row.updated_at),
  };
}

function toCustomerAddress(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    label: normalizeText(row.label),
    firstName: normalizeText(row.first_name),
    lastName: normalizeText(row.last_name),
    addressLine1: normalizeText(row.address_line1),
    addressLine2: normalizeText(row.address_line2),
    city: normalizeText(row.city),
    postcode: normalizeText(row.postcode),
    country: normalizeText(row.country),
    phone: normalizeText(row.phone),
    isDefault: normalizeBoolean(row.is_default),
    createdAt: normalizeText(row.created_at),
    updatedAt: normalizeText(row.updated_at),
  };
}

async function getTableColumnNames(tableName: string) {
  const rows = await queryCloudflareD1<{ name: string }>(`PRAGMA table_info(${tableName})`, [], {
    cache: "no-store",
  });

  return new Set(rows.map((row) => normalizeText(row.name)).filter(Boolean));
}

async function ensureOrderTableColumns() {
  const orderColumns = await getTableColumnNames("orders");

  if (!orderColumns.has("supabase_user_id")) {
    await executeCloudflareD1("ALTER TABLE orders ADD COLUMN supabase_user_id TEXT");
  }

  if (!orderColumns.has("customer_profile_id")) {
    await executeCloudflareD1("ALTER TABLE orders ADD COLUMN customer_profile_id INTEGER");
  }
}

export async function ensureCustomerAccountSchema() {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
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

      await ensureOrderTableColumns();

      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS customer_profiles (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           supabase_user_id TEXT NOT NULL UNIQUE,
           email TEXT NOT NULL,
           first_name TEXT,
           last_name TEXT,
           phone TEXT,
           marketing_opt_in INTEGER NOT NULL DEFAULT 1,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );

      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS customer_addresses (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           customer_profile_id INTEGER NOT NULL,
           label TEXT,
           first_name TEXT,
           last_name TEXT,
           address_line1 TEXT NOT NULL,
           address_line2 TEXT,
           city TEXT NOT NULL,
           postcode TEXT NOT NULL,
           country TEXT NOT NULL,
           phone TEXT,
           is_default INTEGER NOT NULL DEFAULT 0,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE CASCADE
         )`,
      );

      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_orders_public_id ON orders(public_id)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(stripe_payment_intent_id)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_orders_supabase_user_id ON orders(supabase_user_id)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_order_webhook_events_event_id ON order_webhook_events(stripe_event_id)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email)",
      );
      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_customer_addresses_profile_id ON customer_addresses(customer_profile_id)",
      );
      await executeCloudflareD1(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_default_profile
         ON customer_addresses(customer_profile_id)
         WHERE is_default = 1`,
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

function getNamePartsFromUser(user: User) {
  const metadata = user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const firstName = normalizeText((metadata as { first_name?: unknown }).first_name);
  const lastName = normalizeText((metadata as { last_name?: unknown }).last_name);

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const fullName = normalizeText((metadata as { full_name?: unknown }).full_name);
  const parts = fullName.split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

async function getCustomerProfileRowByUserId(supabaseUserId: string) {
  const rows = await queryCloudflareD1<CustomerProfileRow>(
    `SELECT
       id,
       supabase_user_id,
       email,
       first_name,
       last_name,
       phone,
       marketing_opt_in,
       created_at,
       updated_at
     FROM customer_profiles
     WHERE supabase_user_id = ?
     LIMIT 1`,
    [supabaseUserId],
    { cache: "no-store" },
  );

  return rows[0] ?? null;
}

export async function linkOrdersToCustomerProfileByEmail(
  supabaseUserId: string,
  profileId: number,
  email: string,
) {
  const normalizedEmail = normalizeText(email).toLowerCase();

  if (!normalizedEmail) {
    return;
  }

  await ensureCustomerAccountSchema();

  await executeCloudflareD1(
    `UPDATE orders
     SET supabase_user_id = ?, customer_profile_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE lower(email) = ?
       AND (supabase_user_id IS NULL OR trim(supabase_user_id) = '')`,
    [supabaseUserId, profileId, normalizedEmail],
  );
}

export async function ensureCustomerProfileForUser(user: User) {
  const supabaseUserId = normalizeText(user.id);
  const email = normalizeText(user.email).toLowerCase();

  if (!supabaseUserId || !email) {
    throw new Error("Authenticated customer details are incomplete.");
  }

  await ensureCustomerAccountSchema();

  const { firstName, lastName } = getNamePartsFromUser(user);
  const phone = normalizeText(
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as { phone?: unknown }).phone
      : "",
  );

  const existing = await getCustomerProfileRowByUserId(supabaseUserId);

  if (!existing) {
    await executeCloudflareD1(
      `INSERT INTO customer_profiles (
         supabase_user_id,
         email,
         first_name,
         last_name,
         phone,
         marketing_opt_in
       )
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        supabaseUserId,
        email,
        normalizeNullableText(firstName),
        normalizeNullableText(lastName),
        normalizeNullableText(phone),
      ],
    );
  } else {
    const nextFirstName = normalizeText(existing.first_name) || firstName;
    const nextLastName = normalizeText(existing.last_name) || lastName;
    const nextPhone = normalizeText(existing.phone) || phone;

    await executeCloudflareD1(
      `UPDATE customer_profiles
       SET email = ?,
           first_name = ?,
           last_name = ?,
           phone = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE supabase_user_id = ?`,
      [
        email,
        normalizeNullableText(nextFirstName),
        normalizeNullableText(nextLastName),
        normalizeNullableText(nextPhone),
        supabaseUserId,
      ],
    );
  }

  const row = await getCustomerProfileRowByUserId(supabaseUserId);

  if (!row) {
    throw new Error("Customer profile could not be created.");
  }

  await linkOrdersToCustomerProfileByEmail(supabaseUserId, row.id, email);
  return toCustomerProfile(row);
}

export async function getCustomerProfileForUser(user: User) {
  const profile = await ensureCustomerProfileForUser(user);
  return profile;
}

export async function updateCustomerProfileForUser(user: User, input: UpdateCustomerProfileInput) {
  const profile = await ensureCustomerProfileForUser(user);

  await executeCloudflareD1(
    `UPDATE customer_profiles
     SET email = ?,
         first_name = ?,
         last_name = ?,
         phone = ?,
         marketing_opt_in = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      normalizeText(user.email).toLowerCase(),
      normalizeNullableText(input.firstName),
      normalizeNullableText(input.lastName),
      normalizeNullableText(input.phone),
      input.marketingOptIn ? 1 : 0,
      profile.id,
    ],
  );

  const updated = await getCustomerProfileRowByUserId(profile.supabaseUserId);

  if (!updated) {
    throw new Error("Customer profile could not be updated.");
  }

  return toCustomerProfile(updated);
}

export async function listCustomerAddressesForUser(user: User) {
  const profile = await ensureCustomerProfileForUser(user);

  const rows = await queryCloudflareD1<CustomerAddressRow>(
    `SELECT
       id,
       label,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country,
       phone,
       is_default,
       created_at,
       updated_at
     FROM customer_addresses
     WHERE customer_profile_id = ?
     ORDER BY is_default DESC, datetime(updated_at) DESC, id DESC`,
    [profile.id],
    { cache: "no-store" },
  );

  return rows.map(toCustomerAddress);
}

async function getAddressByIdForProfile(profileId: number, addressId: number) {
  const rows = await queryCloudflareD1<CustomerAddressRow>(
    `SELECT
       id,
       label,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country,
       phone,
       is_default,
       created_at,
       updated_at
     FROM customer_addresses
     WHERE customer_profile_id = ? AND id = ?
     LIMIT 1`,
    [profileId, addressId],
    { cache: "no-store" },
  );

  return rows[0] ?? null;
}

async function getAddressCountForProfile(profileId: number) {
  const rows = await queryCloudflareD1<{ count: number }>(
    "SELECT COUNT(*) AS count FROM customer_addresses WHERE customer_profile_id = ?",
    [profileId],
    { cache: "no-store" },
  );

  return Number(rows[0]?.count ?? 0);
}

export async function upsertCustomerAddressForUser(user: User, input: UpsertCustomerAddressInput) {
  const profile = await ensureCustomerProfileForUser(user);
  const addressCount = await getAddressCountForProfile(profile.id);
  const shouldBeDefault = Boolean(input.isDefault) || addressCount === 0;

  if (shouldBeDefault) {
    await executeCloudflareD1(
      "UPDATE customer_addresses SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE customer_profile_id = ?",
      [profile.id],
    );
  }

  if (input.id) {
    const existingAddress = await getAddressByIdForProfile(profile.id, input.id);

    if (!existingAddress) {
      throw new Error("Saved address not found.");
    }

    await executeCloudflareD1(
      `UPDATE customer_addresses
       SET label = ?,
           first_name = ?,
           last_name = ?,
           address_line1 = ?,
           address_line2 = ?,
           city = ?,
           postcode = ?,
           country = ?,
           phone = ?,
           is_default = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND customer_profile_id = ?`,
      [
        normalizeNullableText(input.label),
        normalizeNullableText(input.firstName),
        normalizeNullableText(input.lastName),
        normalizeText(input.addressLine1),
        normalizeNullableText(input.addressLine2),
        normalizeText(input.city),
        normalizeText(input.postcode),
        normalizeText(input.country),
        normalizeNullableText(input.phone),
        shouldBeDefault ? 1 : 0,
        input.id,
        profile.id,
      ],
    );
  } else {
    await executeCloudflareD1(
      `INSERT INTO customer_addresses (
         customer_profile_id,
         label,
         first_name,
         last_name,
         address_line1,
         address_line2,
         city,
         postcode,
         country,
         phone,
         is_default
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        normalizeNullableText(input.label),
        normalizeNullableText(input.firstName),
        normalizeNullableText(input.lastName),
        normalizeText(input.addressLine1),
        normalizeNullableText(input.addressLine2),
        normalizeText(input.city),
        normalizeText(input.postcode),
        normalizeText(input.country),
        normalizeNullableText(input.phone),
        shouldBeDefault ? 1 : 0,
      ],
    );
  }

  return listCustomerAddressesForUser(user);
}

export async function deleteCustomerAddressForUser(user: User, addressId: number) {
  const profile = await ensureCustomerProfileForUser(user);
  const existingAddress = await getAddressByIdForProfile(profile.id, addressId);

  if (!existingAddress) {
    throw new Error("Saved address not found.");
  }

  await executeCloudflareD1(
    "DELETE FROM customer_addresses WHERE id = ? AND customer_profile_id = ?",
    [addressId, profile.id],
  );

  if (normalizeBoolean(existingAddress.is_default)) {
    const remaining = await listCustomerAddressesForUser(user);

    if (remaining[0]) {
      await executeCloudflareD1(
        "UPDATE customer_addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [remaining[0].id],
      );
    }
  }

  return listCustomerAddressesForUser(user);
}

export async function attachOrderToCustomerProfile(params: {
  orderPublicId: string;
  supabaseUserId: string;
  customerProfileId: number;
}) {
  await ensureCustomerAccountSchema();

  await executeCloudflareD1(
    `UPDATE orders
     SET supabase_user_id = ?, customer_profile_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE public_id = ?`,
    [params.supabaseUserId, params.customerProfileId, params.orderPublicId],
  );
}
