import { queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { STRIPE_CHECKOUT_ORDER_STATUS } from "@/lib/stripe-checkout";

export const ADMIN_ANALYTICS_RANGES = {
  "7d": {
    days: 7,
    label: "Last 7 days",
  },
  "30d": {
    days: 30,
    label: "Last 30 days",
  },
  "90d": {
    days: 90,
    label: "Last 90 days",
  },
} as const;

export type AdminAnalyticsRange = keyof typeof ADMIN_ANALYTICS_RANGES;
export const ADMIN_ANALYTICS_CUSTOM_MAX_DAYS = 366;

export type AdminAnalyticsDateRange = {
  startDate: string;
  endDate: string;
  startDateTime: string;
  dateKeys: string[];
};

export type AdminSalesAnalytics = {
  dateRange: AdminAnalyticsDateRange;
  currency: string;
  orderCount: number;
  revenueCents: number;
  subtotalCents: number;
  shippingCents: number;
  tipCents: number;
  averageOrderValueCents: number;
  itemsSold: number;
  topProducts: AdminSalesProduct[];
  dailyRevenue: AdminSalesDailyRow[];
};

export type AdminSalesProduct = {
  slug: string;
  name: string;
  quantity: number;
  revenueCents: number;
};

export type AdminSalesDailyRow = {
  date: string;
  orderCount: number;
  revenueCents: number;
};

export type AdminGoogleAnalyticsReport = {
  dateRange: AdminAnalyticsDateRange;
  activeUsers: number;
  sessions: number;
  pageViews: number;
  engagedSessions: number;
  averageSessionDurationSeconds: number;
  topPages: AdminTrafficPage[];
  topSources: AdminTrafficBreakdown[];
  devices: AdminTrafficBreakdown[];
  countries: AdminTrafficBreakdown[];
  dailyTraffic: AdminTrafficDailyRow[];
};

export type AdminTrafficPage = {
  path: string;
  title: string;
  pageViews: number;
  activeUsers: number;
  sessions: number;
};

export type AdminTrafficBreakdown = {
  label: string;
  sessions: number;
  activeUsers: number;
};

export type AdminTrafficDailyRow = {
  date: string;
  sessions: number;
  activeUsers: number;
  pageViews: number;
};

export type AdminGoogleAnalyticsResult =
  | {
      status: "ok";
      report: AdminGoogleAnalyticsReport;
      message?: undefined;
    }
  | {
      status: "missing_config" | "error";
      report: null;
      message: string;
    };

type GoogleAnalyticsConfig = {
  propertyId: string;
  clientEmail: string;
  privateKey: string;
};

type GoogleAnalyticsTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type GoogleAnalyticsMetricValue = {
  value?: string;
};

type GoogleAnalyticsDimensionValue = {
  value?: string;
};

type GoogleAnalyticsReportRow = {
  dimensionValues?: GoogleAnalyticsDimensionValue[];
  metricValues?: GoogleAnalyticsMetricValue[];
};

type GoogleAnalyticsReportResponse = {
  rows?: GoogleAnalyticsReportRow[];
  totals?: Array<{
    metricValues?: GoogleAnalyticsMetricValue[];
  }>;
  error?: {
    message?: string;
  };
};

const COMPLETED_ORDER_STATUSES = [
  STRIPE_CHECKOUT_ORDER_STATUS.paid,
  "delivered",
] as const;
const GOOGLE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

let googleAnalyticsTokenCache: GoogleAnalyticsTokenCache | null = null;

export function parseAdminAnalyticsRange(value: unknown): AdminAnalyticsRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

export function getAdminAnalyticsDateRange(range: AdminAnalyticsRange): AdminAnalyticsDateRange {
  const { days } = ADMIN_ANALYTICS_RANGES[range];
  const today = getUtcToday();

  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days + 1);

  return getAdminAnalyticsDateRangeFromDates(start, today);
}

