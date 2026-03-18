"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  BASKET_UPDATED_EVENT,
  clearBasket,
  formatPrice,
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
  showTitle?: boolean;
};

export default function CartClient({ className = "", showTitle = true }: CartClientProps) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const subtotal = useMemo(() => getBasketSubtotal(items), [items]);

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
    <section className={`${styles.cart} ${className}`.trim()}>
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
                  <h2>{item.name}</h2>
                  <p className={styles.itemPrice}>{item.price}</p>
                  <p className={styles.itemSubtotal}>
                    Item subtotal: {formatPrice(item.quantity * parsePrice(item.price))}
                  </p>
                </div>

                <div className={styles.itemActions}>
                  <div className={styles.qtyColumn}>
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name}`}
                      onClick={() => handleQuantityChange(item.slug, item.quantity - 1)}
                    >
                      <FiMinus />
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      type="button"
                      aria-label={`Increase ${item.name}`}
                      onClick={() => handleQuantityChange(item.slug, item.quantity + 1)}
                    >
                      <FiPlus />
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={`Remove ${item.name}`}
                    onClick={() => handleRemove(item.slug)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <section className={styles.summary}>
            <div>
              <p>
                Subtotal
                <span>{formatPrice(subtotal)}</span>
              </p>
              <button type="button" onClick={clearBasket} className={styles.clearAllButton}>
                Clear basket
              </button>
            </div>
            <Link href="/checkout" className={styles.checkoutButton}>
              Continue to checkout
            </Link>
          </section>
        </>
      )}
    </section>
  );
}
