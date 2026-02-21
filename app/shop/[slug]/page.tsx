import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchModalTrigger from "@/components/search-modal-trigger";
import { FiShoppingBag, FiUser } from "react-icons/fi";
import { getRelatedProducts, getShopProduct, SHOP_PRODUCTS } from "../products";
import styles from "./page.module.css";

export function generateStaticParams() {
  return SHOP_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getShopProduct(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = getRelatedProducts(product.slug);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.leftNav} aria-label="Primary navigation">
          <Link href="/">HOME</Link>
          <Link href="/shop" className={styles.active}>
            SHOP
          </Link>
          <Link href="/contact">CONTACT US</Link>
          <Link href="/faqs">FAQ&apos;s</Link>
        </nav>

        <Link href="/" className={styles.logo} aria-label="Grown Cookies home">
          <span className={styles.logoMain}>
            grown
            <br />
            cookies
          </span>
          <span className={styles.logoTagline}>flavour refined</span>
        </Link>

        <div className={styles.iconNav} aria-label="Actions">
          <SearchModalTrigger />
          <Link href="/account" aria-label="Account">
            <FiUser />
          </Link>
          <Link href="/cart" aria-label="Cart">
            <FiShoppingBag />
          </Link>
        </div>
      </header>

      <div className={styles.announcement}>Shop our latest arrivals</div>

      <section className={styles.productSection}>
        <div className={styles.imageColumn}>
          {product.isGiftCard ? (
            <div className={styles.giftHero}>
              <span className={styles.giftHeroBrand}>grown cookies</span>
              <span className={styles.giftHeroText}>GIFT CARD</span>
            </div>
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
            <Link key={item.slug} href={`/shop/${item.slug}`} className={styles.relatedCard}>
              <div className={styles.relatedImageWrap}>
                {item.isGiftCard ? (
                  <div className={styles.relatedGiftCardTile}>
                    <span className={styles.relatedGiftBrand}>grown cookies</span>
                    <span className={styles.relatedGiftText}>GIFT CARD</span>
                  </div>
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
