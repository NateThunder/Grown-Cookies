import Image from "next/image";
import Link from "next/link";
import GiftCardTile from "@/components/gift-card-tile";
import QuickAddButton from "@/components/quick-add-button";
import SiteHeader from "@/components/site-header";
import { getAllProducts } from "@/lib/products";
import {
  DEFAULT_BRAND_STORY_BODY,
  DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
  DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
  DEFAULT_COOKIE_OF_MONTH_TITLE,
  DEFAULT_SHOP_INTRO_BODY,
  DEFAULT_SHOP_INTRO_CTA_LABEL,
  DEFAULT_SHOP_INTRO_EYEBROW,
  DEFAULT_SHOP_INTRO_TITLE,
  getBrandStorySectionSetting,
  getCookieOfMonthSectionSetting,
  getShopIntroSectionSetting,
} from "@/lib/store-settings";
import styles from "./page.module.css";

export default async function Home() {
  const products = await getAllProducts();
  const cookieOfMonthSetting = await getCookieOfMonthSectionSetting();
  const shopIntroSetting = await getShopIntroSectionSetting();
  const brandStorySetting = await getBrandStorySectionSetting();
  const featuredProducts = products.filter((product) => product.featured);
  const homepageProducts =
    featuredProducts.length >= 3 ? featuredProducts.slice(0, 3) : products.slice(0, 3);
  const cookieOfMonthProductSlug =
    cookieOfMonthSetting.productSlug || DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG;
  const cookieOfMonthProduct = products.find(
    (product) => product.slug === cookieOfMonthProductSlug,
  );
  const cookieOfMonthHref = cookieOfMonthProduct ? `/shop/${cookieOfMonthProduct.slug}` : "/shop";
  const cookieOfMonthTitle = cookieOfMonthSetting.title || DEFAULT_COOKIE_OF_MONTH_TITLE;
  const cookieOfMonthCtaLabel = cookieOfMonthSetting.ctaLabel || DEFAULT_COOKIE_OF_MONTH_CTA_LABEL;
  const shopIntroEyebrow = shopIntroSetting.eyebrow || DEFAULT_SHOP_INTRO_EYEBROW;
  const shopIntroTitle = shopIntroSetting.title || DEFAULT_SHOP_INTRO_TITLE;
  const shopIntroBody = shopIntroSetting.body || DEFAULT_SHOP_INTRO_BODY;
  const shopIntroCtaLabel = shopIntroSetting.ctaLabel || DEFAULT_SHOP_INTRO_CTA_LABEL;
  const brandStoryBody = brandStorySetting.body || DEFAULT_BRAND_STORY_BODY;

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
          src="/Box_Shots/_DSC6378.jpg"
          alt="Grown Cookies box background"
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
