import Image from "next/image";
import Link from "next/link";
import type { ShopProduct } from "@/lib/products";
import type { HomepageSectionSettings } from "@/lib/store-settings";
import { getProductImageForVariant, PRODUCT_IMAGE_VARIANTS } from "@/lib/product-image-variants";
import ShopNowLink from "@/components/shop-now-link";
import styles from "./homepage-promo-strip.module.css";

const SHOP_BENEFITS = [
  "Handcrafted cookies for every occasion",
  "From classic favourites to limited-edition flavours",
  "Perfect for gifting, parties, and corporate events",
  "Baked fresh for maximum flavour",
  "A crowd-pleaser at any gathering",
];

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

      <div className={styles.promo}>
        <div className={styles.promo__card}>
          <article className={`${styles.block} ${styles.shopPanel}`}>
            <div className={styles.contentBox}>
              <div className={styles.copyStack}>
                <p className={styles.eyebrow}>{shopIntroSetting.eyebrow}</p>
                <div className={styles.benefitGrid} aria-label="Shop highlights">
                  {SHOP_BENEFITS.map((benefit) => (
                    <p key={benefit} className={styles.benefitItem}>
                      <span className={styles.benefitIcon} aria-hidden="true">
                        •
                      </span>
                      <span>{benefit}</span>
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
