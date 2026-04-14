export const PRODUCT_IMAGE_VARIANTS = {
  homepagePolaroid: {
    key: "homepage_polaroid",
    label: "Homepage polaroid",
    formField: "imageVariantHomepagePolaroid",
    aspectRatio: 19 / 20,
    outputWidth: 1140,
    outputHeight: 1200,
  },
  cookieMonth: {
    key: "cookie_month",
    label: "Cookie of the month",
    formField: "imageVariantCookieMonth",
    aspectRatio: 1.11,
    outputWidth: 1332,
    outputHeight: 1200,
  },
  shopCard: {
    key: "shop_card",
    label: "Shop card",
    formField: "imageVariantShopCard",
    aspectRatio: 1 / 1.15,
    outputWidth: 1200,
    outputHeight: 1380,
  },
  productDetail: {
    key: "product_detail",
    label: "Product page",
    formField: "imageVariantProductDetail",
    aspectRatio: 1 / 1.08,
    outputWidth: 1200,
    outputHeight: 1296,
  },
} as const;

export type ProductImageVariant =
  (typeof PRODUCT_IMAGE_VARIANTS)[keyof typeof PRODUCT_IMAGE_VARIANTS]["key"];

export type ProductImageVariantMap<T = string> = Partial<Record<ProductImageVariant, T>>;

export const PRODUCT_IMAGE_VARIANT_OPTIONS = Object.values(PRODUCT_IMAGE_VARIANTS);

export const PRODUCT_IMAGE_VARIANT_KEYS = PRODUCT_IMAGE_VARIANT_OPTIONS.map(
  (variant) => variant.key,
) as ProductImageVariant[];

export const PRODUCT_IMAGE_VARIANT_FIELD_NAMES = PRODUCT_IMAGE_VARIANT_OPTIONS.reduce(
  (fields, variant) => {
    fields[variant.key] = variant.formField;
    return fields;
  },
  {} as Record<ProductImageVariant, string>,
);

export const PRIMARY_PRODUCT_IMAGE_VARIANT: ProductImageVariant = PRODUCT_IMAGE_VARIANTS.shopCard.key;

export function getProductImageForVariant(
  product: {
    image?: string;
    imageVariants?: ProductImageVariantMap<string>;
  },
  variant: ProductImageVariant,
) {
  return product.imageVariants?.[variant] ?? product.image;
}
