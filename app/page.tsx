import Image from "next/image";
import Link from "next/link";
import QuickAddButton from "@/components/quick-add-button";
import SiteHeader from "@/components/site-header";
import HomepagePromoStrip from "@/components/homepage-promo-strip";
import { getAllProducts } from "@/lib/products";
import {
  getHomepageSectionSettings,
} from "@/lib/store-settings";
import styles from "./page.module.css";

const flavourToneMap: Record<string, string> = {
  "matcha-white-chocolate": "matchaTone",
  "red-velvet": "redTone",
  "dark-choc-maldon-salt": "chocolateTone",
  "double-chocolate-hazelnut": "hazelnutTone",
};

const flavourNoteMap: Record<string, string> = {
  "matcha-white-chocolate": "white chocolate",
  "red-velvet": "cocoa crumb",
  "dark-choc-maldon-salt": "maldon salt",
  "double-chocolate-hazelnut": "roasted hazelnut",
};

function getFlavourToneClass(slug: string) {
  return styles[flavourToneMap[slug] ?? "genericTone"];
}

function getFlavourNote(slug: string) {
  return flavourNoteMap[slug] ?? "house favourite";
}

export default async function Home() {
  const [products, homepageSettings] = await Promise.all([
    getAllProducts(),
    getHomepageSectionSettings(),
  ]);
  const shoppableProducts = products.filter((product) => !product.isGiftCard);
  const featuredProducts = shoppableProducts.filter((product) => product.featured);
  const homepageProducts =
    featuredProducts.length >= 3 ? featuredProducts.slice(0, 3) : shoppableProducts.slice(0, 3);

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
              <Link href="/shop" className={`${styles.primaryCta} ${styles.heroCta}`}>
                Shop Now 
              </Link>
            </div>
          </div>

          <div className={styles.heroImageWrap}>
            <Image
              src="/Hands_Milk_Shot/_DSC6461.jpg"
              alt="Stacked artisan cookies held in hand"
              fill
              priority
              sizes="(max-width: 820px) 100vw, 50vw"
              className={styles.heroImage}
            />
          </div>
        </section>

        <section id="flavours" className={styles.featured}>
          <div className={styles.featuredHeader}>
            <h2 className={styles.featuredTitle}>Featured Products</h2>
          </div>
          <div className={styles.flavourGrid}>
            {homepageProducts.map((product) => (
              <article
                key={product.slug}
                className={`${styles.flavourCard} ${getFlavourToneClass(product.slug)}`}
              >
                <div className={styles.flavourImageWrap}>
                  <Link
                    href={`/shop/${product.slug}`}
                    className={styles.flavourTileLink}
                    aria-label={`View featured product ${product.name}`}
                  >
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.imageAlt ?? product.name}
                        fill
                        sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 33vw"
                        className={styles.flavourImage}
                      />
                    ) : null}
                  </Link>
                  <QuickAddButton product={product} className={styles.featuredQuickAdd} />
                </div>

                <Link
                  href={`/shop/${product.slug}`}
                  className={`${styles.flavourCopy} ${styles.flavourTileLink}`}
                  aria-label={`View featured product ${product.name}`}
                >
                  <p className={styles.flavourLabel}>{getFlavourNote(product.slug)}</p>
                  <h2>{product.name}</h2>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <HomepagePromoStrip homepageSettings={homepageSettings} products={products} />
      </div>
    </main>
  );
}