export function getCustomAdminAnalyticsDateRange(
  startValue: unknown,
  endValue: unknown,
): AdminAnalyticsDateRange | null {
  const start = parseDateInput(startValue);
  const end = parseDateInput(endValue);

  if (!start || !end || start > end) {
    return null;
  }

  const today = getUtcToday();
  const cappedEnd = end > today ? today : end;

  if (start > cappedEnd) {
    return null;
  }

  const days = getDateRangeDayCount(start, cappedEnd);

  if (days > ADMIN_ANALYTICS_CUSTOM_MAX_DAYS) {
    return null;
  }

  return getAdminAnalyticsDateRangeFromDates(start, cappedEnd);
}

export function getAdminAnalyticsDateRangeDayCount(dateRange: AdminAnalyticsDateRange) {
  const start = parseDateInput(dateRange.startDate);
  const end = parseDateInput(dateRange.endDate);

  if (!start || !end || start > end) {
    return 0;
  }

  return getDateRangeDayCount(start, end);
}

function getAdminAnalyticsDateRangeFromDates(
  start: Date,
  end: Date,
): AdminAnalyticsDateRange {
  const days = getDateRangeDayCount(start, end);
  const dateKeys = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return formatDateKey(date);
  });

  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end),
    startDateTime: `${formatDateKey(start)} 00:00:00`,
    dateKeys,
  };
}

function getUtcToday() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function parseDateInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || formatDateKey(date) !== value) {
    return null;
  }

  return date;
}

function getDateRangeDayCount(start: Date, end: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

function formatDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeInteger(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGoogleDate(value: string) {
  const trimmed = value.trim();

  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  return trimmed;
}

function getGoogleAnalyticsConfig(): GoogleAnalyticsConfig | null {
  const propertyId = normalizeText(process.env.GOOGLE_ANALYTICS_PROPERTY_ID).replace(
    /^properties\//,
    "",
  );
  const clientEmail = normalizeText(process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL);
  const rawPrivateKey = normalizeText(process.env.GOOGLE_ANALYTICS_PRIVATE_KEY);

  if (!propertyId || !clientEmail || !rawPrivateKey) {
    return null;
  }

  let privateKey = rawPrivateKey;

  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  return {
    propertyId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

function base64UrlEncode(input: string | Uint8Array) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);

  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function privateKeyPemToArrayBuffer(privateKey: string) {
  const base64 = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bytes = Buffer.from(base64, "base64");

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function signGoogleServiceAccountJwt(config: GoogleAnalyticsConfig) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available for Google Analytics authentication.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claimSet = {
    iss: config.clientEmail,
    scope: GOOGLE_ANALYTICS_SCOPE,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };
  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claimSet),
  )}`;
  const privateKey = await globalThis.crypto.subtle.importKey(
    "pkcs8",
    privateKeyPemToArrayBuffer(config.privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    Buffer.from(unsignedJwt, "utf8"),
  );

  return `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getGoogleAnalyticsAccessToken(config: GoogleAnalyticsConfig) {
  const now = Date.now();

  if (googleAnalyticsTokenCache && googleAnalyticsTokenCache.expiresAt > now + 60_000) {
    return googleAnalyticsTokenCache.accessToken;
  }

  const assertion = await signGoogleServiceAccountJwt(config);
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Google Analytics authentication failed.",
    );
  }

  googleAnalyticsTokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + Math.max(60, payload.expires_in ?? 3600) * 1000,
  };

  return payload.access_token;
}

function getMetric(row: GoogleAnalyticsReportRow | undefined, index: number) {
  return normalizeNumber(row?.metricValues?.[index]?.value);
}

function getDimension(row: GoogleAnalyticsReportRow, index: number, fallback = "Unknown") {
  return normalizeText(row.dimensionValues?.[index]?.value) || fallback;
}

async function runGoogleAnalyticsReport(
  config: GoogleAnalyticsConfig,
  accessToken: string,
  dateRange: AdminAnalyticsDateRange,
  body: {
    dimensions?: Array<{ name: string }>;
    metrics: Array<{ name: string }>;
    limit?: number;
    orderBys?: unknown[];
  },
) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        dateRanges: [
          {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          },
        ],
      }),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as GoogleAnalyticsReportResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || `Google Analytics request failed (${response.status}).`);
  }

  return payload;
}

