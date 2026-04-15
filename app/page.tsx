import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import HomepagePromoStrip from "@/components/homepage-promo-strip";
import ShopNowLink from "@/components/shop-now-link";
import { getAllProducts } from "@/lib/products";
import {
  getHomepageSectionSettings,
} from "@/lib/store-settings";
import { getProductImageForVariant, PRODUCT_IMAGE_VARIANTS } from "@/lib/product-image-variants";
import styles from "./page.module.css";

const GIFT_CARD_FRAME_IMAGE = "/gift card frame.png";

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
        <SiteHeader activeRoute="home" products={products} variant="hero" showAnnouncement={false} />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              <span>
                Order <span className={styles.heroAccent}>your</span> cookies today
                <span className={styles.heroAccent}>!</span>
              </span>
            </h1>
            <p className={styles.heroBody}>Cookies for Grown folks</p>
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
      </div>
    </main>
  );
}
