import { getCloudflareContext } from "@opennextjs/cloudflare";

const D1_BINDING_ERROR_MESSAGE = "Cloudflare D1 binding is not configured.";

type D1RequestOptions = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

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
  if (cachedD1Binding) {
    return true;
  }

  try {
    const { env } = getCloudflareContext();
    if (env.DB) {
      cachedD1Binding = env.DB;
      return true;
    }
  } catch {
    return false;
  }

  return false;
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

async function getRequiredD1Binding() {
  const db = await getD1Binding();

  if (!db) {
    throw new Error(D1_BINDING_ERROR_MESSAGE);
  }

  return db;
}

export async function queryCloudflareD1<Row>(
  sql: string,
  params: Array<string | number | null> = [],
  options: D1RequestOptions = { next: { revalidate: 300 } },
): Promise<Row[]> {
  void options;
  const db = await getRequiredD1Binding();
  const result = await bindStatement(db, sql, params).all<Row>();
  return result.results ?? [];
}

export async function executeCloudflareD1(
  sql: string,
  params: Array<string | number | null> = [],
) {
  const db = await getRequiredD1Binding();
  return bindStatement(db, sql, params).run();
}