function mapTrafficBreakdownRows(rows: GoogleAnalyticsReportRow[] = []): AdminTrafficBreakdown[] {
  return rows.map((row) => ({
    label: getDimension(row, 0),
    sessions: getMetric(row, 0),
    activeUsers: getMetric(row, 1),
  }));
}

export async function getAdminGoogleAnalyticsReport(
  dateRange: AdminAnalyticsDateRange,
): Promise<AdminGoogleAnalyticsResult> {
  const config = getGoogleAnalyticsConfig();

  if (!config) {
    return {
      status: "missing_config",
      report: null,
      message:
        "Add GOOGLE_ANALYTICS_PROPERTY_ID, GOOGLE_ANALYTICS_CLIENT_EMAIL, and GOOGLE_ANALYTICS_PRIVATE_KEY to show traffic analytics.",
    };
  }

  try {
    const accessToken = await getGoogleAnalyticsAccessToken(config);
    const metricOrder = {
      metric: {
        metricName: "sessions",
      },
      desc: true,
    };
    const [
      summaryResponse,
      topPagesResponse,
      topSourcesResponse,
      devicesResponse,
      countriesResponse,
      dailyTrafficResponse,
    ] = await Promise.all([
      runGoogleAnalyticsReport(config, accessToken, dateRange, {
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagedSessions" },
          { name: "averageSessionDuration" },
        ],
      }),
      runGoogleAnalyticsReport(config, accessToken, dateRange, {
        dimensions: [{ name: "pagePathPlusQueryString" }, { name: "pageTitle" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "sessions" },
        ],
        limit: 8,
        orderBys: [
          {
            metric: {
              metricName: "screenPageViews",
            },
            desc: true,
          },
        ],
      }),
      runGoogleAnalyticsReport(config, accessToken, dateRange, {
        dimensions: [{ name: "sessionSourceMedium" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: 8,
        orderBys: [metricOrder],
      }),
      runGoogleAnalyticsReport(config, accessToken, dateRange, {
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: 8,
        orderBys: [metricOrder],
      }),
      runGoogleAnalyticsReport(config, accessToken, dateRange, {
        dimensions: [{ name: "country" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: 8,
        orderBys: [metricOrder],
      }),
      runGoogleAnalyticsReport(config, accessToken, dateRange, {
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "screenPageViews" },
        ],
        limit: getAdminAnalyticsDateRangeDayCount(dateRange),
        orderBys: [
          {
            dimension: {
              dimensionName: "date",
            },
          },
        ],
      }),
    ]);

    const summaryRow = summaryResponse.rows?.[0] ?? summaryResponse.totals?.[0];

    return {
      status: "ok",
      report: {
        dateRange,
        activeUsers: getMetric(summaryRow, 0),
        sessions: getMetric(summaryRow, 1),
        pageViews: getMetric(summaryRow, 2),
        engagedSessions: getMetric(summaryRow, 3),
        averageSessionDurationSeconds: getMetric(summaryRow, 4),
        topPages: (topPagesResponse.rows ?? []).map((row) => ({
          path: getDimension(row, 0, "/"),
          title: getDimension(row, 1, "Untitled page"),
          pageViews: getMetric(row, 0),
          activeUsers: getMetric(row, 1),
          sessions: getMetric(row, 2),
        })),
        topSources: mapTrafficBreakdownRows(topSourcesResponse.rows),
        devices: mapTrafficBreakdownRows(devicesResponse.rows),
        countries: mapTrafficBreakdownRows(countriesResponse.rows),
        dailyTraffic: (dailyTrafficResponse.rows ?? []).map((row) => ({
          date: normalizeGoogleDate(getDimension(row, 0, "")),
          sessions: getMetric(row, 0),
          activeUsers: getMetric(row, 1),
          pageViews: getMetric(row, 2),
        })),
      },
    };
  } catch (error) {
    return {
      status: "error",
      report: null,
      message:
        error instanceof Error
          ? error.message
          : "Google Analytics data could not be loaded.",
    };
  }
}

export async function getAdminSalesAnalytics(
  dateRange: AdminAnalyticsDateRange,
): Promise<AdminSalesAnalytics> {
  const completedStatusParams = [...COMPLETED_ORDER_STATUSES];
  const [summaryRows, itemRows, topProductRows, dailyRows] = await Promise.all([
    queryCloudflareD1<{
      order_count: number | string;
      revenue_cents: number | string;
      subtotal_cents: number | string;
      shipping_cents: number | string;
      tip_cents: number | string;
      currency: string | null;
    }>(
      `SELECT
         COUNT(1) AS order_count,
         COALESCE(SUM(total_cents), 0) AS revenue_cents,
         COALESCE(SUM(subtotal_cents), 0) AS subtotal_cents,
         COALESCE(SUM(shipping_cents), 0) AS shipping_cents,
         COALESCE(SUM(tip_cents), 0) AS tip_cents,
         COALESCE(MAX(currency), 'gbp') AS currency
       FROM orders
       WHERE status IN (?, ?)
         AND datetime(created_at) >= datetime(?)`,
      [...completedStatusParams, dateRange.startDateTime],
      { cache: "no-store" },
    ),
    queryCloudflareD1<{ items_sold: number | string }>(
      `SELECT COALESCE(SUM(oi.quantity), 0) AS items_sold
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN (?, ?)
         AND datetime(o.created_at) >= datetime(?)`,
      [...completedStatusParams, dateRange.startDateTime],
      { cache: "no-store" },
    ),
    queryCloudflareD1<{
      slug: string | null;
      name: string | null;
      quantity: number | string;
      revenue_cents: number | string;
    }>(
      `SELECT
         oi.product_slug AS slug,
         oi.product_name AS name,
         COALESCE(SUM(oi.quantity), 0) AS quantity,
         COALESCE(SUM(oi.line_total_cents), 0) AS revenue_cents
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN (?, ?)
         AND datetime(o.created_at) >= datetime(?)
       GROUP BY oi.product_slug, oi.product_name
       ORDER BY revenue_cents DESC, quantity DESC, name ASC
       LIMIT 8`,
      [...completedStatusParams, dateRange.startDateTime],
      { cache: "no-store" },
    ),
    queryCloudflareD1<{
      date_key: string;
      order_count: number | string;
      revenue_cents: number | string;
    }>(
      `SELECT
         date(created_at) AS date_key,
         COUNT(1) AS order_count,
         COALESCE(SUM(total_cents), 0) AS revenue_cents
       FROM orders
       WHERE status IN (?, ?)
         AND datetime(created_at) >= datetime(?)
       GROUP BY date(created_at)
       ORDER BY date_key ASC`,
      [...completedStatusParams, dateRange.startDateTime],
      { cache: "no-store" },
    ),
  ]);

  const summary = summaryRows[0];
  const orderCount = normalizeInteger(summary?.order_count);
  const revenueCents = normalizeInteger(summary?.revenue_cents);
  const dailyRowsByDate = new Map(
    dailyRows.map((row) => [
      row.date_key,
      {
        orderCount: normalizeInteger(row.order_count),
        revenueCents: normalizeInteger(row.revenue_cents),
      },
    ]),
  );

  return {
    dateRange,
    currency: normalizeText(summary?.currency) || "gbp",
    orderCount,
    revenueCents,
    subtotalCents: normalizeInteger(summary?.subtotal_cents),
    shippingCents: normalizeInteger(summary?.shipping_cents),
    tipCents: normalizeInteger(summary?.tip_cents),
    averageOrderValueCents: orderCount > 0 ? Math.round(revenueCents / orderCount) : 0,
    itemsSold: normalizeInteger(itemRows[0]?.items_sold),
    topProducts: topProductRows.map((row) => ({
      slug: normalizeText(row.slug),
      name: normalizeText(row.name) || "Unknown product",
      quantity: normalizeInteger(row.quantity),
      revenueCents: normalizeInteger(row.revenue_cents),
    })),
    dailyRevenue: dateRange.dateKeys.map((date) => ({
      date,
      orderCount: dailyRowsByDate.get(date)?.orderCount ?? 0,
      revenueCents: dailyRowsByDate.get(date)?.revenueCents ?? 0,
    })),
  };
}
