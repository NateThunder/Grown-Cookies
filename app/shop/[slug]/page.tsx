import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GiftCardTile from "@/components/gift-card-tile";
import ProductBasketControls from "@/components/product-basket-controls";
import QuickAddButton from "@/components/quick-add-button";
import { MIN_GIFT_CARD_AMOUNT_CENTS, formatGiftCardAmount } from "@/lib/gift-card-amounts";
import { getAllProducts } from "@/lib/products";
import { getProductImageForVariant, PRODUCT_IMAGE_VARIANTS } from "@/lib/product-image-variants";
import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

const GIFT_CARD_FRAME_IMAGE = "/gift card frame no crumbs.png";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

function getMetadataDescription(description: string) {
  if (description.length <= 155) {
    return description;
  }

  return `${description.slice(0, 152).trimEnd()}...`;
}

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const products = await getAllProducts();
  const product = products.find((item) => item.slug === slug);

  if (!product) {
    return {
      title: "Product not found",
    };
  }

  const productImage = getProductImageForVariant(
    product,
    PRODUCT_IMAGE_VARIANTS.productDetail.key,
  ) ?? product.image;
  const description = getMetadataDescription(product.description);

  return {
    title: product.name,
    description,
    alternates: {
      canonical: `/shop/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} | Grown Cookies`,
      description,
      url: `/shop/${product.slug}`,
      type: "website",
      images: productImage
        ? [
            {
              url: productImage,
              alt: product.imageAlt ?? product.name,
            },
          ]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
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
  const productDetailImage = getProductImageForVariant(
    product,
    PRODUCT_IMAGE_VARIANTS.productDetail.key,
  );
  const productPrice = product.isGiftCard
    ? `From ${formatGiftCardAmount(MIN_GIFT_CARD_AMOUNT_CENTS)}`
    : product.price;

  for (const item of fallbackProducts) {
    if (!relatedProducts.some((existing) => existing.slug === item.slug)) {
      relatedProducts.push(item);
    }
  }


  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="shop" products={products} variant="hero" />

      <section className={styles.productSection}>
        <div className={styles.imageColumn}>
          {product.isGiftCard ? (
            <GiftCardTile
              className={styles.giftHero}
              src={product.image}
              alt={product.imageAlt ?? product.name}
            />
          ) : productDetailImage ? (
            <div className={styles.heroImageWrap}>
              <Image
                src={productDetailImage}
                alt={product.imageAlt ?? product.name}
                fill
                priority
                className={styles.heroImage}
              />
            </div>
          ) : null}
        </div>

        <div className={`${styles.infoColumn} whiteFrame`}>
          <h1>{product.name}</h1>
          <p className={styles.price}>{productPrice}</p>

          <hr className={styles.divider} />

          {product.isGiftCard ? null : (
            <p className={styles.optionInline}>
              <span className={styles.optionLabel}>Box Size:</span>
              <strong>6 cookies</strong>
            </p>
          )}

          <ProductBasketControls
            product={{
              slug: product.slug,
              name: product.name,
              isGiftCard: product.isGiftCard,
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
          {relatedProducts.map((item) => {
            const relatedImage = getProductImageForVariant(item, PRODUCT_IMAGE_VARIANTS.shopCard.key);
            const relatedPrice = item.isGiftCard
              ? `From ${formatGiftCardAmount(MIN_GIFT_CARD_AMOUNT_CENTS)}`
              : item.price;

            return (
              <article
                key={item.slug}
                className={`${styles.relatedCard} whiteFrame ${
                  item.isGiftCard ? styles.giftCardPositioned : ""
                }`}
              >
                <div className={styles.relatedImageWrap}>
                  <Link href={`/shop/${item.slug}`} className={styles.relatedMediaLink}>
                    {item.isGiftCard ? (
                      <Image
                        src={GIFT_CARD_FRAME_IMAGE}
                        alt={item.imageAlt ?? item.name}
                        fill
                        sizes="(max-width: 520px) 100vw, (max-width: 980px) 50vw, 25vw"
                        className={styles.relatedImage}
                      />
                    ) : relatedImage ? (
                      <Image
                        src={relatedImage}
                        alt={item.imageAlt ?? item.name}
                        fill
                        sizes="(max-width: 520px) 100vw, (max-width: 980px) 50vw, 25vw"
                        className={styles.relatedImage}
                      />
                    ) : null}
                  </Link>
                  <QuickAddButton product={item} className={styles.relatedQuickAdd} />
                </div>
                <Link href={`/shop/${item.slug}`} className={styles.relatedContentLink}>
                  <h3>{item.name}</h3>
                  <p>{relatedPrice}</p>
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
