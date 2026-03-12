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

function getD1Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    return null;
  }

  return { accountId, databaseId, apiToken };
}

export function hasCloudflareD1Config() {
  return Boolean(getD1Config());
}

export async function queryCloudflareD1<Row>(
  sql: string,
  params: Array<string | number | null> = [],
): Promise<Row[]> {
  const config = getD1Config();

  if (!config) {
    throw new Error("Cloudflare D1 is not configured.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      next: { revalidate: 300 },
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

  return payload.result?.[0]?.results ?? [];
}
