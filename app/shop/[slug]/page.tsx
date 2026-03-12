import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiShoppingBag } from "react-icons/fi";
import GiftCardTile from "@/components/gift-card-tile";
import { getAllProducts, getRelatedProducts, getShopProduct } from "@/lib/products";
import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getShopProduct(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product.slug);

  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="shop" />

      <section className={styles.productSection}>
        <div className={styles.imageColumn}>
          {product.isGiftCard ? (
            <GiftCardTile className={styles.giftHero} />
          ) : (
            <div className={styles.heroImageWrap}>
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority
                className={styles.heroImage}
              />
            </div>
          )}
        </div>

        <div className={styles.infoColumn}>
          <h1>{product.name}</h1>
          <p className={styles.price}>{product.price}</p>

          <hr className={styles.divider} />

          <p className={styles.optionLabel}>Box Size</p>
          <button type="button" className={styles.optionButton}>
            6 Cookies
          </button>

          <div className={styles.purchaseRow}>
            <div className={styles.quantityControl} aria-label="Quantity selector">
              <button type="button" aria-label="Decrease quantity">
                -
              </button>
              <span>1</span>
              <button type="button" aria-label="Increase quantity">
                +
              </button>
            </div>

            <button type="button" className={styles.addToCart}>
              <FiShoppingBag />
              Add to cart
            </button>
          </div>

          <button type="button" className={styles.shopPay}>
            Buy with <strong>shop</strong>
          </button>

          <button type="button" className={styles.paymentOptions}>
            More payment options
          </button>

          <p className={styles.description}>{product.description}</p>
        </div>
      </section>

      <section className={styles.relatedSection}>
        <h2>You may also like</h2>

        <div className={styles.relatedGrid}>
          {relatedProducts.map((item) => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}`}
              className={`${styles.relatedCard} ${
                item.isGiftCard ? styles.giftCardPositioned : ""
              }`}
            >
              <div className={styles.relatedImageWrap}>
                {item.isGiftCard ? (
                  <GiftCardTile className={styles.relatedGiftCardTile} />
                ) : (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className={styles.relatedImage}
                  />
                )}
              </div>
              <h3>{item.name}</h3>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
