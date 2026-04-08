import Image from "next/image";
import Link from "next/link";
import GiftCardTile from "@/components/gift-card-tile";
import QuickAddButton from "@/components/quick-add-button";
import SiteHeader from "@/components/site-header";
import { getAllProducts } from "@/lib/products";
import {
  getHomepageSectionSettings,
} from "@/lib/store-settings";
import styles from "./page.module.css";

export default async function Home() {
  const [products, homepageSettings] = await Promise.all([
    getAllProducts(),
    getHomepageSectionSettings(),
  ]);
  const { cookieOfMonth: cookieOfMonthSetting, shopIntro: shopIntroSetting, brandStory: brandStorySetting } =
    homepageSettings;
  const featuredProducts = products.filter((product) => product.featured);
  const homepageProducts =
    featuredProducts.length >= 3 ? featuredProducts.slice(0, 3) : products.slice(0, 3);
  const cookieOfMonthProductSlug = cookieOfMonthSetting.productSlug;
  const cookieOfMonthProduct = products.find(
    (product) => product.slug === cookieOfMonthProductSlug,
  );
  const cookieOfMonthHref = cookieOfMonthProduct ? `/shop/${cookieOfMonthProduct.slug}` : "/shop";
  const cookieOfMonthTitle = cookieOfMonthSetting.title;
  const cookieOfMonthCtaLabel = cookieOfMonthSetting.ctaLabel;
  const shopIntroEyebrow = shopIntroSetting.eyebrow;
  const shopIntroTitle = shopIntroSetting.title;
  const shopIntroBody = shopIntroSetting.body;
  const shopIntroCtaLabel = shopIntroSetting.ctaLabel;
  const brandStoryBody = brandStorySetting.body;

  return (
    <main className={`${styles.page} ${styles.pageWidthWide}`}>
      <SiteHeader activeRoute="home" products={products} />

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
          {homepageProducts.map((product) => (
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
          <h2 className={styles.monthTitle}>{cookieOfMonthTitle}</h2>
          <Link href={cookieOfMonthHref} className={styles.monthButton}>
            {cookieOfMonthCtaLabel}
          </Link>
        </div>
      </section>

      <section className={styles.shopIntro}>
        <div className={styles.shopIntroInner}>
          <p className={styles.shopIntroEyebrow}>{shopIntroEyebrow}</p>
          <h2 className={styles.shopIntroTitle}>{shopIntroTitle}</h2>
          <p className={styles.shopIntroBody}>{shopIntroBody}</p>
          <Link href="/shop" className={styles.shopIntroLink}>
            {shopIntroCtaLabel}
          </Link>
        </div>
      </section>

      <section className={styles.brandStory}>
        <Image
          src="/Box_Shots/_DSC6373.jpg"
          alt="Grown Cookies product box"
          fill
          className={styles.brandStoryImage}
        />
        <div className={styles.brandStoryOverlay} />
        <div className={styles.brandStoryContent}>
          <p>{brandStoryBody}</p>
        </div>
      </section>
    </main>
  );
}
