import Image from "next/image";
import Link from "next/link";
import type { ShopProduct } from "@/lib/products";
import type { HomepageSectionSettings } from "@/lib/store-settings";
import { getProductImageForVariant, PRODUCT_IMAGE_VARIANTS } from "@/lib/product-image-variants";
import ShopNowLink from "@/components/shop-now-link";
import styles from "./homepage-promo-strip.module.css";

type HomepagePromoStripProps = {
  homepageSettings: HomepageSectionSettings;
  products: ShopProduct[];
  showCaption?: boolean;
  showTopCta?: boolean;
};

function getCompactExcerpt(text: string, maxLength = 150) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastWordBoundary = truncated.lastIndexOf(" ");

  return `${truncated.slice(0, lastWordBoundary > 0 ? lastWordBoundary : maxLength).trimEnd()}...`;
}

export default function HomepagePromoStrip({
  homepageSettings,
  products,
  showCaption = false,
  showTopCta = false,
}: HomepagePromoStripProps) {
  const { cookieOfMonth: cookieOfMonthSetting, shopIntro: shopIntroSetting, brandStory: brandStorySetting } =
    homepageSettings;
  const cookieOfMonthProduct = products.find(
    (product) => product.slug === cookieOfMonthSetting.productSlug,
  );
  const localCookieOfMonthProduct =
    process.env.NODE_ENV !== "production"
      ? products.find((product) => product.slug === "double-chocolate-hazelnut") ?? cookieOfMonthProduct
      : cookieOfMonthProduct;
  const cookieOfMonthHref = localCookieOfMonthProduct ? `/shop/${localCookieOfMonthProduct.slug}` : "/shop";
  const cookieOfMonthHeading = localCookieOfMonthProduct?.name ?? "Cookie of the month";
  const cookieOfMonthHeadingClassName =
    localCookieOfMonthProduct?.slug === "dark-choc-maldon-salt" ? styles.singleLineHeading : undefined;
  const cookieOfMonthBody = getCompactExcerpt(cookieOfMonthSetting.title, 280);
  const cookieOfMonthImage =
    localCookieOfMonthProduct
      ? getProductImageForVariant(localCookieOfMonthProduct, PRODUCT_IMAGE_VARIANTS.cookieMonth.key)
      : undefined;
  const resolvedCookieOfMonthImage = cookieOfMonthImage ?? "/Double_Choc_Hazelnut/_DSC6200.jpg";
  const cookieOfMonthImageAlt =
    localCookieOfMonthProduct?.imageAlt ?? `${cookieOfMonthHeading} cookie stack`;
  const shopPromoParagraphs = [shopIntroSetting.title, shopIntroSetting.body].filter(
    (paragraph) => paragraph.trim().length > 0,
  );
  const brandStoryCaption = getCompactExcerpt(brandStorySetting.body, 156);

  return (
    <section className={styles.section} aria-labelledby="cookie-of-month-title">
      {showTopCta ? (
        <ShopNowLink className={styles.topCta}>
          View flavours
        </ShopNowLink>
      ) : null}

      <article className={styles.cookieMonth}>
        <div className={styles.mediaPanel}>
          <Image
            src={resolvedCookieOfMonthImage}
            alt={cookieOfMonthImageAlt}
            fill
            sizes="(max-width: 760px) 100vw, 38vw"
            className={styles.cookieImage}
          />
        </div>

        <div className={styles.copyPanel}>
          <p className={styles.monthEyebrow}>Cookie of the Month</p>
          <h2 id="cookie-of-month-title" className={cookieOfMonthHeadingClassName}>
            {cookieOfMonthHeading}
          </h2>
          <p className={styles.monthBody}>{cookieOfMonthBody}</p>
          <Link href={cookieOfMonthHref} className={styles.monthButton}>
            {cookieOfMonthSetting.ctaLabel}
          </Link>
        </div>
      </article>

      <div className={styles.boxImageWrap}>
        <Image
          src="/grown cookie box.png"
          alt="Open Grown Cookies box with assorted cookies"
          width={916}
          height={947}
          sizes="(max-width: 760px) 88vw, 42vw"
          className={styles.boxImage}
        />
      </div>

      <div className={styles.promo}>
        <Image
          src="/grown cookie box.png"
          alt="Open Grown Cookies box with assorted cookies"
          width={916}
          height={947}
          sizes="(max-width: 980px) 100vw, 28vw"
          className={styles.promo__image}
        />

        <div className={styles.promo__card}>
          <article className={`${styles.block} ${styles.shopPanel}`}>
            <div className={styles.contentBox}>
              <div className={styles.copyStack}>
                <p className={styles.eyebrow}>{shopIntroSetting.eyebrow}</p>
                <div className={styles.textGroup}>
                  {shopPromoParagraphs.map((paragraph) => (
                    <p key={paragraph} className={styles.body}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
              <ShopNowLink className={`${styles.button} ${styles.buttonSecondary}`}>
                {shopIntroSetting.ctaLabel}
              </ShopNowLink>
            </div>
          </article>
        </div>
      </div>

      {showCaption ? <p className={styles.caption}>{brandStoryCaption}</p> : null}
    </section>
  );
}
