import { hasCloudflareD1Config, queryCloudflareD1 } from "./cloudflare-d1";

type ProductBase = {
  slug: string;
  name: string;
  price: string;
  description: string;
  featured?: boolean;
  sortOrder?: number;
  relatedSlugs?: string[];
};

export type ShopProduct = ProductBase & {
  image?: string;
  imageAlt?: string;
  isGiftCard?: boolean;
};

type StaticProductRecord = ProductBase & {
  imageKey?: string;
  imageAlt?: string;
  isGiftCard?: boolean;
};

type ProductRow = {
  slug: string;
  name: string;
  price: string;
  description: string;
  image_key: string | null;
  alt_text: string | null;
  is_gift_card: number;
  featured: number;
  sort_order: number | null;
  related_slugs: string | null;
};

const LOCAL_IMAGE_FALLBACKS: Record<string, string> = {
  "gift-card/growncookies-1024-transparent.png":
    "/growncookies-1024-transparent.png",
};

const FALLBACK_PRODUCTS: StaticProductRecord[] = [
  {
    slug: "dark-choc-maldon-salt",
    name: "Dark Choc & Maldon Salt",
    price: "GBP 22.00",
    imageKey: "Dark_Choc-_Salt/_DSC6327.jpg",
    imageAlt: "Dark Choc & Maldon Salt cookie",
    description:
      "Indulge in the rich decadence of our Dark Choc & Maldon Salt Cookie. Bursting with delicious 70% dark chocolate, this elevated treat is further enhanced by the addition of Maldon salt, adding a unique and luxurious flavour to each bite.",
    featured: true,
    sortOrder: 10,
    relatedSlugs: [
      "double-chocolate-hazelnut",
      "matcha-white-chocolate",
      "red-velvet",
      "granola-raisin",
    ],
  },
  {
    slug: "double-chocolate-hazelnut",
    name: "Double Choc & Hazelnut",
    price: "GBP 22.00",
    imageKey: "Double_Choc_Hazelnut/_DSC6200.jpg",
    imageAlt: "Double Choc & Hazelnut cookie",
    description:
      "Our Double Chocolate & Hazelnut cookie is packed with deep cocoa notes, crunchy roasted hazelnuts, and a soft center that stays rich in every bite.",
    featured: true,
    sortOrder: 20,
    relatedSlugs: [],
  },
  {
    slug: "gift-card",
    name: "Gift Card",
    price: "GBP 10.00",
    imageKey: "gift-card/growncookies-1024-transparent.png",
    imageAlt: "Grown Cookies gift card",
    isGiftCard: true,
    description:
      "Send a Grown Cookies gift card and let them choose their own flavour favourites. Perfect for birthdays, celebrations, and thoughtful surprises.",
    featured: true,
    sortOrder: 30,
    relatedSlugs: [],
  },
  {
    slug: "granola-raisin",
    name: "Granola Raisin",
    price: "GBP 22.00",
    imageKey: "Crunchy_Granola/_DSC6127.jpg",
    imageAlt: "Granola Raisin cookie",
    description:
      "A comforting oat-forward cookie with toasted granola clusters and juicy raisins for a warm, nostalgic bite.",
    featured: false,
    sortOrder: 40,
    relatedSlugs: [],
  },
  {
    slug: "matcha-white-chocolate",
    name: "Matcha White Chocolate",
    price: "GBP 22.00",
    imageKey: "Matcha/_DSC6441.jpg",
    imageAlt: "Matcha White Chocolate cookie",
    description:
      "Earthy matcha and creamy white chocolate come together for a balanced cookie with vibrant colour and smooth sweetness.",
    featured: false,
    sortOrder: 50,
    relatedSlugs: [],
  },
  {
    slug: "red-velvet",
    name: "Red Velvet",
    price: "GBP 22.00",
    imageKey: "Red_Velvet/_DSC6161.jpg",
    imageAlt: "Red Velvet cookie",
    description:
      "Our Red Velvet cookie blends cocoa richness with a velvety texture and a subtle tang for a bold dessert-style treat.",
    featured: false,
    sortOrder: 60,
    relatedSlugs: [],
  },
  {
    slug: "double-choc-box",
    name: "Double Choc Box",
    price: "GBP 22.00",
    imageKey: "Box_Shots/_DSC6145.jpg",
    imageAlt: "Double Choc Box",
    description:
      "A curated cookie box featuring crowd-favourite chocolate flavours, baked fresh and ready to share.",
    featured: false,
    sortOrder: 70,
    relatedSlugs: [],
  },
];

