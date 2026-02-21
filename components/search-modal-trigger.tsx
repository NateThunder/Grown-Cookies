"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiShoppingBag, FiX } from "react-icons/fi";
import styles from "./search-modal-trigger.module.css";

type SearchProduct =
  | {
      name: string;
      price: string;
      image: string;
      isGiftCard?: false;
    }
  | {
      name: string;
      price: string;
      isGiftCard: true;
    };

const allProducts: SearchProduct[] = [
  {
    name: "Dark Choc & Maldon Salt",
    price: "\u00A322.00",
    image: "/Dark_Choc-_Salt/_DSC6327.jpg",
  },
  {
    name: "Gift Card",
    price: "\u00A310.00",
    isGiftCard: true,
  },
  {
    name: "Red Velvet",
    price: "\u00A321.00",
    image: "/Red_Velvet/_DSC6161.jpg",
  },
  {
    name: "Double Chocolate & Hazelnut",
    price: "\u00A322.00",
    image: "/Double_Choc_Hazelnut/_DSC6200.jpg",
  },
  {
    name: "Crunchy Granola",
    price: "\u00A322.00",
    image: "/Crunchy_Granola/_DSC6127.jpg",
  },
  {
    name: "Matcha White Choc",
    price: "\u00A322.00",
    image: "/Matcha/_DSC6441.jpg",
  },
  {
    name: "Double Choc Box",
    price: "\u00A322.00",
    image: "/Box_Shots/_DSC6145.jpg",
  },
];

const defaultRecentlyViewed: SearchProduct[] = allProducts
  .filter((product) => !product.isGiftCard)
  .slice(0, 3);

export default function SearchModalTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentlyViewed, setRecentlyViewed] = useState<SearchProduct[]>(defaultRecentlyViewed);

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
      product.name.toLowerCase().includes(normalized),
    );
  }, [query]);

  const close = () => setIsOpen(false);

  const handleProductClick = (product: SearchProduct) => {
    setRecentlyViewed((current) => {
      const next = [product, ...current.filter((item) => item.name !== product.name)];
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
                        key={`recent-${product.name}`}
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
                        key={product.name}
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
  product: SearchProduct;
  onSelect: (product: SearchProduct) => void;
}) {
  return (
    <Link
      href="/shop"
      className={styles.card}
      onClick={() => onSelect(product)}
      aria-label={product.name}
    >
      {product.isGiftCard ? (
        <div className={styles.giftCardTile}>
          <span className={styles.giftBrand}>grown cookies</span>
          <span className={styles.giftText}>GIFT CARD</span>
        </div>
      ) : (
        <div className={styles.imageWrap}>
          <Image src={product.image} alt={product.name} fill className={styles.image} />
          <span className={styles.quickIcon} aria-hidden="true">
            <FiShoppingBag />
          </span>
        </div>
      )}
      <p className={styles.name}>{product.name}</p>
      <p className={styles.price}>{product.price}</p>
    </Link>
  );
}
