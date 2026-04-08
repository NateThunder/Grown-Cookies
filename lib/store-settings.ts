import { unstable_cache } from "next/cache";
import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";

const DELIVERY_COST_SETTING_KEY = "delivery_cost_cents";
const COOKIE_OF_MONTH_TITLE_KEY = "cookie_of_month_title";
const COOKIE_OF_MONTH_CTA_LABEL_KEY = "cookie_of_month_cta_label";
const COOKIE_OF_MONTH_PRODUCT_SLUG_KEY = "cookie_of_month_product_slug";
const SHOP_INTRO_EYEBROW_KEY = "shop_intro_eyebrow";
const SHOP_INTRO_TITLE_KEY = "shop_intro_title";
const SHOP_INTRO_BODY_KEY = "shop_intro_body";
const SHOP_INTRO_CTA_LABEL_KEY = "shop_intro_cta_label";
const BRAND_STORY_BODY_KEY = "brand_story_body";
const SITE_LOCK_ENABLED_KEY = "site_lock_enabled";
const STORE_SETTINGS_TAG = "store-settings";
const HOMEPAGE_SETTINGS_TAG = "store-settings-homepage";
const DELIVERY_SETTINGS_TAG = "store-settings-delivery";
const SITE_LOCK_SETTINGS_TAG = "store-settings-site-lock";
const STORE_SETTINGS_REVALIDATE_SECONDS = 300;

export const DEFAULT_DELIVERY_COST_CENTS = 1000;
export const DEFAULT_COOKIE_OF_MONTH_TITLE =
  "Our Cookie of the Month is a limited-edition artisan flavour inspired by the season, celebrating the ingredients at their best.";
export const DEFAULT_COOKIE_OF_MONTH_CTA_LABEL = "Cookie of the Month";
export const DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG = "double-chocolate-hazelnut";
export const DEFAULT_SHOP_INTRO_EYEBROW = "Our shop";
export const DEFAULT_SHOP_INTRO_TITLE =
  "Grown Cookies are the ideal treat for any event, adding a touch of sweetness to every celebration. Whether you're planning a birthday party, a wedding, a corporate event, or just a casual get-together, our cookies are sure to impress your guests.";
export const DEFAULT_SHOP_INTRO_BODY =
  "Our cookies come in a variety of flavours, ensuring there's something for everyone. From classic favourites like chocolate cookies to unique creations like matcha white chocolate, our selection caters to diverse tastes and preferences. These delectable cookies are baked to perfection by our professional bakers, making them a highlight at any gathering.";
export const DEFAULT_SHOP_INTRO_CTA_LABEL = "Learn more";
export const DEFAULT_BRAND_STORY_BODY =
  "We don't just make your classic cookies, we reimagine them - staying faithful to creating great flavours while elevating every detail";

type StoreSettingRow = {
  key?: string;
  value: string;
  updated_at?: string;
};

type StoreSettingValueRow = Required<Pick<StoreSettingRow, "key" | "value">> & {
  updated_at?: string;
};

let storeSettingsSchemaEnsured = false;
let storeSettingsSchemaPromise: Promise<void> | null = null;

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

  if (storeSettingsSchemaEnsured) {
    return;
  }

  if (!storeSettingsSchemaPromise) {
    storeSettingsSchemaPromise = (async () => {
      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS store_settings (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );
      storeSettingsSchemaEnsured = true;
    })();
  }

  try {
    await storeSettingsSchemaPromise;
  } catch (error) {
    storeSettingsSchemaPromise = null;
    throw error;
  }
}

async function getStoreSetting(key: string) {
  try {
    const rows = await queryCloudflareD1<StoreSettingRow>(
      `SELECT value, updated_at
       FROM store_settings
       WHERE key = ?
       LIMIT 1`,
      [key],
      { cache: "no-store" },
    );

    return rows[0] ?? null;
  } catch {
    await ensureStoreSettingsSchema();

    const rows = await queryCloudflareD1<StoreSettingRow>(
      `SELECT value, updated_at
       FROM store_settings
       WHERE key = ?
       LIMIT 1`,
      [key],
      { cache: "no-store" },
    );

    return rows[0] ?? null;
  }
}

