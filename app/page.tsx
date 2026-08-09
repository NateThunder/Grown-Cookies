import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import HomepagePromoStrip from "@/components/homepage-promo-strip";
import QuickAddButton from "@/components/quick-add-button";
import ShopNowLink from "@/components/shop-now-link";
import { getAllProducts } from "@/lib/products";
import {
  getHomepageSectionSettings,
} from "@/lib/store-settings";
import { getProductImageForVariant, PRODUCT_IMAGE_VARIANTS } from "@/lib/product-image-variants";
import styles from "./page.module.css";

const GIFT_CARD_FRAME_IMAGE = "/gift card frame no crumbs.png";

export const metadata: Metadata = {
  title: { absolute: "Artisan Cookies Delivered Across the UK | Grown Cookies" },
  description:
    "Order thick artisan cookies made fresh in Glasgow for tracked delivery across the UK or pre-ordered Glasgow collection.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Artisan Cookies Delivered Across the UK | Grown Cookies",
    description: "Made-to-order artisan cookie boxes for UK delivery or Glasgow collection.",
    url: "/",
    type: "website",
  },
};

const flavourToneMap: Record<string, string> = {
  "matcha-white-chocolate": "matchaTone",
  "red-velvet": "redTone",
  "dark-choc-maldon-salt": "chocolateTone",
  "double-chocolate-hazelnut": "hazelnutTone",
};

function getFlavourToneClass(slug: string) {
  return styles[flavourToneMap[slug] ?? "genericTone"];
}

export default async function Home() {
  const [products, homepageSettings] = await Promise.all([
    getAllProducts(),
    getHomepageSectionSettings(),
  ]);
  const featuredProducts = products.filter((product) => product.featured);
  const homepageProducts =
    featuredProducts.length >= 3 ? featuredProducts.slice(0, 3) : products.slice(0, 3);

  return (
    <main className={`${styles.page} ${styles.pageWidthWide}`}>
      <div className={styles.posterShell}>
        <SiteHeader activeRoute="home" products={products} variant="hero" />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              <span>
                Artisan <span className={styles.heroAccent}>Cookies</span> Delivered Across the UK
                <span className={styles.heroAccent}>!</span>
              </span>
            </h1>
            <p className={styles.heroBody}>
              Cookies for grown folks. <span className={styles.heroBodyLocation}>Handmade in Glasgow.</span>
            </p>
            <div className={styles.heroActions}>
              <ShopNowLink className={`${styles.primaryCta} ${styles.heroCta}`}>
                Shop Now
              </ShopNowLink>
            </div>
          </div>

          <div className={styles.heroImageWrap}>
            <Image
              src="/Hands_Milk_Shot/_DSC6461.jpg"
              alt="Stacked artisan cookies held in hand"
              fill
              priority
              sizes="(max-width: 820px) 44vw, 50vw"
              className={styles.heroImage}
            />
          </div>
        </section>

        <section id="flavours" className={styles.featured}>
          <div className={styles.featuredHeader}>
            <h2 className={`${styles.featuredTitle} ${styles.grainTitle}`} data-text="Featured Products">
              Featured Products
            </h2>
          </div>
          <div className={styles.flavourGrid}>
            {homepageProducts.map((product) => {
              const homepageImage = getProductImageForVariant(
                product,
                PRODUCT_IMAGE_VARIANTS.homepagePolaroid.key,
              );
              const displayImage = product.isGiftCard ? GIFT_CARD_FRAME_IMAGE : homepageImage;

              return (
                <article
                  key={product.slug}
                  className={`${styles.flavourCard} whiteFrame ${getFlavourToneClass(product.slug)}`}
                >
                  <div className={styles.flavourImageWrap}>
                    <Link
                      href={`/shop/${product.slug}`}
                      className={styles.flavourTileLink}
                      aria-label={`View featured product ${product.name}`}
                    >
                      {displayImage ? (
                        <Image
                          src={displayImage}
                          alt={product.imageAlt ?? product.name}
                          fill
                          sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 33vw"
                          className={styles.flavourImage}
                        />
                      ) : null}
                    </Link>
                    <QuickAddButton
                      product={product}
                      className={styles.featuredQuickAdd}
                    />
                  </div>

                  <Link
                    href={`/shop/${product.slug}`}
                    className={`${styles.flavourCopy} ${styles.flavourTileLink}`}
                    aria-label={`View featured product ${product.name}`}
                  >
                    <h2 className={styles.grainTitle} data-text={product.name}>
                      {product.name}
                    </h2>
                  </Link>
                  <div className={styles.flavourFooter}>
                    <Link href={`/shop/${product.slug}`} className={styles.featuredShopNow}>
                      Shop Now
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <HomepagePromoStrip homepageSettings={homepageSettings} products={products} />

        <section className={styles.seoIntro} aria-labelledby="fresh-cookie-delivery-title">
          <div className={styles.seoIntroHeader}>
            <p>Fresh cookie boxes</p>
            <h2 id="fresh-cookie-delivery-title">Made in Glasgow, delivered across the UK</h2>
          </div>
          <div className={styles.seoIntroGrid}>
            <article>
              <h3>Six thick, made-to-order cookies</h3>
              <p>Light crunch, full bite.</p>
              <Link href="/shop">Shop cookie boxes</Link>
            </article>
            <article>
              <h3>Royal Mail Tracked 24 delivery</h3>
              <p>Available throughout the UK.</p>
              <Link href="/delivery">Delivery details</Link>
            </article>
            <article>
              <h3>Pre-ordered Glasgow collection</h3>
              <p>Collect from Akara Bakery, Duke Street.</p>
              <Link href="/cookies-glasgow">Collection details</Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
