export type ShopProduct =
  | {
      slug: string;
      name: string;
      price: string;
      description: string;
      image: string;
      isGiftCard?: false;
    }
  | {
      slug: string;
      name: string;
      price: string;
      description: string;
      isGiftCard: true;
    };

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    slug: "dark-choc-maldon-salt",
    name: "Dark Choc & Maldon Salt",
    price: "\u00A322.00",
    image: "/Dark_Choc-_Salt/_DSC6327.jpg",
    description:
      "Indulge in the rich decadence of our Dark Choc & Maldon Salt Cookie. Bursting with delicious 70% dark chocolate, this elevated treat is further enhanced by the addition of Maldon salt, adding a unique and luxurious flavour to each bite.",
  },
  {
    slug: "double-chocolate-hazelnut",
    name: "Double Chocolate & Hazelnut",
    price: "\u00A322.00",
    image: "/Double_Choc_Hazelnut/_DSC6200.jpg",
    description:
      "Our Double Chocolate & Hazelnut cookie is packed with deep cocoa notes, crunchy roasted hazelnuts, and a soft center that stays rich in every bite.",
  },
  {
    slug: "gift-card",
    name: "Gift Card",
    price: "\u00A310.00",
    isGiftCard: true,
    description:
      "Send a Grown Cookies gift card and let them choose their own flavour favourites. Perfect for birthdays, celebrations, and thoughtful surprises.",
  },
  {
    slug: "granola-raisin",
    name: "Granola Raisin",
    price: "\u00A322.00",
    image: "/Crunchy_Granola/_DSC6127.jpg",
    description:
      "A comforting oat-forward cookie with toasted granola clusters and juicy raisins for a warm, nostalgic bite.",
  },
  {
    slug: "matcha-white-chocolate",
    name: "Matcha White Chocolate",
    price: "\u00A322.00",
    image: "/Matcha/_DSC6441.jpg",
    description:
      "Earthy matcha and creamy white chocolate come together for a balanced cookie with vibrant colour and smooth sweetness.",
  },
  {
    slug: "red-velvet",
    name: "Red Velvet",
    price: "\u00A322.00",
    image: "/Red_Velvet/_DSC6161.jpg",
    description:
      "Our Red Velvet cookie blends cocoa richness with a velvety texture and a subtle tang for a bold dessert-style treat.",
  },
  {
    slug: "double-choc-box",
    name: "Double Choc Box",
    price: "\u00A322.00",
    image: "/Box_Shots/_DSC6145.jpg",
    description:
      "A curated cookie box featuring crowd-favourite chocolate flavours, baked fresh and ready to share.",
  },
];

const RELATED_BY_SLUG: Record<string, string[]> = {
  "dark-choc-maldon-salt": [
    "double-chocolate-hazelnut",
    "matcha-white-chocolate",
    "red-velvet",
    "granola-raisin",
  ],
};

const productMap = new Map(SHOP_PRODUCTS.map((product) => [product.slug, product]));

export function getShopProduct(slug: string): ShopProduct | undefined {
  return productMap.get(slug);
}

export function getRelatedProducts(slug: string, count = 4): ShopProduct[] {
  const curated = RELATED_BY_SLUG[slug] ?? [];
  const curatedProducts = curated
    .map((itemSlug) => productMap.get(itemSlug))
    .filter((product): product is ShopProduct => Boolean(product));

  const fallback = SHOP_PRODUCTS.filter(
    (product) => !product.isGiftCard && product.slug !== slug
  );

  const combined = [...curatedProducts];

  for (const product of fallback) {
    if (!combined.find((item) => item.slug === product.slug)) {
      combined.push(product);
    }
  }

  return combined.slice(0, count);
}
