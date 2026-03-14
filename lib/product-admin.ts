import { revalidatePath } from "next/cache";
import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "./cloudflare-d1";
import { uploadProductImageToR2 } from "./cloudflare-r2";
import { buildProductImageUrl } from "./product-image-url";

type AdminProductRow = {
  id: number;
  slug: string;
  name: string;
  price: string;
  description: string;
  allergens: string | null;
  is_gift_card: number;
  sort_order: number | null;
  featured_position: number | null;
  created_at: string;
  updated_at: string;
  image_id: number | null;
  image_key: string | null;
  alt_text: string | null;
};

type ColumnInfo = {
  name: string;
};

export type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  price: string;
  priceValue: string;
  description: string;
  allergens: string;
  featured: boolean;
  featuredPosition?: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  imageId?: number;
  imageKey?: string;
  imageUrl?: string;
  imageAlt: string;
  isGiftCard: boolean;
};

export type AdminProductInput = {
  productId?: number;
  name: string;
  priceValue: string;
  description: string;
  allergens: string;
  featured: boolean;
  featuredPosition: number;
  sortOrder: number;
  imageFile?: File | null;
  isGiftCard?: boolean;
};

const ADMIN_PRODUCT_SELECT = `SELECT
  p.id,
  p.slug,
  p.name,
  p.price,
  p.description,
  p.allergens,
  p.is_gift_card,
  p.sort_order,
  fp.position AS featured_position,
  p.created_at,
  p.updated_at,
  pi.id AS image_id,
  pi.image_key,
  pi.alt_text
FROM products p
LEFT JOIN featured_products fp
  ON fp.product_slug = p.slug
LEFT JOIN product_images pi
  ON pi.product_id = p.id
 AND pi.is_primary = 1`;

let schemaEnsured = false;

function assertAdminStoreIsReady() {
  if (!hasCloudflareD1Config()) {
    throw new Error("Cloudflare D1 is not configured.");
  }
}

async function ensureAdminSchema() {
  if (schemaEnsured) {
    return;
  }

  assertAdminStoreIsReady();

  const columns = await queryCloudflareD1<ColumnInfo>(
    "PRAGMA table_info(products)",
    [],
    { cache: "no-store" },
  );

  if (!columns.some((column) => column.name === "allergens")) {
    try {
      await executeCloudflareD1(
        "ALTER TABLE products ADD COLUMN allergens TEXT NOT NULL DEFAULT ''",
      );
    } catch (error) {
      if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
        throw error;
      }
    }
  }

  await executeCloudflareD1(
    `CREATE TABLE IF NOT EXISTS featured_products (
       product_slug TEXT NOT NULL PRIMARY KEY,
       position INTEGER NOT NULL UNIQUE,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (product_slug) REFERENCES products(slug) ON DELETE CASCADE
     )`,
  );

  await executeCloudflareD1(
    `CREATE INDEX IF NOT EXISTS idx_featured_products_position
       ON featured_products(position)`,
  );

  const featuredRowCount = await queryCloudflareD1<{ total: number }>(
    "SELECT COUNT(1) AS total FROM featured_products",
    [],
    { cache: "no-store" },
  );

  if ((featuredRowCount[0]?.total ?? 0) === 0) {
    await executeCloudflareD1(
      `INSERT OR IGNORE INTO featured_products (product_slug, position)
       SELECT slug, ROW_NUMBER() OVER (ORDER BY sort_order ASC, name ASC)
       FROM products
       WHERE featured = 1`,
    );
  }

  schemaEnsured = true;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizeRequiredText(value: string, label: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    throw new Error(`Enter a ${label}.`);
  }

  return normalized;
}

function normalizeAllergens(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeSortOrder(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function normalizeFeaturedPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

function parsePriceToValue(price: string) {
  const numericValue = price.replace(/[^0-9.]+/g, "").trim();
  return numericValue || "0.00";
}

function formatPriceFromValue(value: string) {
  const parsed = Number.parseFloat(value.trim());

  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error("Enter a valid price.");
  }

  return `GBP ${parsed.toFixed(2)}`;
}

function splitLegacyDescription(rawDescription: string, rawAllergens: string | null) {
  let description = rawDescription.trim();
  let allergens = rawAllergens?.trim() ?? "";
  const containsMatch = description.match(/\s*Contains:\s*([^.]*)\./i);

  if (!allergens && containsMatch?.[1]) {
    allergens = containsMatch[1].trim();
  }

  description = description
    .replace(
      /\s*Contains:\s*[^.]*\.\s*All cookies are baked in an environment that handles[^.]*\./i,
      "",
    )
    .replace(/\s*Contains:\s*[^.]*\./i, "")
    .trim();

  return { description, allergens };
}

function mapRowToAdminProduct(row: AdminProductRow): AdminProduct {
  const normalizedCopy = splitLegacyDescription(row.description, row.allergens);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    priceValue: parsePriceToValue(row.price),
    description: normalizedCopy.description,
    allergens: normalizedCopy.allergens,
    featured: row.featured_position !== null,
    featuredPosition: row.featured_position ?? undefined,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageId: row.image_id ?? undefined,
    imageKey: row.image_key ?? undefined,
    imageUrl: buildProductImageUrl(row.image_key),
    imageAlt: row.alt_text ?? `${row.name} product image`,
    isGiftCard: Boolean(row.is_gift_card),
  };
}

