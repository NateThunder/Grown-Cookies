import Image from "next/image";
import Link from "next/link";
import { formatGiftCardAmount, MIN_GIFT_CARD_AMOUNT_CENTS } from "@/lib/gift-card-amounts";
import { getProductImageForVariant, PRODUCT_IMAGE_VARIANTS } from "@/lib/product-image-variants";
import type { ShopProduct } from "@/lib/products";
import styles from "./seo-product-showcase.module.css";

type SeoProductShowcaseProps = {
  products: ShopProduct[];
};

export default function SeoProductShowcase({ products }: SeoProductShowcaseProps) {
  return (
    <div className={styles.grid}>
      {products.map((product) => {
        const image = product.isGiftCard
          ? "/gift card frame no crumbs.png"
          : getProductImageForVariant(product, PRODUCT_IMAGE_VARIANTS.shopCard.key) ?? product.image;
        const price = product.isGiftCard
          ? `From ${formatGiftCardAmount(MIN_GIFT_CARD_AMOUNT_CENTS)}`
          : product.price;

        return (
          <article key={product.slug} className={styles.item}>
            <Link href={`/shop/${product.slug}`} className={styles.imageLink}>
              {image ? (
                <Image
                  src={image}
                  alt={product.imageAlt ?? `${product.name} cookies`}
                  fill
                  sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 25vw"
                  className={styles.image}
                />
              ) : null}
            </Link>
            <div className={styles.copy}>
              <h3>
                <Link href={`/shop/${product.slug}`}>{product.name}</Link>
              </h3>
              <p>{price}</p>
              <Link href={`/shop/${product.slug}`} className={styles.productLink}>
                View product
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
