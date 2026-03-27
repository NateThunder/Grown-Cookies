import Image from "next/image";
import Link from "next/link";
import QuickAddButton from "@/components/quick-add-button";
import styles from "./page.module.css";
import { getAllProducts, type ShopProduct } from "@/lib/products";
import GiftCardTile from "@/components/gift-card-tile";
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

function getFirstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePrice(price: string) {
  const normalized = price.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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
        return parsePrice(left.price) - parsePrice(right.price) || left.name.localeCompare(right.name);
      case "price-descending":
        return parsePrice(right.price) - parsePrice(left.price) || left.name.localeCompare(right.name);
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
      <SiteHeader activeRoute="shop" products={products} />

      <section className={styles.shop}>
        <h1>Shop</h1>

        <div className={styles.toolsRow}>
          <span className={styles.itemCount}>{sortedProducts.length} items</span>
          <div className={styles.sorting}>
            <ShopSortDropdown options={SORT_OPTIONS} activeSort={activeSort} />
          </div>
        </div>

        <div className={styles.grid}>
          {sortedProducts.map((product) => {
            return (
              <article
                key={product.slug}
                className={`${styles.card} ${
                  product.isGiftCard ? styles.giftCardPositioned : ""
                }`}
              >
                <div className={styles.cardImageWrap}>
                  <Link href={`/shop/${product.slug}`} className={styles.cardMediaLink}>
                    {product.isGiftCard ? (
                      <GiftCardTile
                        className={styles.giftCardTile}
                        src={product.image}
                        alt={product.imageAlt ?? product.name}
                      />
                    ) : product.image ? (
                      <Image
                        src={product.image}
                        alt={product.imageAlt ?? product.name}
                        fill
                        className={styles.cardImage}
                      />
                    ) : null}
                  </Link>
                  <QuickAddButton product={product} className={styles.quickAdd} />
                </div>
                <Link href={`/shop/${product.slug}`} className={styles.cardContentLink}>
                  <h3>{product.name}</h3>
                  <p>{product.price}</p>
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
