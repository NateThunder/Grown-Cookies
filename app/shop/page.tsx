import Image from "next/image";
import Link from "next/link";
import { FiChevronDown, FiGrid, FiLayout } from "react-icons/fi";
import styles from "./page.module.css";
import { getAllProducts } from "@/lib/products";
import GiftCardTile from "@/components/gift-card-tile";
import SiteHeader from "@/components/site-header";

export default async function ShopPage() {
  const products = await getAllProducts();

  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="shop" products={products} />

      <section className={styles.shop}>
        <h1>Shop</h1>

        <div className={styles.toolsRow}>
          <div className={styles.filters}>
            <button type="button">
              Availability <FiChevronDown />
            </button>
            <button type="button">
              Price <FiChevronDown />
            </button>
          </div>

          <div className={styles.sorting}>
            <span>{products.length} items</span>
            <button type="button">
              Sort <FiChevronDown />
            </button>
            <button type="button" aria-label="Grid view" className={styles.viewOn}>
              <FiGrid />
            </button>
            <button type="button" aria-label="List view" className={styles.viewOff}>
              <FiLayout />
            </button>
          </div>
        </div>

        <div className={styles.grid}>
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/shop/${product.slug}`}
              className={`${styles.card} ${
                product.isGiftCard ? styles.giftCardPositioned : ""
              }`}
              aria-label={`View ${product.name}`}
            >
              {product.isGiftCard ? (
                <GiftCardTile
                  className={styles.giftCardTile}
                  src={product.image}
                  alt={product.imageAlt ?? product.name}
                />
              ) : product.image ? (
                <div className={styles.imageWrap}>
                  <Image
                    src={product.image}
                    alt={product.imageAlt ?? product.name}
                    fill
                    className={styles.image}
                  />
                </div>
              ) : null}
              <h3>{product.name}</h3>
              <p>{product.price}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
