import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";

const DELIVERY_COST_SETTING_KEY = "delivery_cost_cents";

export const DEFAULT_DELIVERY_COST_CENTS = 1000;

type StoreSettingRow = {
  value: string;
  updated_at?: string;
};

function parseStoredDeliveryCost(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_DELIVERY_COST_CENTS;
  }

  return parsed;
}

async function ensureStoreSettingsSchema() {
  if (!hasCloudflareD1Config()) {
    return;
  }

  await executeCloudflareD1(
    `CREATE TABLE IF NOT EXISTS store_settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
}

export async function getDeliveryCostSetting() {
  if (!hasCloudflareD1Config()) {
    return {
      deliveryCostCents: DEFAULT_DELIVERY_COST_CENTS,
      isDefault: true,
    };
  }

  await ensureStoreSettingsSchema();

  const rows = await queryCloudflareD1<StoreSettingRow>(
    `SELECT value, updated_at
     FROM store_settings
     WHERE key = ?
     LIMIT 1`,
    [DELIVERY_COST_SETTING_KEY],
  );

  const row = rows[0];

  if (!row) {
    return {
      deliveryCostCents: DEFAULT_DELIVERY_COST_CENTS,
      isDefault: true,
    };
  }

  return {
    deliveryCostCents: parseStoredDeliveryCost(row.value),
    updatedAt: row.updated_at,
    isDefault: false,
  };
}

export async function getDeliveryCostCents() {
  const setting = await getDeliveryCostSetting();
  return setting.deliveryCostCents;
}

export async function updateDeliveryCostCents(deliveryCostCents: number) {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  if (!Number.isFinite(deliveryCostCents) || deliveryCostCents < 0) {
    throw new Error("Delivery cost must be zero or greater.");
  }

  const normalizedValue = Math.round(deliveryCostCents);

  await ensureStoreSettingsSchema();
  await executeCloudflareD1(
    `INSERT INTO store_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE
     SET value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
    [DELIVERY_COST_SETTING_KEY, String(normalizedValue)],
  );

  return {
    deliveryCostCents: normalizedValue,
  };
}
