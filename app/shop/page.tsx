import Image from "next/image";
import Link from "next/link";
import SearchModalTrigger from "@/components/search-modal-trigger";
import {
  FiChevronDown,
  FiGrid,
  FiLayout,
  FiShoppingBag,
  FiUser,
} from "react-icons/fi";
import styles from "./page.module.css";
import { SHOP_PRODUCTS } from "./products";

export default function ShopPage() {
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
            <span>{SHOP_PRODUCTS.length} items</span>
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
          {SHOP_PRODUCTS.map((product) => (
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
                <div className={styles.imageWrap}>
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className={styles.image}
                  />
                </div>
              )}
              <h3>{product.name}</h3>
              <p>{product.price}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
