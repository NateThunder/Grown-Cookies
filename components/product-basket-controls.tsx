"use client";

import { useState } from "react";
import { FiChevronUp, FiGift, FiShoppingBag } from "react-icons/fi";
import type { ShopProduct } from "@/lib/products";
import { addGiftCardToBasket, addToBasket } from "@/lib/basket-storage";
import {
  GIFT_CARD_PRESET_AMOUNTS_CENTS,
  formatGiftCardAmount,
  parseCustomGiftCardAmount,
} from "@/lib/gift-card-amounts";
import {
  GIFTING_MESSAGE_MAX_LENGTH,
  getGiftingCardOption,
} from "@/lib/gifting";
import styles from "./product-basket-controls.module.css";

type ProductBasketControlsProps = {
  product: Pick<ShopProduct, "slug" | "name" | "isGiftCard">;
};

const NOTECARD_GIFTING_CARD_ID = "notecard";

function formatGiftingPrice(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

export default function ProductBasketControls({ product }: ProductBasketControlsProps) {
  const [quantity, setQuantity] = useState(1);
  const [giftCardAmountCents, setGiftCardAmountCents] = useState<number>(
    GIFT_CARD_PRESET_AMOUNTS_CENTS[0],
  );
  const [isCustomGiftCardAmount, setIsCustomGiftCardAmount] = useState(false);
  const [customGiftCardAmount, setCustomGiftCardAmount] = useState("");
  const [hasSelectedGifting, setHasSelectedGifting] = useState(false);
  const [giftingMessage, setGiftingMessage] = useState("");
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
  const notecardGiftingCard = getGiftingCardOption(NOTECARD_GIFTING_CARD_ID);
  const selectedGiftingCard = hasSelectedGifting ? notecardGiftingCard : null;
  const notecardPriceLabel = notecardGiftingCard
    ? `+ ${formatGiftingPrice(notecardGiftingCard.priceCents)}`
    : "+ GBP 3.50";
  const remainingGiftingCharacters = GIFTING_MESSAGE_MAX_LENGTH - giftingMessage.length;

  const selectGiftCardPreset = (amountCents: number) => {
    setGiftCardAmountCents(amountCents);
    setIsCustomGiftCardAmount(false);
  };

  const setGiftingSelected = (selected: boolean) => {
    setHasSelectedGifting(selected);

    if (!selected) {
      setGiftingMessage("");
    }
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

    addToBasket(
      product.slug,
      quantity,
      selectedGiftingCard
        ? {
            cardId: selectedGiftingCard.id,
            message: giftingMessage,
          }
        : null,
    );
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
        <div className={styles.giftingPanel}>
          <div className={styles.giftingHeader}>
            <span className={styles.giftingIcon} aria-hidden="true">
              <FiGift />
            </span>
            <div>
              <h2>Sending as a gift?</h2>
              <p>Add a notecard and optional message</p>
            </div>
            <FiChevronUp className={styles.giftingChevron} aria-hidden="true" />
          </div>

          <label className={styles.giftingRadioOption}>
            <input
              type="checkbox"
              checked={hasSelectedGifting}
              onChange={(event) => setGiftingSelected(event.target.checked)}
            />
            <span className={styles.giftingRadioControl} aria-hidden="true" />
            <span className={styles.giftingRadioText}>
              <span>Notecard</span>
              <strong>{notecardPriceLabel}</strong>
            </span>
          </label>

          {hasSelectedGifting ? (
            <div className={styles.giftingNoteDropdown}>
              <label className={styles.giftingField}>
                <span>Gift message</span>
                <textarea
                  value={giftingMessage}
                  maxLength={GIFTING_MESSAGE_MAX_LENGTH}
                  placeholder="Write your message..."
                  onChange={(event) =>
                    setGiftingMessage(event.target.value.slice(0, GIFTING_MESSAGE_MAX_LENGTH))
                  }
                />
              </label>
              <p className={styles.giftingLimit}>
                {remainingGiftingCharacters} characters remaining
              </p>
            </div>
          ) : null}
        </div>

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