async function getStoreSettings(keys: string[]): Promise<Map<string, StoreSettingValueRow>> {
  if (keys.length === 0) {
    return new Map<string, StoreSettingValueRow>();
  }

  const placeholders = keys.map(() => "?").join(", ");
  try {
    const rows = await queryCloudflareD1<StoreSettingValueRow>(
      `SELECT key, value, updated_at
       FROM store_settings
       WHERE key IN (${placeholders})`,
      keys,
      { cache: "no-store" },
    );

    return new Map<string, StoreSettingValueRow>(rows.map((row) => [row.key, row]));
  } catch {
    await ensureStoreSettingsSchema();

    const rows = await queryCloudflareD1<StoreSettingValueRow>(
      `SELECT key, value, updated_at
       FROM store_settings
       WHERE key IN (${placeholders})`,
      keys,
      { cache: "no-store" },
    );

    return new Map<string, StoreSettingValueRow>(rows.map((row) => [row.key, row]));
  }
}

type DeliveryCostSetting = {
  deliveryCostCents: number;
  isDefault: boolean;
  updatedAt?: string;
};

type CookieOfMonthSectionSetting = {
  title: string;
  ctaLabel: string;
  productSlug?: string;
  isDefault: boolean;
  updatedAt?: string;
};

type ShopIntroSectionSetting = {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  isDefault: boolean;
  updatedAt?: string;
};

type BrandStorySectionSetting = {
  body: string;
  isDefault: boolean;
  updatedAt?: string;
};

export type SiteLockSetting = {
  enabled: boolean;
  isDefault: boolean;
  updatedAt?: string;
};

export type HomepageSectionSettings = {
  cookieOfMonth: CookieOfMonthSectionSetting;
  shopIntro: ShopIntroSectionSetting;
  brandStory: BrandStorySectionSetting;
};

