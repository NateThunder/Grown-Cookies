import Image from "next/image";
import Link from "next/link";
import type { ShopProduct } from "@/lib/products";
import type { HomepageSectionSettings } from "@/lib/store-settings";
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
  const cookieOfMonthBody = getCompactExcerpt(cookieOfMonthSetting.title, 132);
  const shopPromoParagraphs = [shopIntroSetting.title, shopIntroSetting.body].filter(
    (paragraph) => paragraph.trim().length > 0,
  );
  const brandStoryCaption = getCompactExcerpt(brandStorySetting.body, 156);

  return (
    <section className={styles.section}>
      {showTopCta ? (
        <Link href="/shop" className={styles.topCta}>
          View flavours
        </Link>
      ) : null}

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
          <article className={`${styles.block} ${styles.promo__primary}`}>
            <p className={styles.eyebrow}>Cookie of the month</p>
            <h2 className={cookieOfMonthHeadingClassName}>{cookieOfMonthHeading}</h2>
            <p className={styles.body}>{cookieOfMonthBody}</p>
            <Link href={cookieOfMonthHref} className={`${styles.button} ${styles.buttonPrimary}`}>
              {cookieOfMonthSetting.ctaLabel}
            </Link>
          </article>

          <article className={`${styles.block} ${styles.secondaryPanel}`}>
            <p className={styles.eyebrow}>{shopIntroSetting.eyebrow}</p>
            <div className={styles.textGroup}>
              {shopPromoParagraphs.map((paragraph) => (
                <p key={paragraph} className={styles.body}>
                  {paragraph}
                </p>
              ))}
            </div>
            <Link href="/shop" className={`${styles.button} ${styles.buttonSecondary}`}>
              {shopIntroSetting.ctaLabel}
            </Link>
          </article>
        </div>
      </div>

      {showCaption ? <p className={styles.caption}>{brandStoryCaption}</p> : null}
    </section>
  );
}