function buildProductImageUrl(imageKey?: string | null) {
  if (!imageKey) {
    return undefined;
  }

  if (/^https?:\/\//.test(imageKey)) {
    return imageKey;
  }

  const normalizedImageKey = imageKey.replace(/^\/+/, "");
  const r2PublicBaseUrl =
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "";

  if (r2PublicBaseUrl) {
    return `${r2PublicBaseUrl}/${normalizedImageKey}`;
  }

  return LOCAL_IMAGE_FALLBACKS[normalizedImageKey] ?? `/${normalizedImageKey}`;
}

function normalizeRelatedSlugs(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function mapStaticProduct(record: StaticProductRecord): ShopProduct {
  return {
    slug: record.slug,
    name: record.name,
    price: record.price,
    description: record.description,
    featured: record.featured,
    sortOrder: record.sortOrder,
    relatedSlugs: record.relatedSlugs,
    image: buildProductImageUrl(record.imageKey),
    imageAlt: record.imageAlt,
    isGiftCard: record.isGiftCard,
  };
}

function mapRowToProduct(row: ProductRow): ShopProduct {
  return {
    slug: row.slug,
    name: row.name,
    price: row.price,
    description: row.description,
    featured: Boolean(row.featured),
    sortOrder: row.sort_order ?? 0,
    relatedSlugs: normalizeRelatedSlugs(row.related_slugs),
    image: buildProductImageUrl(row.image_key),
    imageAlt: row.alt_text ?? undefined,
    isGiftCard: Boolean(row.is_gift_card),
  };
}

function sortProducts(products: ShopProduct[]) {
  return [...products].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

function getFallbackProducts() {
  return sortProducts(FALLBACK_PRODUCTS.map(mapStaticProduct));
}

async function fetchProductsFromD1() {
  const rows = await queryCloudflareD1<ProductRow>(
    `SELECT
       p.slug,
       p.name,
       p.price,
       p.description,
       p.is_gift_card,
       p.featured,
       p.sort_order,
       p.related_slugs,
       pi.image_key,
       pi.alt_text
     FROM products p
     LEFT JOIN product_images pi
       ON pi.product_id = p.id
      AND pi.is_primary = 1
     ORDER BY p.sort_order ASC, p.name ASC`,
  );

  return rows.map(mapRowToProduct);
}

export async function getAllProducts() {
  if (!hasCloudflareD1Config()) {
    return getFallbackProducts();
  }

  try {
    return sortProducts(await fetchProductsFromD1());
  } catch (error) {
    console.warn("Falling back to local product data.", error);
    return getFallbackProducts();
  }
}

export async function getFeaturedProducts(count = 3) {
  const products = await getAllProducts();
  const featuredProducts = products.filter((product) => product.featured);

  if (featuredProducts.length >= count) {
    return featuredProducts.slice(0, count);
  }

  return products.slice(0, count);
}

export async function getShopProduct(slug: string) {
  const products = await getAllProducts();
  return products.find((product) => product.slug === slug);
}

export async function getRelatedProducts(slug: string, count = 4) {
  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [product.slug, product]));
  const currentProduct = productMap.get(slug);

  if (!currentProduct) {
    return [];
  }

  const curatedProducts = (currentProduct.relatedSlugs ?? [])
    .map((itemSlug) => productMap.get(itemSlug))
    .filter((product): product is ShopProduct => Boolean(product));

  const fallbackProducts = products.filter(
    (product) => !product.isGiftCard && product.slug !== slug,
  );

  const combined = [...curatedProducts];

  for (const product of fallbackProducts) {
    if (!combined.some((item) => item.slug === product.slug)) {
      combined.push(product);
    }
  }

  return combined.slice(0, count);
}
