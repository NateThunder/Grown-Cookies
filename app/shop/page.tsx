import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import QuickAddButton from "@/components/quick-add-button";
import styles from "./page.module.css";
import { MIN_GIFT_CARD_AMOUNT_CENTS, formatGiftCardAmount } from "@/lib/gift-card-amounts";
import { getAllProducts, type ShopProduct } from "@/lib/products";
import { getProductImageForVariant, PRODUCT_IMAGE_VARIANTS } from "@/lib/product-image-variants";
import SiteHeader from "@/components/site-header";
import ShopSortDropdown from "@/components/shop-sort-dropdown";

type SearchParamValue = string | string[] | undefined;

type ShopPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

type SortOption = {
  value: ShopSortValue;
  label: string;
};

type ShopSortValue =
  | "manual"
  | "best-selling"
  | "title-ascending"
  | "title-descending"
  | "price-ascending"
  | "price-descending"
  | "created-ascending"
  | "created-descending";

const SORT_OPTIONS: SortOption[] = [
  { value: "manual", label: "Featured" },
  { value: "best-selling", label: "Best selling" },
  { value: "title-ascending", label: "Alphabetically, A-Z" },
  { value: "title-descending", label: "Alphabetically, Z-A" },
  { value: "price-ascending", label: "Price, low to high" },
  { value: "price-descending", label: "Price, high to low" },
  { value: "created-ascending", label: "Date, old to new" },
  { value: "created-descending", label: "Date, new to old" },
];

const GIFT_CARD_FRAME_IMAGE = "/gift card frame no crumbs.png";

export const metadata: Metadata = {
  title: "Shop Cookies",
  description:
    "Browse Grown Cookies flavours, gift cards, and variety boxes baked fresh for delivery across the UK.",
  alternates: {
    canonical: "/shop",
  },
  openGraph: {
    title: "Shop Grown Cookies",
    description: "Browse handcrafted cookie flavours, gift cards, and variety boxes.",
    url: "/shop",
    type: "website",
  },
};

function getFirstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePrice(price: string) {
  const normalized = price.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSortablePrice(product: ShopProduct) {
  return product.isGiftCard ? MIN_GIFT_CARD_AMOUNT_CENTS / 100 : parsePrice(product.price);
}

function parseDate(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortProducts(products: ShopProduct[], sort: ShopSortValue) {
  const items = [...products];

  items.sort((left, right) => {
    switch (sort) {
      case "title-ascending":
        return left.name.localeCompare(right.name);
      case "title-descending":
        return right.name.localeCompare(left.name);
      case "price-ascending":
        return getSortablePrice(left) - getSortablePrice(right) || left.name.localeCompare(right.name);
      case "price-descending":
        return getSortablePrice(right) - getSortablePrice(left) || left.name.localeCompare(right.name);
      case "created-ascending":
        return parseDate(left.createdAt) - parseDate(right.createdAt) || left.name.localeCompare(right.name);
      case "created-descending":
        return parseDate(right.createdAt) - parseDate(left.createdAt) || left.name.localeCompare(right.name);
      case "best-selling":
        return (
          Number(right.featured) - Number(left.featured) ||
          (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name)
        );
      case "manual":
      default: {
        const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder || left.name.localeCompare(right.name);
      }
    }
  });

  return items;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const products = await getAllProducts();
  const params = await searchParams;
  const requestedSort = getFirstValue(params.sort);
  const activeSort = SORT_OPTIONS.some((option) => option.value === requestedSort)
    ? (requestedSort as ShopSortValue)
    : "manual";
  const sortedProducts = sortProducts(products, activeSort);

  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="shop" products={products} variant="hero" showAnnouncement={false} />

      <section className={styles.shop}>
        <h1>Shop</h1>

        <div className={styles.toolsRow}>
          <span className={styles.itemCount}>{sortedProducts.length} items</span>
          <div className={styles.sorting}>
            <ShopSortDropdown options={SORT_OPTIONS} activeSort={activeSort} />
          </div>
        </div>

        <div className={styles.grid}>
          {sortedProducts.map((product, index) => {
            const preloadImage = index < 4;
            const shopCardImage = getProductImageForVariant(
              product,
              PRODUCT_IMAGE_VARIANTS.shopCard.key,
            );

            return (
              <article
                key={product.slug}
                className={`${styles.card} whiteFrame ${
                  product.isGiftCard ? styles.giftCardPositioned : ""
                }`}
              >
                <div className={styles.cardImageWrap}>
                  <Link href={`/shop/${product.slug}`} className={styles.cardMediaLink}>
                    {product.isGiftCard ? (
                      <Image
                        src={GIFT_CARD_FRAME_IMAGE}
                        alt={product.imageAlt ?? product.name}
                        fill
                        preload={preloadImage}
                        sizes="(max-width: 520px) 100vw, (max-width: 760px) 50vw, (max-width: 1080px) 33vw, 25vw"
                        className={styles.cardImage}
                      />
                    ) : shopCardImage ? (
                      <Image
                        src={shopCardImage}
                        alt={product.imageAlt ?? product.name}
                        fill
                        preload={preloadImage}
                        sizes="(max-width: 520px) 100vw, (max-width: 760px) 50vw, (max-width: 1080px) 33vw, 25vw"
                        className={styles.cardImage}
                      />
                    ) : null}
                  </Link>
                  <QuickAddButton product={product} className={styles.quickAdd} />
                </div>
                <Link href={`/shop/${product.slug}`} className={styles.cardContentLink}>
                  <h3>{product.name}</h3>
                  <p>
                    {product.isGiftCard
                      ? `From ${formatGiftCardAmount(MIN_GIFT_CARD_AMOUNT_CENTS)}`
                      : product.price}
                  </p>
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
