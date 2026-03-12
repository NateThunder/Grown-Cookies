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

export type ShopProduct =
  | (ProductBase & {
      image: string;
      isGiftCard?: false;
    })
  | (ProductBase & {
      isGiftCard: true;
      image?: undefined;
    });

type ProductRow = {
  slug: string;
  name: string;
  price: string;
  description: string;
  image_url: string | null;
  is_gift_card: number;
  featured: number;
  sort_order: number | null;
  related_slugs: string | null;
};

const FALLBACK_PRODUCTS: ShopProduct[] = [
  {
    slug: "dark-choc-maldon-salt",
    name: "Dark Choc & Maldon Salt",
    price: "GBP 22.00",
    image: "/Dark_Choc-_Salt/_DSC6327.jpg",
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
    name: "Double Chocolate & Hazelnut",
    price: "GBP 22.00",
    image: "/Double_Choc_Hazelnut/_DSC6200.jpg",
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
    image: "/Crunchy_Granola/_DSC6127.jpg",
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
    image: "/Matcha/_DSC6441.jpg",
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
    image: "/Red_Velvet/_DSC6161.jpg",
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
    image: "/Box_Shots/_DSC6145.jpg",
    description:
      "A curated cookie box featuring crowd-favourite chocolate flavours, baked fresh and ready to share.",
    featured: false,
    sortOrder: 70,
    relatedSlugs: [],
  },
];

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

function mapRowToProduct(row: ProductRow): ShopProduct {
  const base = {
    slug: row.slug,
    name: row.name,
    price: row.price,
    description: row.description,
    featured: Boolean(row.featured),
    sortOrder: row.sort_order ?? 0,
    relatedSlugs: normalizeRelatedSlugs(row.related_slugs),
  };

  if (Boolean(row.is_gift_card)) {
    return {
      ...base,
      isGiftCard: true,
    };
  }

  return {
    ...base,
    image: row.image_url ?? "",
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

async function fetchProductsFromD1() {
  const rows = await queryCloudflareD1<ProductRow>(
    `SELECT slug, name, price, description, image_url, is_gift_card, featured, sort_order, related_slugs
     FROM products
     ORDER BY sort_order ASC, name ASC`,
  );

  return rows.map(mapRowToProduct);
}

export async function getAllProducts() {
  if (!hasCloudflareD1Config()) {
    return sortProducts(FALLBACK_PRODUCTS);
  }

  try {
    return sortProducts(await fetchProductsFromD1());
  } catch (error) {
    console.warn("Falling back to local product data.", error);
    return sortProducts(FALLBACK_PRODUCTS);
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
