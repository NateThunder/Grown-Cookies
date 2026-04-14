"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BASKET_UPDATED_EVENT,
  clearBasket,
  getBasket,
  removeFromBasket,
  setBasketQuantity,
} from "@/lib/basket-storage";
import { formatPriceFromCents, type BasketQuote, type BasketStoredItem } from "@/lib/basket";
import GiftCardTile from "@/components/gift-card-tile";
import styles from "@/components/cart-client.module.css";

type CartClientProps = {
  className?: string;
  layout?: "page" | "drawer";
  showTitle?: boolean;
};

export default function CartClient({
  className = "",
  layout = "page",
  showTitle = true,
}: CartClientProps) {
  const [basketItems, setBasketItems] = useState<BasketStoredItem[]>([]);
  const [hasHydratedBasket, setHasHydratedBasket] = useState(false);
  const [quote, setQuote] = useState<BasketQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const cartClassName = [
    styles.cart,
    layout === "drawer" ? styles.drawerCart : styles.pageCart,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const refresh = () => setBasketItems(getBasket());
    const handleUpdate = () => refresh();

    refresh();
    setHasHydratedBasket(true);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener(BASKET_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener(BASKET_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (basketItems.length === 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    const abortController = new AbortController();

    const loadQuote = async () => {
      try {
        const response = await fetch("/api/basket/quote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: basketItems,
            tip: { mode: "none" },
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(error.error || "Could not load your basket.");
        }

        const nextQuote = (await response.json()) as BasketQuote;
        setQuote(nextQuote);
        setQuoteError("");
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setQuote(null);
        setQuoteError(error instanceof Error ? error.message : "Could not load your basket.");
      }
    };

    void loadQuote();

    return () => {
      abortController.abort();
    };
  }, [basketItems]);

  const handleQuantityChange = (slug: string, nextQuantity: number) => {
    setBasketQuantity(slug, nextQuantity);
    setBasketItems(getBasket());
  };

  const handleRemove = (slug: string) => {
    removeFromBasket(slug);
    setBasketItems(getBasket());
  };

  const lines = quote?.lines ?? [];
  const subtotalCents = quote?.subtotalCents ?? 0;
  const isQuotePending = hasHydratedBasket && basketItems.length > 0 && !quote && !quoteError;
  const subtotalLabel = quote
    ? formatPriceFromCents(subtotalCents)
    : quoteError
      ? "Unavailable"
      : "Calculating...";

  return (
    <section className={cartClassName}>
      {showTitle ? <h1>Your basket</h1> : null}

      {!hasHydratedBasket ? (
        <div className={`${styles.loadingState} whiteFrame`}>
          <p>Loading your basket...</p>
        </div>
      ) : basketItems.length === 0 ? (
        <div className={`${styles.emptyState} whiteFrame`}>
          <p>Your basket is empty</p>
          <Link href="/shop" className={styles.shopLink}>
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          {quoteError ? <p className={styles.itemPrice}>{quoteError}</p> : null}

          {isQuotePending ? (
            <div className={`${styles.loadingState} whiteFrame`}>
              <p>Loading basket totals...</p>
            </div>
          ) : (
            <ul className={styles.itemList}>
              {lines.map((item) => (
                <li key={item.slug} className={`${styles.item} whiteFrame`}>
                  <div
                    className={`${styles.itemImageWrap} ${
                      item.isGiftCard ? styles.itemImageWrapGiftCard : ""
                    }`}
                  >
                    {item.image ? (
                      item.isGiftCard ? (
                        <GiftCardTile
                          src={item.image}
                          alt={item.imageAlt ?? item.name}
                          className={styles.itemGiftCardTile}
                        />
                      ) : (
                        <Image
                          src={item.image}
                          alt={item.imageAlt ?? item.name}
                          fill
                          className={styles.itemImage}
                        />
                      )
                    ) : (
                      <span className={styles.itemImagePlaceholder}>No image</span>
                    )}
                  </div>

                  <div className={styles.itemBody}>
                    <div className={styles.itemCopy}>
                      <h2>{item.name}</h2>
                      <p className={styles.itemPrice}>
                        {formatPriceFromCents(item.unitPriceCents)}
                      </p>
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
          )}

          <section className={`${styles.summary} whiteFrame`}>
            <div className={styles.summaryFooter}>
              <p className={styles.summaryFooterRow}>
                <span>Subtotal</span>
                <strong>{subtotalLabel}</strong>
              </p>

              {quote && !quoteError ? (
                <Link href="/checkout" className={styles.checkoutButton}>
                  Continue to Checkout
                </Link>
              ) : null}

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