function sortProducts(products: AdminProduct[]) {
  return [...products].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

async function getAdminProductById(productId: number) {
  await ensureAdminSchema();

  const rows = await queryCloudflareD1<AdminProductRow>(
    `${ADMIN_PRODUCT_SELECT}
     WHERE p.id = ?
     ORDER BY p.sort_order ASC, p.name ASC
     LIMIT 1`,
    [productId],
    { cache: "no-store" },
  );

  return rows[0] ? mapRowToAdminProduct(rows[0]) : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(name: string) {
  const baseSlug = slugify(name) || `product-${Date.now()}`;
  const rows = await queryCloudflareD1<{ slug: string }>(
    "SELECT slug FROM products WHERE slug = ? OR slug LIKE ?",
    [baseSlug, `${baseSlug}-%`],
    { cache: "no-store" },
  );
  const existingSlugs = new Set(rows.map((row) => row.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;

  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }

  return `${baseSlug}-${counter}`;
}

async function upsertPrimaryImage({
  productId,
  productSlug,
  productName,
  imageId,
  imageFile,
}: {
  productId: number;
  productSlug: string;
  productName: string;
  imageId?: number;
  imageFile: File;
}) {
  const upload = await uploadProductImageToR2(productSlug, imageFile);
  const altText = `${productName} product image`;

  if (imageId) {
    await executeCloudflareD1(
      `UPDATE product_images
       SET image_key = ?, alt_text = ?, sort_order = 0, is_primary = 1
       WHERE id = ?`,
      [upload.key, altText, imageId],
    );
  } else {
    await executeCloudflareD1(
      `INSERT INTO product_images (
         product_id,
         image_key,
         alt_text,
         sort_order,
         is_primary
       ) VALUES (?, ?, ?, 0, 1)`,
      [productId, upload.key, altText],
    );
  }

  return upload.key;
}

function revalidateProductRoutes(slug: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath(`/shop/${slug}`);
  revalidatePath("/admin");
}

export async function getAdminProducts() {
  await ensureAdminSchema();

  const rows = await queryCloudflareD1<AdminProductRow>(
    `${ADMIN_PRODUCT_SELECT}
     ORDER BY p.sort_order ASC, p.name ASC`,
    [],
    { cache: "no-store" },
  );

  return sortProducts(rows.map(mapRowToAdminProduct));
}

export async function getNextProductSortOrder() {
  await ensureAdminSchema();

  const rows = await queryCloudflareD1<{ sort_order: number | null }>(
    "SELECT MAX(sort_order) AS sort_order FROM products",
    [],
    { cache: "no-store" },
  );

  return (rows[0]?.sort_order ?? 0) + 1;
}

export async function getNextFeaturedPosition() {
  await ensureAdminSchema();

  const rows = await queryCloudflareD1<{ position: number | null }>(
    "SELECT MAX(position) AS position FROM featured_products",
    [],
    { cache: "no-store" },
  );

  return (rows[0]?.position ?? 0) + 1;
}

async function syncFeaturedProduct(slug: string, featured: boolean, featuredPosition: number) {
  if (!featured) {
    await executeCloudflareD1("DELETE FROM featured_products WHERE product_slug = ?", [slug]);
    return;
  }

  const normalizedPosition = normalizeFeaturedPosition(featuredPosition);

  await executeCloudflareD1(
    `INSERT INTO featured_products (product_slug, position, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(product_slug) DO UPDATE SET
       position = excluded.position,
       updated_at = CURRENT_TIMESTAMP`,
    [slug, normalizedPosition],
  );
}

export async function moveFeaturedProductPosition(
  slug: string,
  direction: "up" | "down",
) {
  await ensureAdminSchema();

  const currentRows = await queryCloudflareD1<{ position: number }>(
    "SELECT position FROM featured_products WHERE product_slug = ? LIMIT 1",
    [slug],
    { cache: "no-store" },
  );
  const currentPosition = currentRows[0]?.position;

  if (!currentPosition) {
    return;
  }

  const targetRows = await queryCloudflareD1<{ product_slug: string; position: number }>(
    direction === "up"
      ? `SELECT product_slug, position
         FROM featured_products
         WHERE position < ?
         ORDER BY position DESC
         LIMIT 1`
      : `SELECT product_slug, position
         FROM featured_products
         WHERE position > ?
         ORDER BY position ASC
         LIMIT 1`,
    [currentPosition],
    { cache: "no-store" },
  );

  const target = targetRows[0];

  if (!target) {
    return;
  }

  await executeCloudflareD1(
    "UPDATE featured_products SET position = -1, updated_at = CURRENT_TIMESTAMP WHERE product_slug = ?",
    [slug],
  );
  await executeCloudflareD1(
    "UPDATE featured_products SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE product_slug = ?",
    [currentPosition, target.product_slug],
  );
  await executeCloudflareD1(
    "UPDATE featured_products SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE product_slug = ?",
    [target.position, slug],
  );

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function createAdminProduct(input: AdminProductInput) {
  await ensureAdminSchema();

  const name = normalizeRequiredText(input.name, "product name");
  const description = normalizeRequiredText(input.description, "description");
  const allergens = normalizeAllergens(input.allergens);
  const price = formatPriceFromValue(input.priceValue);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const slug = await generateUniqueSlug(name);

  await executeCloudflareD1(
    `INSERT INTO products (
       slug,
       name,
       price,
       description,
       allergens,
       is_gift_card,
       featured,
       sort_order,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      slug,
      name,
      price,
      description,
      allergens,
      input.isGiftCard ? 1 : 0,
      input.featured ? 1 : 0,
      sortOrder,
    ],
  );

  const productRows = await queryCloudflareD1<{ id: number }>(
    "SELECT id FROM products WHERE slug = ? LIMIT 1",
    [slug],
    { cache: "no-store" },
  );
  const productId = productRows[0]?.id;

  if (!productId) {
    throw new Error("The new product could not be reloaded after saving.");
  }

  await syncFeaturedProduct(slug, input.featured, input.featuredPosition);

  let imageWarning: string | undefined;

  if (input.imageFile && input.imageFile.size > 0) {
    try {
      await upsertPrimaryImage({
        productId,
        productSlug: slug,
        productName: name,
        imageFile: input.imageFile,
      });
      await executeCloudflareD1(
        "UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [productId],
      );
    } catch (error) {
      imageWarning =
        error instanceof Error ? error.message : "The product image could not be uploaded.";
    }
  }

  revalidateProductRoutes(slug);

  return {
    slug,
    imageWarning,
  };
}

export async function updateAdminProduct(input: AdminProductInput) {
  await ensureAdminSchema();

  if (!input.productId) {
    throw new Error("The product record could not be found.");
  }

  const existingProduct = await getAdminProductById(input.productId);

  if (!existingProduct) {
    throw new Error("The product record could not be found.");
  }

  const name = normalizeRequiredText(input.name, "product name");
  const description = normalizeRequiredText(input.description, "description");
  const allergens = normalizeAllergens(input.allergens);
  const price = formatPriceFromValue(input.priceValue);
  const sortOrder = normalizeSortOrder(input.sortOrder);

  await executeCloudflareD1(
    `UPDATE products
     SET name = ?,
         price = ?,
         description = ?,
         allergens = ?,
         is_gift_card = ?,
         featured = ?,
         sort_order = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      name,
      price,
      description,
      allergens,
      input.isGiftCard ? 1 : 0,
      input.featured ? 1 : 0,
      sortOrder,
      existingProduct.id,
    ],
  );

  await syncFeaturedProduct(existingProduct.slug, input.featured, input.featuredPosition);

  let imageWarning: string | undefined;

  try {
    if (input.imageFile && input.imageFile.size > 0) {
      await upsertPrimaryImage({
        productId: existingProduct.id,
        productSlug: existingProduct.slug,
        productName: name,
        imageId: existingProduct.imageId,
        imageFile: input.imageFile,
      });
      await executeCloudflareD1(
        "UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [existingProduct.id],
      );
    } else if (existingProduct.imageId) {
      await executeCloudflareD1(
        "UPDATE product_images SET alt_text = ? WHERE id = ?",
        [`${name} product image`, existingProduct.imageId],
      );
    }
  } catch (error) {
    imageWarning =
      error instanceof Error ? error.message : "The product image could not be uploaded.";
  }

  revalidateProductRoutes(existingProduct.slug);

  return {
    slug: existingProduct.slug,
    imageWarning,
  };
}