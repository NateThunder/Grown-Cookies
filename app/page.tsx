import Image from "next/image";
import Link from "next/link";
import QuickAddButton from "@/components/quick-add-button";
import SiteHeader from "@/components/site-header";
import HomepagePromoStrip from "@/components/homepage-promo-strip";
import { getAllProducts, type ShopProduct } from "@/lib/products";
import { getHomepageSectionSettings } from "@/lib/store-settings";
import styles from "./page.module.css";

const flavourToneMap: Record<string, string> = {
  "matcha-white-chocolate": "matchaTone",
  "red-velvet": "redTone",
  "dark-choc-maldon-salt": "chocolateTone",
  "double-chocolate-hazelnut": "hazelnutTone",
};

const flavourLabelMap: Record<string, string> = {
  "matcha-white-chocolate": "white chocolate",
  "red-velvet": "cocoa crumb",
  "dark-choc-maldon-salt": "maldon salt",
  "double-chocolate-hazelnut": "roasted hazelnut",
};

const flavourNoteMap: Record<string, string> = {
  "matcha-white-chocolate": "Earthy matcha with a creamy white chocolate finish.",
  "red-velvet": "Soft cocoa richness with a velvety, dessert-style bite.",
  "dark-choc-maldon-salt": "Rich dark chocolate lifted with a clean Maldon salt finish.",
  "double-chocolate-hazelnut": "Deep cocoa flavour with roasted hazelnut crunch in every bite.",
  "granola-raisin": "Toasted granola and juicy raisins with a warm oat chew.",
};

function getFlavourToneClass(slug: string) {
  return styles[flavourToneMap[slug] ?? "genericTone"];
}

function getCompactExcerpt(text: string, maxLength = 84) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastWordBoundary = truncated.lastIndexOf(" ");

  return `${truncated.slice(0, lastWordBoundary > 0 ? lastWordBoundary : maxLength).trimEnd()}...`;
}

function getFlavourLabel(slug: string) {
  return flavourLabelMap[slug] ?? "house favourite";
}

function getFlavourNote(product: ShopProduct) {
  return flavourNoteMap[product.slug] ?? getCompactExcerpt(product.description, 78);
}

function formatHomepagePrice(price: string) {
  const normalized = price.trim();
  const match = normalized.match(/(?:GBP|£)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);

  if (!match) {
    return normalized;
  }

  const numericPrice = Number.parseFloat(match[1]);

  if (!Number.isFinite(numericPrice)) {
    return normalized;
  }

  return `£${Number.isInteger(numericPrice) ? numericPrice.toFixed(0) : numericPrice.toFixed(2)}`;
}

function getHomepageProducts(products: ShopProduct[]) {
  const shoppableProducts = products.filter((product) => !product.isGiftCard);
  const photographedProducts = shoppableProducts.filter((product) => Boolean(product.image));
  const prioritizedProducts = [
    ...photographedProducts.filter((product) => product.featured),
    ...photographedProducts.filter((product) => !product.featured),
  ];
  const selectedProducts: ShopProduct[] = [];

  for (const product of prioritizedProducts) {
    if (!selectedProducts.some((selectedProduct) => selectedProduct.slug === product.slug)) {
      selectedProducts.push(product);
    }

    if (selectedProducts.length === 3) {
      return selectedProducts;
    }
  }

  for (const product of shoppableProducts) {
    if (!selectedProducts.some((selectedProduct) => selectedProduct.slug === product.slug)) {
      selectedProducts.push(product);
    }

    if (selectedProducts.length === 3) {
      break;
    }
  }

  return selectedProducts;
}

export default async function Home() {
  const [products, homepageSettings] = await Promise.all([
    getAllProducts(),
    getHomepageSectionSettings(),
  ]);
  const homepageProducts = getHomepageProducts(products);

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
            <p className={styles.featuredEyebrow}>Shop the favourites</p>
            <h2 className={styles.featuredTitle}>Featured Products</h2>
          </div>
          <div className={styles.flavourGrid}>
            {homepageProducts.map((product, index) => (
              <article
                key={product.slug}
                className={`${styles.flavourCard} ${index === 0 ? styles.flavourCardLead : ""} ${getFlavourToneClass(product.slug)}`.trim()}
              >
                <div className={styles.flavourImageWrap}>
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.imageAlt ?? product.name}
                      fill
                      sizes={
                        index === 0
                          ? "(max-width: 620px) 100vw, (max-width: 980px) 100vw, 52vw"
                          : "(max-width: 620px) 100vw, (max-width: 980px) 50vw, 26vw"
                      }
                      className={styles.flavourImage}
                    />
                  ) : null}
                </div>
                <div className={styles.flavourBody}>
                  <div className={styles.flavourMeta}>
                    <p className={styles.flavourLabel}>{getFlavourLabel(product.slug)}</p>
                    <h3 className={styles.flavourName}>{product.name}</h3>
                    <p className={styles.flavourNote}>{getFlavourNote(product)}</p>
                  </div>
                  <div className={styles.flavourFooter}>
                    <p className={styles.flavourPrice}>{formatHomepagePrice(product.price)}</p>
                    <div className={styles.flavourActions}>
                      <Link href={`/shop/${product.slug}`} className={`${styles.flavourCta} ${styles.flavourViewCta}`}>
                        View cookie
                      </Link>
                      <QuickAddButton product={product} className={`${styles.flavourCta} ${styles.featuredQuickAdd}`} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <HomepagePromoStrip homepageSettings={homepageSettings} products={products} />
      </div>
    </main>
  );
}
