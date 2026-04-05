import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1QueryResult<Row> = {
  results?: Row[];
  success?: boolean;
  meta?: Record<string, unknown>;
};

type D1ApiResponse<Row> = {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<D1QueryResult<Row>>;
};

type D1RequestOptions = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

function getD1ApiConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    return null;
  }

  return { accountId, databaseId, apiToken };
}

function normalizeParams(params: Array<string | number | null>) {
  return params.map((value) => value ?? null);
}

let cachedD1Binding: D1Database | undefined;
let d1BindingPromise: Promise<D1Database | undefined> | null = null;

async function getD1Binding() {
  if (cachedD1Binding) {
    return cachedD1Binding;
  }

  if (!d1BindingPromise) {
    d1BindingPromise = (async () => {
      try {
        const { env } = await getCloudflareContext({ async: true });
        return env.DB;
      } catch {
        return undefined;
      }
    })();
  }

  const db = await d1BindingPromise;
  if (db) {
    cachedD1Binding = db;
  } else {
    d1BindingPromise = null;
  }

  return db;
}

export function hasCloudflareD1Config() {
  return Boolean(process.env.CLOUDFLARE_D1_DATABASE_ID || getD1ApiConfig());
}

async function requestCloudflareD1ViaApi<Row>(
  sql: string,
  params: Array<string | number | null> = [],
  options: D1RequestOptions = { next: { revalidate: 300 } },
): Promise<D1QueryResult<Row>> {
  const config = getD1ApiConfig();

  if (!config) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      ...options,
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params: normalizeParams(params) }),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudflare D1 request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as D1ApiResponse<Row>;

  if (!payload.success) {
    const errorMessage =
      payload.errors?.map((error) => error.message).filter(Boolean).join(", ") ||
      "Cloudflare D1 query failed.";
    throw new Error(errorMessage);
  }

  return payload.result?.[0] ?? {};
}

function bindStatement(
  db: D1Database,
  sql: string,
  params: Array<string | number | null>,
) {
  const statement = db.prepare(sql);
  const normalizedParams = normalizeParams(params);
  return normalizedParams.length > 0 ? statement.bind(...normalizedParams) : statement;
}

export async function queryCloudflareD1<Row>(
  sql: string,
  params: Array<string | number | null> = [],
  options: D1RequestOptions = { next: { revalidate: 300 } },
): Promise<Row[]> {
  const db = await getD1Binding();

  if (db) {
    try {
      const result = await bindStatement(db, sql, params).all<Row>();
      return result.results ?? [];
    } catch (error) {
      if (!getD1ApiConfig()) {
        throw error;
      }
    }
  }

  const result = await requestCloudflareD1ViaApi<Row>(sql, params, options);
  return result.results ?? [];
}

export async function executeCloudflareD1(
  sql: string,
  params: Array<string | number | null> = [],
) {
  const db = await getD1Binding();

  if (db) {
    try {
      return await bindStatement(db, sql, params).run();
    } catch (error) {
      if (!getD1ApiConfig()) {
        throw error;
      }
    }
  }

  return requestCloudflareD1ViaApi<never>(sql, params, { cache: "no-store" });
}
