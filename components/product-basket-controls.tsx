"use client";

import { useState } from "react";
import { FiShoppingBag } from "react-icons/fi";
import type { ShopProduct } from "@/lib/products";
import { addGiftCardToBasket, addToBasket } from "@/lib/basket-storage";
import {
  GIFT_CARD_PRESET_AMOUNTS_CENTS,
  formatGiftCardAmount,
  parseCustomGiftCardAmount,
} from "@/lib/gift-card-amounts";
import styles from "./product-basket-controls.module.css";

type ProductBasketControlsProps = {
  product: Pick<ShopProduct, "slug" | "name" | "isGiftCard">;
};

export default function ProductBasketControls({ product }: ProductBasketControlsProps) {
  const [quantity, setQuantity] = useState(1);
  const [giftCardAmountCents, setGiftCardAmountCents] = useState<number>(
    GIFT_CARD_PRESET_AMOUNTS_CENTS[0],
  );
  const [isCustomGiftCardAmount, setIsCustomGiftCardAmount] = useState(false);
  const [customGiftCardAmount, setCustomGiftCardAmount] = useState("");
  const [justAdded, setJustAdded] = useState(false);

  const increase = () => setQuantity((value) => Math.min(value + 1, 99));
  const decrease = () => setQuantity((value) => Math.max(value - 1, 1));
  const customGiftCardValidation = isCustomGiftCardAmount
    ? parseCustomGiftCardAmount(customGiftCardAmount)
    : { amountCents: giftCardAmountCents, error: "" };
  const selectedGiftCardAmountCents = isCustomGiftCardAmount
    ? customGiftCardValidation.amountCents
    : giftCardAmountCents;
  const giftCardError = product.isGiftCard ? customGiftCardValidation.error : "";

  const selectGiftCardPreset = (amountCents: number) => {
    setGiftCardAmountCents(amountCents);
    setIsCustomGiftCardAmount(false);
  };

  const handleAdd = () => {
    if (product.isGiftCard) {
      if (giftCardError || selectedGiftCardAmountCents <= 0) {
        return;
      }

      addGiftCardToBasket(product.slug, selectedGiftCardAmountCents);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1100);
      return;
    }

    addToBasket(product.slug, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1100);
  };

  if (product.isGiftCard) {
    return (
      <section className={styles.wrapper}>
        <div className={styles.giftCardSelector} aria-label="Gift card amount">
          <div className={styles.giftCardAmountGrid}>
            {GIFT_CARD_PRESET_AMOUNTS_CENTS.map((amountCents) => (
              <button
                key={amountCents}
                type="button"
                className={
                  !isCustomGiftCardAmount && giftCardAmountCents === amountCents
                    ? styles.giftCardAmountButtonActive
                    : styles.giftCardAmountButton
                }
                onClick={() => selectGiftCardPreset(amountCents)}
              >
                {formatGiftCardAmount(amountCents)}
              </button>
            ))}
            <button
              type="button"
              className={
                isCustomGiftCardAmount
                  ? styles.giftCardAmountButtonActive
                  : styles.giftCardAmountButton
              }
              onClick={() => setIsCustomGiftCardAmount(true)}
            >
              Custom
            </button>
          </div>

          {isCustomGiftCardAmount ? (
            <label className={styles.customGiftCardField}>
              <span>Custom amount</span>
              <input
                type="text"
                inputMode="numeric"
                value={customGiftCardAmount}
                placeholder="20"
                onChange={(event) => setCustomGiftCardAmount(event.target.value)}
              />
            </label>
          ) : null}

          {giftCardError ? <p className={styles.errorText}>{giftCardError}</p> : null}
        </div>

        <button
          type="button"
          className={styles.addToCart}
          onClick={handleAdd}
          disabled={Boolean(giftCardError)}
        >
          <FiShoppingBag />
          {justAdded ? "Added to basket" : "Add to basket"}
        </button>
      </section>
    );
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.purchaseRow}>
        <div className={styles.quantityControl} aria-label="Quantity selector">
          <button type="button" aria-label="Decrease quantity" onClick={decrease}>
            -
          </button>
          <span>{quantity}</span>
          <button type="button" aria-label="Increase quantity" onClick={increase}>
            +
          </button>
        </div>

        <button type="button" className={styles.addToCart} onClick={handleAdd}>
          <FiShoppingBag />
          {justAdded ? "Added to basket" : "Add to basket"}
        </button>
      </div>
    </section>
  );
}
