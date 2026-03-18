"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import type { ShopProduct } from "@/lib/products";
import GiftCardTile from "./gift-card-tile";
import QuickAddButton from "./quick-add-button";
import styles from "./search-modal-trigger.module.css";

type SearchModalTriggerProps = {
  products: ShopProduct[];
};

const SEARCH_GIFT_CARD_NAME = "Grown Cookies Gift Card";

function getSearchProductName(product: ShopProduct) {
  return product.isGiftCard ? SEARCH_GIFT_CARD_NAME : product.name;
}

export default function SearchModalTrigger({ products: allProducts }: SearchModalTriggerProps) {
  const defaultRecentlyViewed = useMemo(
    () => allProducts.filter((product) => !product.isGiftCard).slice(0, 3),
    [allProducts],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentlyViewed, setRecentlyViewed] = useState<ShopProduct[]>(defaultRecentlyViewed);

  useEffect(() => {
    setRecentlyViewed(defaultRecentlyViewed);
  }, [defaultRecentlyViewed]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const products = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return allProducts;
    }

    return allProducts.filter((product) =>
      getSearchProductName(product).toLowerCase().includes(normalized),
    );
  }, [allProducts, query]);

  const close = () => setIsOpen(false);

  const handleProductClick = (product: ShopProduct) => {
    setRecentlyViewed((current) => {
      const next = [product, ...current.filter((item) => item.slug !== product.slug)];
      return next.slice(0, 3);
    });
    close();
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Search"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <FiSearch />
      </button>

      {isOpen ? (
        <div className={styles.backdrop} onClick={close}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.searchBar}>
              <div className={styles.inputWrap}>
                <FiSearch className={styles.searchIcon} />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  placeholder="Search products"
                  onChange={(event) => setQuery(event.target.value)}
                  className={styles.input}
                />
              </div>
              <button
                type="button"
                aria-label="Close search"
                className={styles.closeButton}
                onClick={close}
              >
                <FiX />
              </button>
            </div>

            <div className={styles.results}>
              {recentlyViewed.length > 0 ? (
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h3>Recently viewed</h3>
                    <button
                      type="button"
                      className={styles.clearButton}
                      onClick={() => setRecentlyViewed([])}
                    >
                      Clear
                    </button>
                  </div>

                  <div className={`${styles.grid} ${styles.recentGrid}`}>
                    {recentlyViewed.map((product) => (
                      <ProductCard
                        key={`recent-${product.slug}`}
                        product={product}
                        onSelect={handleProductClick}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>Products</h3>
                  <p className={styles.resultCount}>
                    {products.length} {products.length === 1 ? "result" : "results"}
                  </p>
                </div>

                {products.length > 0 ? (
                  <div className={styles.grid}>
                    {products.map((product) => (
                      <ProductCard
                        key={product.slug}
                        product={product}
                        onSelect={handleProductClick}
                      />
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyState}>No products found.</p>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ProductCard({
  product,
  onSelect,
}: {
  product: ShopProduct;
  onSelect: (product: ShopProduct) => void;
}) {
  const productName = getSearchProductName(product);

  return (
    <article className={`${styles.card} ${product.isGiftCard ? styles.giftCardPositioned : ""}`}>
      <div className={styles.imageWrap}>
        <Link
          href={`/shop/${product.slug}`}
          className={`${styles.imageLink} ${product.isGiftCard ? styles.giftCardImageLink : ""}`}
          onClick={() => onSelect(product)}
          aria-label={productName}
        >
          {product.isGiftCard ? (
            <GiftCardTile
              className={styles.giftCardTile}
              src={product.image}
              alt={product.imageAlt ?? productName}
            />
          ) : product.image ? (
            <Image
              src={product.image}
              alt={product.imageAlt ?? productName}
              fill
              className={styles.image}
            />
          ) : null}
        </Link>
        <QuickAddButton product={product} className={styles.quickIcon} compact />
      </div>
      <Link
        href={`/shop/${product.slug}`}
        className={styles.contentLink}
        onClick={() => onSelect(product)}
      >
        <p className={styles.name}>{productName}</p>
        <p className={styles.price}>{product.price}</p>
      </Link>
    </article>
  );
}