function getLatestUpdatedAt(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

function mapDeliveryCostSetting(row: StoreSettingRow | null): DeliveryCostSetting {
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

function mapCookieOfMonthSectionSetting(
  settings: Map<string, StoreSettingValueRow>,
): CookieOfMonthSectionSetting {
  const titleRow = settings.get(COOKIE_OF_MONTH_TITLE_KEY);
  const ctaLabelRow = settings.get(COOKIE_OF_MONTH_CTA_LABEL_KEY);
  const productSlugRow = settings.get(COOKIE_OF_MONTH_PRODUCT_SLUG_KEY);

  return {
    title: titleRow?.value.trim() || DEFAULT_COOKIE_OF_MONTH_TITLE,
    ctaLabel: ctaLabelRow?.value.trim() || DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
    productSlug: productSlugRow?.value.trim() || DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
    isDefault: !titleRow && !ctaLabelRow && !productSlugRow,
    updatedAt: getLatestUpdatedAt([
      titleRow?.updated_at,
      ctaLabelRow?.updated_at,
      productSlugRow?.updated_at,
    ]),
  };
}

function mapShopIntroSectionSetting(
  settings: Map<string, StoreSettingValueRow>,
): ShopIntroSectionSetting {
  const eyebrowRow = settings.get(SHOP_INTRO_EYEBROW_KEY);
  const titleRow = settings.get(SHOP_INTRO_TITLE_KEY);
  const bodyRow = settings.get(SHOP_INTRO_BODY_KEY);
  const ctaLabelRow = settings.get(SHOP_INTRO_CTA_LABEL_KEY);

  return {
    eyebrow: eyebrowRow?.value.trim() || DEFAULT_SHOP_INTRO_EYEBROW,
    title: titleRow?.value.trim() || DEFAULT_SHOP_INTRO_TITLE,
    body: bodyRow?.value.trim() || DEFAULT_SHOP_INTRO_BODY,
    ctaLabel: ctaLabelRow?.value.trim() || DEFAULT_SHOP_INTRO_CTA_LABEL,
    isDefault: !eyebrowRow && !titleRow && !bodyRow && !ctaLabelRow,
    updatedAt: getLatestUpdatedAt([
      eyebrowRow?.updated_at,
      titleRow?.updated_at,
      bodyRow?.updated_at,
      ctaLabelRow?.updated_at,
    ]),
  };
}

function mapBrandStorySectionSetting(row: StoreSettingRow | null): BrandStorySectionSetting {
  return {
    body: row?.value.trim() || DEFAULT_BRAND_STORY_BODY,
    isDefault: !row,
    updatedAt: row?.updated_at,
  };
}

function mapSiteLockSetting(row: StoreSettingRow | null, defaultEnabled: boolean): SiteLockSetting {
  if (!row) {
    return {
      enabled: defaultEnabled,
      isDefault: true,
      updatedAt: undefined,
    };
  }

  return {
    enabled: row.value.trim().toLowerCase() === "1",
    isDefault: false,
    updatedAt: row.updated_at,
  };
}

const getDeliveryCostSettingCached = unstable_cache(
  async (): Promise<DeliveryCostSetting> => {
    const row = await getStoreSetting(DELIVERY_COST_SETTING_KEY);
    return mapDeliveryCostSetting(row);
  },
  ["store-settings-delivery"],
  {
    revalidate: STORE_SETTINGS_REVALIDATE_SECONDS,
    tags: [STORE_SETTINGS_TAG, DELIVERY_SETTINGS_TAG],
  },
);

const getHomepageSectionSettingsCached = unstable_cache(
  async (): Promise<HomepageSectionSettings> => {
    const settings = await getStoreSettings([
      COOKIE_OF_MONTH_TITLE_KEY,
      COOKIE_OF_MONTH_CTA_LABEL_KEY,
      COOKIE_OF_MONTH_PRODUCT_SLUG_KEY,
      SHOP_INTRO_EYEBROW_KEY,
      SHOP_INTRO_TITLE_KEY,
      SHOP_INTRO_BODY_KEY,
      SHOP_INTRO_CTA_LABEL_KEY,
      BRAND_STORY_BODY_KEY,
    ]);

    return {
      cookieOfMonth: mapCookieOfMonthSectionSetting(settings),
      shopIntro: mapShopIntroSectionSetting(settings),
      brandStory: mapBrandStorySectionSetting(settings.get(BRAND_STORY_BODY_KEY) ?? null),
    };
  },
  ["store-settings-homepage"],
  {
    revalidate: STORE_SETTINGS_REVALIDATE_SECONDS,
    tags: [STORE_SETTINGS_TAG, HOMEPAGE_SETTINGS_TAG],
  },
);

const getSiteLockSettingCached = unstable_cache(
  async (defaultEnabled: boolean): Promise<SiteLockSetting> => {
    const row = await getStoreSetting(SITE_LOCK_ENABLED_KEY);
    return mapSiteLockSetting(row, defaultEnabled);
  },
  ["store-settings-site-lock"],
  {
    revalidate: STORE_SETTINGS_REVALIDATE_SECONDS,
    tags: [STORE_SETTINGS_TAG, SITE_LOCK_SETTINGS_TAG],
  },
);

async function upsertStoreSetting(key: string, value: string) {
  await ensureStoreSettingsSchema();
  await executeCloudflareD1(
    `INSERT INTO store_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE
     SET value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
    [key, value],
  );
}

async function deleteStoreSetting(key: string) {
  await ensureStoreSettingsSchema();
  await executeCloudflareD1("DELETE FROM store_settings WHERE key = ?", [key]);
}

export async function getDeliveryCostSetting() {
  if (!hasCloudflareD1Config()) {
    return {
      deliveryCostCents: DEFAULT_DELIVERY_COST_CENTS,
      isDefault: true,
    };
  }

  return getDeliveryCostSettingCached();
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

  await upsertStoreSetting(DELIVERY_COST_SETTING_KEY, String(normalizedValue));

  return {
    deliveryCostCents: normalizedValue,
  };
}

export async function getCookieOfMonthSectionSetting() {
  if (!hasCloudflareD1Config()) {
    return {
      title: DEFAULT_COOKIE_OF_MONTH_TITLE,
      ctaLabel: DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
      productSlug: DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
      isDefault: true,
      updatedAt: undefined,
    };
  }

  const settings = await getHomepageSectionSettingsCached();
  return settings.cookieOfMonth;
}

export async function updateCookieOfMonthSectionSetting({
  title,
  ctaLabel,
}: {
  title: string;
  ctaLabel: string;
}) {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  const normalizedTitle = title.trim();
  const normalizedCtaLabel = ctaLabel.trim();

  if (!normalizedTitle) {
    throw new Error("Enter the Cookie of the Month text.");
  }

  if (!normalizedCtaLabel) {
    throw new Error("Enter the Cookie of the Month button label.");
  }

  await upsertStoreSetting(COOKIE_OF_MONTH_TITLE_KEY, normalizedTitle);
  await upsertStoreSetting(COOKIE_OF_MONTH_CTA_LABEL_KEY, normalizedCtaLabel);

  return {
    title: normalizedTitle,
    ctaLabel: normalizedCtaLabel,
  };
}

export async function updateCookieOfMonthProductSlug(productSlug?: string | null) {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  const normalizedSlug = productSlug?.trim();

  if (!normalizedSlug) {
    await deleteStoreSetting(COOKIE_OF_MONTH_PRODUCT_SLUG_KEY);
    return {
      productSlug: undefined,
    };
  }

  await upsertStoreSetting(COOKIE_OF_MONTH_PRODUCT_SLUG_KEY, normalizedSlug);

  return {
    productSlug: normalizedSlug,
  };
}

export async function getShopIntroSectionSetting() {
  if (!hasCloudflareD1Config()) {
    return {
      eyebrow: DEFAULT_SHOP_INTRO_EYEBROW,
      title: DEFAULT_SHOP_INTRO_TITLE,
      body: DEFAULT_SHOP_INTRO_BODY,
      ctaLabel: DEFAULT_SHOP_INTRO_CTA_LABEL,
      isDefault: true,
      updatedAt: undefined,
    };
  }

  const settings = await getHomepageSectionSettingsCached();
  return settings.shopIntro;
}

export async function updateShopIntroSectionSetting({
  eyebrow,
  title,
  body,
  ctaLabel,
}: {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
}) {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  const normalizedEyebrow = eyebrow.trim();
  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();
  const normalizedCtaLabel = ctaLabel.trim();

  if (!normalizedEyebrow) {
    throw new Error("Enter the shop section eyebrow.");
  }

  if (!normalizedTitle) {
    throw new Error("Enter the shop section heading.");
  }

  if (!normalizedBody) {
    throw new Error("Enter the shop section text.");
  }

  if (!normalizedCtaLabel) {
    throw new Error("Enter the shop section button label.");
  }

  await upsertStoreSetting(SHOP_INTRO_EYEBROW_KEY, normalizedEyebrow);
  await upsertStoreSetting(SHOP_INTRO_TITLE_KEY, normalizedTitle);
  await upsertStoreSetting(SHOP_INTRO_BODY_KEY, normalizedBody);
  await upsertStoreSetting(SHOP_INTRO_CTA_LABEL_KEY, normalizedCtaLabel);

  return {
    eyebrow: normalizedEyebrow,
    title: normalizedTitle,
    body: normalizedBody,
    ctaLabel: normalizedCtaLabel,
  };
}

export async function getBrandStorySectionSetting() {
  if (!hasCloudflareD1Config()) {
    return {
      body: DEFAULT_BRAND_STORY_BODY,
      isDefault: true,
      updatedAt: undefined,
    };
  }

  const settings = await getHomepageSectionSettingsCached();
  return settings.brandStory;
}

export async function getSiteLockSetting(defaultEnabled: boolean) {
  if (!hasCloudflareD1Config()) {
    return {
      enabled: defaultEnabled,
      isDefault: true,
      updatedAt: undefined,
    };
  }

  return getSiteLockSettingCached(defaultEnabled);
}

export async function getHomepageSectionSettings() {
  if (!hasCloudflareD1Config()) {
    return {
      cookieOfMonth: {
        title: DEFAULT_COOKIE_OF_MONTH_TITLE,
        ctaLabel: DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
        productSlug: DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
        isDefault: true,
        updatedAt: undefined,
      },
      shopIntro: {
        eyebrow: DEFAULT_SHOP_INTRO_EYEBROW,
        title: DEFAULT_SHOP_INTRO_TITLE,
        body: DEFAULT_SHOP_INTRO_BODY,
        ctaLabel: DEFAULT_SHOP_INTRO_CTA_LABEL,
        isDefault: true,
        updatedAt: undefined,
      },
      brandStory: {
        body: DEFAULT_BRAND_STORY_BODY,
        isDefault: true,
        updatedAt: undefined,
      },
    };
  }

  return getHomepageSectionSettingsCached();
}

export async function updateBrandStorySectionSetting({
  body,
}: {
  body: string;
}) {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  const normalizedBody = body.trim();

  if (!normalizedBody) {
    throw new Error("Enter the brand story text.");
  }

  await upsertStoreSetting(BRAND_STORY_BODY_KEY, normalizedBody);

  return {
    body: normalizedBody,
  };
}

export async function updateSiteLockEnabled(enabled: boolean) {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  await upsertStoreSetting(SITE_LOCK_ENABLED_KEY, enabled ? "1" : "0");

  return {
    enabled,
  };
}
