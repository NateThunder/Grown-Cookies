"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BASKET_UPDATED_EVENT,
  clearBasket,
  getBasket,
  getBasketSubtotal,
  parsePrice,
  removeFromBasket,
  setBasketQuantity,
  type BasketItem,
} from "@/lib/basket-storage";
import styles from "@/components/cart-client.module.css";

type CartClientProps = {
  className?: string;
  layout?: "page" | "drawer";
  showTitle?: boolean;
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export default function CartClient({
  className = "",
  layout = "page",
  showTitle = true,
}: CartClientProps) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const subtotal = useMemo(() => getBasketSubtotal(items), [items]);
  const cartClassName = [
    styles.cart,
    layout === "drawer" ? styles.drawerCart : styles.pageCart,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const refresh = () => setItems(getBasket());
    const handleUpdate = () => refresh();

    refresh();
    window.addEventListener("storage", handleUpdate);
    window.addEventListener(BASKET_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener(BASKET_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  const handleQuantityChange = (slug: string, nextQuantity: number) => {
    setBasketQuantity(slug, nextQuantity);
    setItems(getBasket());
  };

  const handleRemove = (slug: string) => {
    removeFromBasket(slug);
    setItems(getBasket());
  };

  return (
    <section className={cartClassName}>
      {showTitle ? <h1>Your basket</h1> : null}

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Your basket is empty.</p>
          <Link href="/shop" className={styles.shopLink}>
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <ul className={styles.itemList}>
            {items.map((item) => (
              <li key={item.slug} className={styles.item}>
                <div className={styles.itemImageWrap}>
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.imageAlt ?? item.name}
                      fill
                      className={styles.itemImage}
                    />
                  ) : (
                    <span className={styles.itemImagePlaceholder}>No image</span>
                  )}
                </div>

                <div className={styles.itemBody}>
                  <div className={styles.itemCopy}>
                    <h2>{item.name}</h2>
                    <p className={styles.itemPrice}>{formatCurrency(parsePrice(item.price))}</p>
                  </div>

                  <div className={styles.itemActions}>
                    <div className={styles.controlGroup}>
                      <button
                        type="button"
                        className={`${styles.controlButton} ${styles.quantityButton}`.trim()}
                        aria-label={`Decrease ${item.name}`}
                        disabled={item.quantity <= 1}
                        onClick={() => handleQuantityChange(item.slug, item.quantity - 1)}
                      >
                        -
                      </button>

                      <span className={styles.controlValue}>{item.quantity}</span>

                      <button
                        type="button"
                        className={`${styles.controlButton} ${styles.quantityButton}`.trim()}
                        aria-label={`Increase ${item.name}`}
                        onClick={() => handleQuantityChange(item.slug, item.quantity + 1)}
                      >
                        +
                      </button>

                      <button
                        type="button"
                        className={`${styles.controlButton} ${styles.removeButton}`.trim()}
                        aria-label={`Remove ${item.name}`}
                        onClick={() => handleRemove(item.slug)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <section className={styles.summary}>
            <div className={styles.summaryFooter}>
              <p className={styles.summaryFooterRow}>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </p>

              <Link href="/checkout" className={styles.checkoutButton}>
                Continue to Checkout
              </Link>

              <button type="button" onClick={clearBasket} className={styles.clearAllButton}>
                Clear Basket
              </button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
