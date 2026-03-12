import Image from "next/image";
import Link from "next/link";
import { FiPlus, FiShoppingBag } from "react-icons/fi";
import GiftCardTile from "@/components/gift-card-tile";
import SiteHeader from "@/components/site-header";
import { getFeaturedProducts } from "@/lib/products";
import styles from "./page.module.css";

export default async function Home() {
  const featuredProducts = await getFeaturedProducts(3);

  return (
    <main className={`${styles.page} ${styles.pageWidthWide}`}>
      <SiteHeader activeRoute="home" />

      <section className={styles.hero}>
        <Image
          src="/Hands_Milk_Shot/_DSC6461.jpg"
          alt="Stacked artisan cookies held in hand"
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
              className={`${styles.card} ${
                product.isGiftCard ? styles.giftCardPositioned : ""
              }`}
              aria-label={`View ${product.name}`}
            >
              {product.isGiftCard ? (
                <GiftCardTile className={styles.giftCardTile} />
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

      <section className={styles.shopIntro}>
        <div className={styles.shopIntroInner}>
          <p className={styles.shopIntroEyebrow}>Our shop</p>
          <h2 className={styles.shopIntroTitle}>
            Grown Cookies are the ideal treat for any event, adding a touch of
            sweetness to every celebration. Whether you&apos;re planning a
            birthday party, a wedding, a corporate event, or just a casual
            get-together, our cookies are sure to impress your guests.
          </h2>
          <p className={styles.shopIntroBody}>
            Our cookies come in a variety of flavours, ensuring there&apos;s
            something for everyone. From classic favourites like chocolate
            cookies to unique creations like matcha white chocolate, our
            selection caters to diverse tastes and preferences. These
            delectable cookies are baked to perfection by our professional
            bakers, making them a highlight at any gathering.
          </p>
          <Link href="/shop" className={styles.shopIntroLink}>
            Learn more
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
