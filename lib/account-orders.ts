import { hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";

export type AccountOrderSummary = {
  orderId: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
};

type AccountOrderRow = {
  public_id: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
};

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getAccountOrderSummariesByEmail(email: string): Promise<AccountOrderSummary[]> {
  const normalizedEmail = normalizeText(email).toLowerCase();

  if (!normalizedEmail || !hasCloudflareD1Config()) {
    return [];
  }

  const rows = await queryCloudflareD1<AccountOrderRow>(
    `SELECT
       public_id,
       status,
       total_cents,
       currency,
       created_at,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country
     FROM orders
     WHERE lower(email) = ?
     ORDER BY datetime(created_at) DESC, id DESC`,
    [normalizedEmail],
    { cache: "no-store" },
  );

  return rows.map((row) => ({
    orderId: normalizeText(row.public_id),
    status: normalizeText(row.status),
    totalCents: Number.isFinite(row.total_cents) ? row.total_cents : 0,
    currency: normalizeText(row.currency) || "gbp",
    createdAt: normalizeText(row.created_at),
    fullName: [normalizeText(row.first_name), normalizeText(row.last_name)].filter(Boolean).join(" "),
    addressLine1: normalizeText(row.address_line1),
    addressLine2: normalizeText(row.address_line2),
    city: normalizeText(row.city),
    postcode: normalizeText(row.postcode),
    country: normalizeText(row.country),
  }));
}
