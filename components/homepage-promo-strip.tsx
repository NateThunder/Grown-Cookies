import Image from "next/image";
import Link from "next/link";
import type { ShopProduct } from "@/lib/products";
import type { HomepageSectionSettings } from "@/lib/store-settings";
import styles from "./homepage-promo-strip.module.css";

type HomepagePromoStripProps = {
  homepageSettings: HomepageSectionSettings;
  products: ShopProduct[];
};

const benefitPoints = [
  {
    title: "Handmade in small batches",
    body: "Each box is baked in limited runs for a fresher, softer cookie with more character.",
  },
  {
    title: "Bold grown-up flavours",
    body: "From matcha to Maldon salt, every flavour leans richer and less expected than the usual cookie line-up.",
  },
  {
    title: "Event boxes & gifting",
    body: "Birthday tables, thank-you drops, and late-night gifting all land better with a box that looks the part.",
  },
];

function getCompactExcerpt(text: string, maxLength = 150) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastWordBoundary = truncated.lastIndexOf(" ");

  return `${truncated.slice(0, lastWordBoundary > 0 ? lastWordBoundary : maxLength).trimEnd()}...`;
}

export default function HomepagePromoStrip({ homepageSettings, products }: HomepagePromoStripProps) {
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
  const cookieOfMonthBody = getCompactExcerpt(cookieOfMonthSetting.title, 132);
  const whyIntro = getCompactExcerpt(
    [shopIntroSetting.title, shopIntroSetting.body].filter(Boolean).join(" "),
    168,
  );
  const buildYourBoxBody = getCompactExcerpt(brandStorySetting.body, 144);
  const cookieSpotlightImage = localCookieOfMonthProduct?.image ?? "/Box_Shots/_DSC6373.jpg";
  const cookieSpotlightAlt =
    localCookieOfMonthProduct?.imageAlt ?? `${cookieOfMonthHeading} cookie from Grown Cookies`;

  return (
    <section className={styles.section}>
      <div className={styles.stack}>
        <section className={styles.spotlight}>
          <div className={styles.spotlightMedia}>
            <Image
              src={cookieSpotlightImage}
              alt={cookieSpotlightAlt}
              fill
              sizes="(max-width: 820px) 100vw, 52vw"
              className={styles.spotlightImage}
            />
          </div>

          <div className={styles.spotlightCopy}>
            <p className={styles.eyebrow}>Cookie of the month</p>
            <h2>{cookieOfMonthHeading}</h2>
            <p className={styles.body}>{cookieOfMonthBody}</p>
            <Link href={cookieOfMonthHref} className={styles.primaryButton}>
              {cookieOfMonthSetting.ctaLabel}
            </Link>
          </div>
        </section>

        <section className={styles.why}>
          <div className={styles.whyIntro}>
            <p className={styles.eyebrow}>{shopIntroSetting.eyebrow}</p>
            <h2>Why Grown Cookies?</h2>
            <p className={styles.body}>{whyIntro}</p>
            <Link href="/shop" className={styles.secondaryButton}>
              {shopIntroSetting.ctaLabel}
            </Link>
          </div>

          <div className={styles.benefitGrid}>
            {benefitPoints.map((benefit, index) => (
              <article key={benefit.title} className={styles.benefit}>
                <p className={styles.benefitIndex}>{`0${index + 1}`}</p>
                <h3>{benefit.title}</h3>
                <p>{benefit.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.build}>
          <div className={styles.buildMedia}>
            <Image
              src="/Box_Shots/_DSC6378.jpg"
              alt="Grown Cookies box ready to gift"
              fill
              sizes="(max-width: 820px) 100vw, 48vw"
              className={styles.buildImage}
            />
          </div>

          <div className={styles.buildCopy}>
            <p className={styles.eyebrow}>Build your box</p>
            <h2>Choose a box that lands like a gift.</h2>
            <p className={styles.buildBody}>{buildYourBoxBody}</p>
            <Link href="/shop" className={styles.buildButton}>
              Build your box
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
