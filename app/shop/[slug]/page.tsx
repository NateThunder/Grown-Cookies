import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GiftCardTile from "@/components/gift-card-tile";
import ProductBasketControls from "@/components/product-basket-controls";
import { getAllProducts } from "@/lib/products";
import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await getAllProducts();
  const product = products.find((item) => item.slug === slug);

  if (!product) {
    notFound();
  }

  const productMap = new Map(products.map((item) => [item.slug, item]));
  const curatedProducts = (product.relatedSlugs ?? [])
    .map((itemSlug) => productMap.get(itemSlug))
    .filter((item): item is (typeof products)[number] => Boolean(item));
  const fallbackProducts = products.filter(
    (item) => !item.isGiftCard && item.slug !== product.slug,
  );
  const relatedProducts = [...curatedProducts];

  for (const item of fallbackProducts) {
    if (!relatedProducts.some((existing) => existing.slug === item.slug)) {
      relatedProducts.push(item);
    }
  }


  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="shop" products={products} variant="hero" showAnnouncement={false} />

      <section className={styles.productSection}>
        <div className={styles.imageColumn}>
          {product.isGiftCard ? (
            <GiftCardTile
              className={styles.giftHero}
              src={product.image}
              alt={product.imageAlt ?? product.name}
            />
          ) : product.image ? (
            <div className={styles.heroImageWrap}>
              <Image
                src={product.image}
                alt={product.imageAlt ?? product.name}
                fill
                priority
                className={styles.heroImage}
              />
            </div>
          ) : null}
        </div>

        <div className={styles.infoColumn}>
          <h1>{product.name}</h1>
          <p className={styles.price}>{product.price}</p>

          <hr className={styles.divider} />

          <p className={styles.optionLabel}>Box Size</p>
          <button type="button" className={styles.optionButton}>
            6 Cookies
          </button>

          <ProductBasketControls
            product={{
              slug: product.slug,
              name: product.name,
            }}
          />

          <div className={styles.descriptionBlock}>
            <p className={styles.description}>{product.description}</p>
            {product.allergens ? (
              <p className={styles.allergens}>Allergens: {product.allergens}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.relatedSection}>
        <h2>You may also like</h2>

        <div className={styles.relatedGrid}>
          {relatedProducts.map((item) => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}`}
              className={`${styles.relatedCard} ${
                item.isGiftCard ? styles.giftCardPositioned : ""
              }`}
            >
              <div className={styles.relatedImageWrap}>
                {item.isGiftCard ? (
                  <GiftCardTile
                    className={styles.relatedGiftCardTile}
                    src={item.image}
                    alt={item.imageAlt ?? item.name}
                  />
                ) : item.image ? (
                  <Image
                    src={item.image}
                    alt={item.imageAlt ?? item.name}
                    fill
                    className={styles.relatedImage}
                  />
                ) : null}
              </div>
              <h3>{item.name}</h3>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
