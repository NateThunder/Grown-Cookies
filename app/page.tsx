import Image from "next/image";
import Link from "next/link";
import SearchModalTrigger from "@/components/search-modal-trigger";
import { FiPlus, FiShoppingBag, FiUser } from "react-icons/fi";
import { SHOP_PRODUCTS } from "./shop/products";
import styles from "./page.module.css";

const featuredProducts = SHOP_PRODUCTS.slice(0, 3);

export default function Home() {
  return (
    <main className={`${styles.page} ${styles.pageWidthWide}`}>
      <header className={styles.header}>
        <nav className={styles.leftNav} aria-label="Primary navigation">
          <Link href="/">HOME</Link>
          <Link href="/shop">SHOP</Link>
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

      <section className={styles.hero}>
        <Image
          src="/images/cookie-stack.jpg"
          alt="Stacked artisan cookies"
          fill
          priority
          className={styles.heroImage}
        />
        <div className={styles.overlay} />
        <div className={styles.heroContent}>
          <h1>Order your cookies today!</h1>
          <p>Artisan cookies for, &apos;Grown folks!&apos;</p>
          <Link href="/shop" className={styles.cta}>
            Shop now
          </Link>
        </div>
      </section>

      <section className={styles.featured}>
        <h2>Featured products</h2>
        <div className={styles.grid}>
          {featuredProducts.map((product) => (
            <Link
              key={product.slug}
              href={`/shop/${product.slug}`}
              className={styles.card}
              aria-label={`View ${product.name}`}
            >
              {product.isGiftCard ? (
                <div className={styles.giftCardTile}>
                  <span className={styles.giftBrand}>grown cookies</span>
                  <span className={styles.giftText}>GIFT CARD</span>
                </div>
              ) : (
                <div className={styles.cardImageWrap}>
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className={styles.cardImage}
                  />
                  <span className={styles.quickAdd} aria-hidden="true">
                    <FiShoppingBag />
                    <FiPlus />
                  </span>
                </div>
              )}
              <h3>{product.name}</h3>
              <p>{product.price}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.monthSection}>
        <div className={styles.monthImagePanel}>
          <Image
            src="/Box_Shots/_DSC6382.jpg"
            alt="Cookie box with matcha cookies"
            fill
            className={styles.monthImage}
          />
        </div>

        <div className={styles.monthImagePanel}>
          <Image
            src="/Hands_Milk_Shot/_DSC6537.jpg"
            alt="Cookie dipped in milk"
            fill
            className={styles.monthImage}
          />
        </div>

        <div className={styles.monthTextPanel}>
          <h2 className={styles.monthTitle}>
            Our Cookie of the Month is a limited-edition artisan flavour
            inspired by the season, celebrating the ingredients at their best.
          </h2>
          <Link href="/shop" className={styles.monthButton}>
            Cookie of the Month
          </Link>
        </div>
      </section>

      <section className={styles.brandStory}>
        <Image
          src="/Box_Shots/_DSC6378.jpg"
          alt="Grown Cookies box background"
          fill
          className={styles.brandStoryImage}
        />
        <div className={styles.brandStoryOverlay} />
        <div className={styles.brandStoryContent}>
          <p>
            We don&apos;t just make your classic cookies, we reimagine them -
            staying faithful to creating great flavours while elevating every
            detail
          </p>
        </div>
      </section>
    </main>
  );
}
